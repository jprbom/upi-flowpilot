import type { AggregatorWebhook, PaymentLifecycleEvent, PaymentScenario, PaymentSimulationResult } from './contracts.js';
import { npciMockAdapter } from './adapters/npciMockAdapter.js';
import { createAggregatorOrder, emitAggregatorWebhooks } from './adapters/paymentAggregatorMockAdapter.js';
import { paymentGatewayMockAdapter } from './adapters/paymentGatewayMockAdapter.js';
import { pspBankMockAdapter } from './adapters/pspBankMockAdapter.js';
import { tpapMockAdapter } from './adapters/tpapMockAdapter.js';
import { settlementSimulator } from './reconciliation/settlementSimulator.js';
import { eventAt } from './paymentScenario.js';

export async function simulatePayment(input: PaymentScenario): Promise<PaymentSimulationResult> {
  const gateway = paymentGatewayMockAdapter(input);
  const aggregator = createAggregatorOrder(input, gateway);
  const tpap = tpapMockAdapter({
    txnId: input.txnId,
    app: input.tpapApp,
    flow: input.flow === 'UPI_LITE' || input.flow === 'MANDATE' ? 'UPI_INTENT' : input.flow,
    deviceTrustScore: input.deviceTrustScore,
    customerAction: input.customerAction
  });
  const bank = pspBankMockAdapter(input, tpap);
  const npci = npciMockAdapter({
    txnId: input.txnId,
    idempotencyKey: input.idempotencyKey,
    payerVpaHash: input.payerVpaHash,
    payeeVpaHash: input.payeeVpaHash,
    amountPaise: input.amountPaise,
    purpose: input.purpose,
    mcc: input.mcc,
    initiationMode: input.flow,
    payerPsp: input.payerPsp,
    payeePsp: input.payeePsp,
    payerBank: input.payerBank,
    payeeBank: input.payeeBank,
    deviceFingerprintHash: input.deviceFingerprintHash,
    riskScore: input.riskScore,
    scenario: input.scenario
  });

  const webhooks = emitAggregatorWebhooks(input, aggregator, npci);
  const reconciliation = settlementSimulator(input, npci);
  const domainEvents = repoSpecificEvents(input);
  const timeline = resequence([
    ...gateway.timeline,
    ...aggregator.timeline,
    ...domainEvents,
    ...tpap.timeline,
    ...bank.timeline,
    ...npci.timeline,
    ...webhookEvents(webhooks)
  ]);

  return {
    txnId: input.txnId,
    orderId: input.orderId,
    paymentId: aggregator.attempts[0]?.paymentId ?? `pay_${input.txnId}`,
    finalStatus: mapFinalStatus(npci.railStatus),
    rrn: npci.rrn,
    timeline,
    webhooks,
    reconciliation: {
      settlementBatchId: reconciliation.settlementBatchId,
      settlementStatus: reconciliation.status
    },
    adapters: {
      gatewayOrderId: gateway.gatewayOrderId,
      tpapStatus: tpap.tpapStatus,
      bankHealth: bank.health,
      railStatus: npci.railStatus
    }
  };
}

function mapFinalStatus(railStatus: PaymentSimulationResult['adapters']['railStatus']): PaymentSimulationResult['finalStatus'] {
  if (railStatus === 'SUCCESS') return 'SUCCESS';
  if (railStatus === 'FAILED') return 'FAILED';
  if (railStatus === 'RISK_HOLD') return 'RISK_HOLD';
  if (railStatus === 'REVERSAL_PENDING') return 'REVERSED';
  if (railStatus === 'DEEMED_PENDING' || railStatus === 'TIMEOUT') return 'DEEMED';
  return 'PENDING';
}

function webhookEvents(webhooks: AggregatorWebhook[]): PaymentLifecycleEvent[] {
  return webhooks.map((webhook, index) => ({
    sequence: index + 1,
    state: `WEBHOOK_${webhook.event.toUpperCase().replaceAll('.', '_')}`,
    actor: 'PAYMENT_AGGREGATOR',
    at: webhook.createdAt,
    reasonCode: webhook.event === 'payment.failed' ? 'NON_TERMINAL_IF_RETRY_CAN_FOLLOW' : undefined,
    raw: {
      eventId: webhook.eventId,
      event: webhook.event,
      idempotencyPrinciple: 'Duplicate event IDs are ignored; terminal captured/success wins over earlier failure.'
    }
  }));
}

function repoSpecificEvents(input: PaymentScenario): PaymentLifecycleEvent[] {
  const events: PaymentLifecycleEvent[] = [];
  if (input.repoContext === 'FLOWPILOT') {
    events.push(domainEvent(1, 'FLOWPILOT_ROUTE_SELECTED', 'RISK_ENGINE', 'BEST_FLOW_RECOMMENDED', {
      recommendedFlow: input.scenario === 'PSP_DOWN' ? 'UPI_QR' : input.flow,
      retryPolicy: input.scenario === 'LATE_SUCCESS_AFTER_FAILURE' ? 'ALLOW_TPAP_RETRY' : 'NORMAL'
    }));
  }
  if (input.repoContext === 'INTERDICT' || input.scenario === 'RISK_HOLD') {
    events.push(domainEvent(1, 'MULE_GRAPH_RISK_SCORED', 'RISK_ENGINE', input.riskScore >= 80 ? 'PRE_SETTLEMENT_HOLD_RECOMMENDED' : 'MONITOR_ONLY', {
      riskScore: input.riskScore,
      linkedEntities: input.riskScore >= 80 ? 17 : 4
    }));
  }
  if (input.repoContext === 'CASHFLOW') {
    events.push(domainEvent(1, 'CASHFLOW_MEMORY_UPDATED', 'RISK_ENGINE', 'AA_STYLE_SYNTHETIC_LEDGER_INPUT', {
      inflowSignal: 'settlement_webhook',
      memoryWindowDays: 90
    }));
  }
  if (input.repoContext === 'GUARDIAN') {
    events.push(domainEvent(1, 'AGENT_CONSENT_POLICY_EVALUATED', 'RISK_ENGINE', input.humanApprovalRequired ? 'STEP_UP_REQUIRED' : 'CONSENT_WITHIN_BOUNDS', {
      consentPolicyId: input.consentPolicyId,
      agentId: input.agentId,
      promptInjectionRisk: input.promptInjectionRisk
    }));
  }
  if (input.repoContext === 'SOCIAL_PROOF') {
    events.push(domainEvent(1, 'TRUTH_LEDGER_RECORDED', 'RISK_ENGINE', 'PROOF_CAN_BE_COMPARED_TO_RRN_UPI_ID_AMOUNT', {
      verificationInputs: ['rrn', 'upiRequestId', 'amountPaise', 'payeeVpaHash']
    }));
  }
  if (input.repoContext === 'SPEND_BRAKE') {
    events.push(domainEvent(1, 'SPEND_BRAKE_EVALUATED', 'RISK_ENGINE', input.spendBrakeDecision ?? 'ALLOW', {
      userOwnedGuardrail: true,
      essentialSpendExemption: input.mcc === '5912'
    }));
  }
  return events;
}

function domainEvent(
  sequence: number,
  state: string,
  actor: PaymentLifecycleEvent['actor'],
  reasonCode: string,
  raw: Record<string, unknown>
): PaymentLifecycleEvent {
  return { sequence, state, actor, reasonCode, raw, at: eventAt(sequence * 400) };
}

function resequence(events: PaymentLifecycleEvent[]): PaymentLifecycleEvent[] {
  return events.map((event, index) => ({ ...event, sequence: index + 1 }));
}

