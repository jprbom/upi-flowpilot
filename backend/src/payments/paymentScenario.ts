import { createHash } from 'node:crypto';
import type { PaymentScenario, PaymentScenarioCode, UpiFlow } from './contracts.js';

export function stableHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function defaultPaymentScenario(overrides: Partial<PaymentScenario> = {}): PaymentScenario {
  const suffix = stableHash(JSON.stringify(overrides) + Date.now().toString()).slice(0, 10);
  const scenario = overrides.scenario ?? 'HAPPY_PATH';
  const flow = (overrides.flow ?? 'UPI_INTENT') as UpiFlow;
  const txnId = overrides.txnId ?? `TXN_${suffix.toUpperCase()}`;
  return {
    txnId,
    orderId: overrides.orderId ?? `ORD_${suffix.toUpperCase()}`,
    idempotencyKey: overrides.idempotencyKey ?? `idem_${suffix}`,
    merchantId: overrides.merchantId ?? 'merchant_bharat_demo',
    payerVpaHash: overrides.payerVpaHash ?? stableHash('payer@upi').slice(0, 24),
    payeeVpaHash: overrides.payeeVpaHash ?? stableHash('merchant@upi').slice(0, 24),
    amountPaise: overrides.amountPaise ?? 249900,
    purpose: overrides.purpose ?? 'Synthetic UPI lifecycle simulation',
    mcc: overrides.mcc ?? '5499',
    flow,
    payerPsp: overrides.payerPsp ?? 'GPAY',
    payeePsp: overrides.payeePsp ?? 'RAZORPAYX_SIM',
    payerBank: overrides.payerBank ?? 'HDFC',
    payeeBank: overrides.payeeBank ?? 'ICICI',
    tpapApp: overrides.tpapApp ?? 'GPAY',
    deviceFingerprintHash: overrides.deviceFingerprintHash ?? stableHash('demo-device').slice(0, 24),
    deviceTrustScore: overrides.deviceTrustScore ?? 82,
    customerAction: overrides.customerAction ?? customerActionForScenario(scenario),
    scenario,
    riskScore: overrides.riskScore ?? (scenario === 'RISK_HOLD' ? 91 : 26),
    repoContext: overrides.repoContext ?? 'FLOWPILOT',
    consentPolicyId: overrides.consentPolicyId,
    agentId: overrides.agentId,
    promptInjectionRisk: overrides.promptInjectionRisk ?? 0,
    humanApprovalRequired: overrides.humanApprovalRequired ?? false,
    spendBrakeDecision: overrides.spendBrakeDecision
  };
}

export function normalizePaymentScenario(input: Partial<PaymentScenario>): PaymentScenario {
  const scenario = normalizeScenario(input.scenario);
  return defaultPaymentScenario({ ...input, scenario });
}

function normalizeScenario(scenario: unknown): PaymentScenarioCode {
  const allowed: PaymentScenarioCode[] = [
    'HAPPY_PATH',
    'CUSTOMER_DECLINED',
    'BANK_TIMEOUT',
    'PSP_DOWN',
    'DUPLICATE_REQUEST',
    'VPA_INVALID',
    'INSUFFICIENT_FUNDS',
    'RISK_HOLD',
    'DEEMED_SUCCESS',
    'LATE_SUCCESS_AFTER_FAILURE',
    'REVERSAL',
    'WEBHOOK_DUPLICATE',
    'WEBHOOK_OUT_OF_ORDER'
  ];
  return typeof scenario === 'string' && allowed.includes(scenario as PaymentScenarioCode)
    ? (scenario as PaymentScenarioCode)
    : 'HAPPY_PATH';
}

function customerActionForScenario(scenario: PaymentScenarioCode): PaymentScenario['customerAction'] {
  if (scenario === 'CUSTOMER_DECLINED') return 'DECLINE';
  if (scenario === 'BANK_TIMEOUT' || scenario === 'PSP_DOWN') return 'TIMEOUT';
  if (scenario === 'LATE_SUCCESS_AFTER_FAILURE') return 'RETRY';
  return 'APPROVE';
}

export function eventAt(offsetMs: number) {
  return new Date(Date.now() + offsetMs).toISOString();
}

