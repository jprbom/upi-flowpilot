import { describe, expect, it } from 'vitest';
import { npciMockAdapter } from '../src/payments/adapters/npciMockAdapter.js';
import { normalizePaymentScenario } from '../src/payments/paymentScenario.js';

describe('adapter contracts', () => {
  it('returns public-safe NPCI-style rail fields without claiming live NPCI access', () => {
    const scenario = normalizePaymentScenario({ scenario: 'BANK_TIMEOUT' });
    const response = npciMockAdapter({
      txnId: scenario.txnId,
      idempotencyKey: scenario.idempotencyKey,
      payerVpaHash: scenario.payerVpaHash,
      payeeVpaHash: scenario.payeeVpaHash,
      amountPaise: scenario.amountPaise,
      purpose: scenario.purpose,
      mcc: scenario.mcc,
      initiationMode: scenario.flow,
      payerPsp: scenario.payerPsp,
      payeePsp: scenario.payeePsp,
      payerBank: scenario.payerBank,
      payeeBank: scenario.payeeBank,
      riskScore: scenario.riskScore,
      scenario: scenario.scenario
    });

    expect(response.gateway).toBe('NPCI_UPI_SIMULATOR');
    expect(response.responseMessage).toContain('No live NPCI rail used');
    expect(response.railStatus).toBe('DEEMED_PENDING');
    expect(response.timeline.some((event) => event.state === 'ISSUER_BANK_AUTH_PENDING')).toBe(true);
  });
});

