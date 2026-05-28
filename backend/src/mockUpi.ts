import { z } from 'zod';

export const mockUpiRailRequestSchema = z.object({
  txnId: z.string().min(3),
  payerVpa: z.string().min(3),
  payeeVpa: z.string().min(3),
  amount: z.number().positive().max(500000),
  flow: z.string().min(3),
  purpose: z.string().min(3),
  riskScore: z.number().min(0).max(100),
  scenario: z.enum(['HAPPY_PATH', 'DEGRADED_BANK', 'BANK_TIMEOUT', 'RISK_HOLD', 'STEP_UP']).default('HAPPY_PATH')
});

export type MockUpiRailRequest = z.infer<typeof mockUpiRailRequestSchema>;

const conceptCode = 'UPI_FLOWPILOT';

export function buildMockUpiResponse(input: MockUpiRailRequest) {
  const rrn = 'RRN' + Math.abs(hash(input.txnId + input.payeeVpa)).toString().padStart(12, '0').slice(0, 12);
  const baseReasons = ['SYNTHETIC_NPCI_SANDBOX', conceptCode + '_POLICY_EVALUATED'];
  const highRisk = input.riskScore >= 75 || input.scenario === 'RISK_HOLD';
  const stepUp = input.riskScore >= 55 || input.scenario === 'STEP_UP';
  const timeout = input.scenario === 'BANK_TIMEOUT' || input.scenario === 'DEGRADED_BANK';

  const npciStatus = highRisk ? 'RISK_HOLD' : stepUp ? 'STEP_UP_REQUIRED' : timeout ? 'DEEMED' : 'SUCCESS';
  const responseCode = highRisk ? 'U30' : stepUp ? 'U16' : timeout ? 'BTM' : '00';
  const decision = highRisk ? 'HOLD_BEFORE_SETTLEMENT' : stepUp ? 'REQUIRE_CUSTOMER_AUTH' : timeout ? 'RETRY_OR_ALTERNATE_FLOW' : 'APPROVE';
  const reasonCodes = [
    ...baseReasons,
    highRisk ? 'PRE_SETTLEMENT_RISK_HOLD' : stepUp ? 'STEP_UP_AUTH_REQUIRED' : timeout ? 'PAYER_BANK_DEGRADED' : 'NPCI_SUCCESS_PATH',
    input.flow + '_SIMULATED'
  ];

  return {
    gateway: 'NPCI_UPI_MOCK',
    concept: 'UPI FlowPilot',
    txnId: input.txnId,
    upiRequestId: 'UPI-' + input.txnId,
    rrn,
    bankRefId: 'BANK-' + rrn.slice(-8),
    npciStatus,
    responseCode,
    responseMessage: 'UPI FlowPilot sandbox response for ' + input.purpose + '. No real UPI rail, NPCI, bank, PSP, or customer data is used.',
    settlement: {
      mode: highRisk ? 'PRE_SETTLEMENT_HOLD' : timeout ? 'DEEMED_PENDING' : 'IMMEDIATE_SYNTHETIC',
      preSettlementHold: highRisk,
      estimatedSettlementSeconds: highRisk ? 0 : timeout ? 180 : 12
    },
    risk: {
      score: input.riskScore,
      decision,
      reasonCodes
    },
    callbacks: {
      pspStatus: timeout ? 'CALLBACK_DELAYED' : 'CALLBACK_SENT',
      bankStatus: timeout ? 'BANK_TIMEOUT_SIMULATED' : 'BANK_CONFIRMED',
      webhook: '/mock/webhooks/upi/' + input.txnId
    },
    requestEcho: input
  };
}

function hash(value: string) {
  let result = 0;
  for (const char of value) result = ((result << 5) - result + char.charCodeAt(0)) | 0;
  return result;
}
