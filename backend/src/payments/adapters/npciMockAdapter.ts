import type { NpciRailRequest, NpciRailResponse, PaymentActor, PaymentLifecycleEvent, PaymentScenarioCode } from '../contracts.js';
import { eventAt, stableHash } from '../paymentScenario.js';

const scenarioMap: Record<PaymentScenarioCode, string[]> = {
  HAPPY_PATH: ['VPA_VALIDATE', 'PAY_REQUEST_RECEIVED', 'CUSTOMER_APPROVED', 'SUCCESS', 'SETTLED'],
  CUSTOMER_DECLINED: ['VPA_VALIDATE', 'PAY_REQUEST_RECEIVED', 'CUSTOMER_DECLINED', 'FAILED'],
  BANK_TIMEOUT: ['VPA_VALIDATE', 'PAY_REQUEST_RECEIVED', 'ISSUER_BANK_AUTH_PENDING', 'DEEMED_PENDING'],
  PSP_DOWN: ['VPA_VALIDATE', 'PAY_REQUEST_RECEIVED', 'PSP_ROUTING_FAILED', 'FAILED'],
  DUPLICATE_REQUEST: ['DUPLICATE_DETECTED', 'FAILED'],
  VPA_INVALID: ['VPA_VALIDATE_FAILED', 'FAILED'],
  INSUFFICIENT_FUNDS: ['VPA_VALIDATE', 'CUSTOMER_APPROVED', 'ISSUER_BANK_DECLINED', 'FAILED'],
  RISK_HOLD: ['VPA_VALIDATE', 'PAY_REQUEST_RECEIVED', 'RISK_HOLD', 'PRE_SETTLEMENT_HOLD'],
  DEEMED_SUCCESS: ['DEEMED_PENDING', 'LATE_SUCCESS', 'SETTLED'],
  LATE_SUCCESS_AFTER_FAILURE: ['FAILED', 'CUSTOMER_RETRY', 'SUCCESS', 'SETTLED'],
  REVERSAL: ['SUCCESS', 'REVERSAL_PENDING', 'REVERSAL_SUCCESS'],
  WEBHOOK_DUPLICATE: ['VPA_VALIDATE', 'PAY_REQUEST_RECEIVED', 'CUSTOMER_APPROVED', 'SUCCESS', 'SETTLED'],
  WEBHOOK_OUT_OF_ORDER: ['PAY_REQUEST_RECEIVED', 'DEEMED_PENDING', 'SUCCESS', 'SETTLED']
};

export function npciMockAdapter(req: NpciRailRequest): NpciRailResponse {
  const rrn = `RRN${stableHash(req.txnId + req.amountPaise).slice(0, 12).toUpperCase()}`;
  const states = scenarioMap[req.scenario];

  return {
    gateway: 'NPCI_UPI_SIMULATOR',
    txnId: req.txnId,
    upiRequestId: `UPI-${req.txnId}`,
    rrn,
    responseCode: responseCodeForScenario(req.scenario),
    responseMessage: `Synthetic UPI rail response for ${req.scenario}. No live NPCI rail used.`,
    railStatus: railStatusForScenario(req.scenario),
    settlementState: settlementStateForScenario(req.scenario),
    timeline: states.map((state, index) => railEvent(state, index + 1, req)),
    callback: {
      eventId: `evt_${stableHash(req.txnId).slice(0, 16)}`,
      eventType: eventTypeForScenario(req.scenario),
      callbackUrl: '/api/webhooks/npci',
      retryCount: req.scenario === 'BANK_TIMEOUT' ? 3 : 0
    }
  };
}

function railEvent(state: string, sequence: number, req: NpciRailRequest): PaymentLifecycleEvent {
  return {
    sequence,
    state,
    at: eventAt(sequence * 700),
    actor: actorForState(state),
    reasonCode: reasonForState(state, req),
    raw: {
      flow: req.initiationMode,
      payerBank: req.payerBank,
      payeeBank: req.payeeBank,
      riskScore: req.riskScore
    }
  };
}

function responseCodeForScenario(scenario: PaymentScenarioCode) {
  const codes: Record<PaymentScenarioCode, string> = {
    HAPPY_PATH: '00',
    CUSTOMER_DECLINED: 'U17',
    BANK_TIMEOUT: 'U09',
    PSP_DOWN: 'U28',
    DUPLICATE_REQUEST: 'U69',
    VPA_INVALID: 'U16',
    INSUFFICIENT_FUNDS: 'U30',
    RISK_HOLD: 'RH1',
    DEEMED_SUCCESS: 'DP1',
    LATE_SUCCESS_AFTER_FAILURE: 'LS1',
    REVERSAL: 'R01',
    WEBHOOK_DUPLICATE: '00',
    WEBHOOK_OUT_OF_ORDER: '00'
  };
  return codes[scenario];
}

function railStatusForScenario(scenario: PaymentScenarioCode): NpciRailResponse['railStatus'] {
  if (scenario === 'BANK_TIMEOUT' || scenario === 'DEEMED_SUCCESS' || scenario === 'WEBHOOK_OUT_OF_ORDER') return 'DEEMED_PENDING';
  if (scenario === 'RISK_HOLD') return 'RISK_HOLD';
  if (scenario === 'REVERSAL') return 'REVERSAL_PENDING';
  if (['CUSTOMER_DECLINED', 'PSP_DOWN', 'DUPLICATE_REQUEST', 'VPA_INVALID', 'INSUFFICIENT_FUNDS'].includes(scenario)) return 'FAILED';
  return 'SUCCESS';
}

function settlementStateForScenario(scenario: PaymentScenarioCode): NpciRailResponse['settlementState'] {
  if (scenario === 'RISK_HOLD') return 'PRE_SETTLEMENT_HOLD';
  if (scenario === 'REVERSAL') return 'REVERSAL_PENDING';
  if (scenario === 'HAPPY_PATH' || scenario === 'DEEMED_SUCCESS' || scenario === 'LATE_SUCCESS_AFTER_FAILURE' || scenario === 'WEBHOOK_DUPLICATE') return 'SETTLED';
  if (scenario === 'WEBHOOK_OUT_OF_ORDER') return 'READY_FOR_SETTLEMENT';
  return 'NOT_SETTLED';
}

function actorForState(state: string): PaymentActor {
  if (state.includes('CUSTOMER')) return 'CUSTOMER';
  if (state.includes('ISSUER') || state.includes('BANK')) return 'ISSUER_BANK';
  if (state.includes('RISK') || state.includes('HOLD')) return 'RISK_ENGINE';
  if (state.includes('PSP')) return 'PSP';
  return 'NPCI_SIMULATOR';
}

function reasonForState(state: string, req: NpciRailRequest) {
  if (state === 'RISK_HOLD') return req.riskScore && req.riskScore >= 80 ? 'MULE_CLUSTER_HIGH_CENTRALITY' : 'RISK_POLICY_HOLD';
  if (state === 'VPA_VALIDATE_FAILED') return 'VPA_DIRECTORY_MISMATCH';
  if (state === 'DUPLICATE_DETECTED') return 'IDEMPOTENCY_KEY_REPLAY';
  if (state === 'ISSUER_BANK_DECLINED') return 'INSUFFICIENT_FUNDS';
  if (state === 'PSP_ROUTING_FAILED') return 'PSP_DEGRADED';
  if (state === 'DEEMED_PENDING') return 'BANK_CALLBACK_PENDING';
  return undefined;
}

function eventTypeForScenario(scenario: PaymentScenarioCode): string {
  if (scenario === 'RISK_HOLD') return 'risk.pre_settlement_hold';
  if (scenario === 'REVERSAL') return 'refund.processed';
  if (['CUSTOMER_DECLINED', 'PSP_DOWN', 'DUPLICATE_REQUEST', 'VPA_INVALID', 'INSUFFICIENT_FUNDS'].includes(scenario)) return 'payment.failed';
  return 'payment.captured';
}

