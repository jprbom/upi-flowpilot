import type { BankHealth, BankResponse, PaymentLifecycleEvent, PaymentScenario, TpapResponse } from '../contracts.js';
import { eventAt } from '../paymentScenario.js';

export function pspBankMockAdapter(input: PaymentScenario, tpap: TpapResponse): BankResponse {
  const health = bankHealthForScenario(input);
  const timeline: PaymentLifecycleEvent[] = [
    event(1, 'ACCOUNT_LINKED', input, health),
    event(2, health.timeoutRate > 0.25 ? 'BALANCE_CHECK_THROTTLED' : 'BALANCE_CHECK_ALLOWED', input, health)
  ];

  if (tpap.nextAction === 'FAIL_PAYMENT') {
    timeline.push(event(3, 'PIN_VALIDATION_FAILED', input, health, 'CUSTOMER_DECLINED_OR_PIN_FAILED'));
    return { txnId: input.txnId, bankStatus: 'PIN_VALIDATION_FAILED', health, timeline };
  }

  if (input.scenario === 'BANK_TIMEOUT') {
    timeline.push(event(3, 'BANK_CORE_TIMEOUT', input, health, 'ISSUER_TIMEOUT'));
    return { txnId: input.txnId, bankStatus: 'BANK_CORE_TIMEOUT', health, timeline };
  }

  if (input.scenario === 'INSUFFICIENT_FUNDS') {
    timeline.push(event(3, 'INSUFFICIENT_FUNDS', input, health, 'BALANCE_SHORTFALL'));
    return { txnId: input.txnId, bankStatus: 'INSUFFICIENT_FUNDS', health, timeline };
  }

  if (input.scenario === 'REVERSAL') {
    timeline.push(event(3, 'PIN_VALIDATION_SUCCESS', input, health));
    timeline.push(event(4, 'REVERSAL', input, health, 'REVERSAL_REQUESTED'));
    return { txnId: input.txnId, bankStatus: 'REVERSAL', health, timeline };
  }

  timeline.push(event(3, 'PIN_VALIDATION_SUCCESS', input, health));
  timeline.push(event(4, 'SUCCESS', input, health));
  return { txnId: input.txnId, bankStatus: 'SUCCESS', health, timeline };
}

export function bankHealthForScenario(input: PaymentScenario): BankHealth {
  if (input.scenario === 'PSP_DOWN') {
    return {
      bankCode: input.payerBank,
      successRate: 0.41,
      p95LatencyMs: 6800,
      timeoutRate: 0.36,
      degradationLevel: 'OUTAGE',
      affectedFlows: ['UPI_INTENT', 'UPI_COLLECT']
    };
  }

  if (input.scenario === 'BANK_TIMEOUT') {
    return {
      bankCode: input.payerBank,
      successRate: 0.68,
      p95LatencyMs: 5200,
      timeoutRate: 0.28,
      degradationLevel: 'MAJOR',
      affectedFlows: ['UPI_COLLECT', 'UPI_QR']
    };
  }

  return {
    bankCode: input.payerBank,
    successRate: 0.962,
    p95LatencyMs: 840,
    timeoutRate: 0.018,
    degradationLevel: 'NORMAL',
    affectedFlows: []
  };
}

function event(sequence: number, state: string, input: PaymentScenario, health: BankHealth, reasonCode?: string): PaymentLifecycleEvent {
  return {
    sequence,
    state,
    actor: state.includes('ACCOUNT') || state.includes('BALANCE') || state.includes('PIN') || state.includes('BANK') ? 'ISSUER_BANK' : 'PSP',
    at: eventAt(sequence * 520),
    reasonCode,
    raw: {
      bankCode: input.payerBank,
      successRate: health.successRate,
      timeoutRate: health.timeoutRate,
      degradationLevel: health.degradationLevel
    }
  };
}

