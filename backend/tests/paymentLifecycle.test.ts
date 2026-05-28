import { describe, expect, it } from 'vitest';
import { normalizePaymentScenario } from '../src/payments/paymentScenario.js';
import { simulatePayment } from '../src/payments/paymentLifecycle.js';

describe('payment ecosystem lifecycle simulator', () => {
  it('settles happy path through PG, PA, TPAP, bank, NPCI and webhook layers', async () => {
    const payment = await simulatePayment(normalizePaymentScenario({ scenario: 'HAPPY_PATH' }));

    expect(payment.finalStatus).toBe('SUCCESS');
    expect(payment.reconciliation.settlementStatus).toBe('SETTLED');
    expect(payment.timeline.map((event) => event.state)).toEqual(expect.arrayContaining(['CHECKOUT_CREATED', 'PAYMENT_ATTEMPT_CREATED', 'SUCCESS', 'SETTLED']));
    expect(payment.webhooks.some((webhook) => webhook.event === 'payment.captured')).toBe(true);
  });

  it('keeps failed then captured UPI retry sequence instead of treating the first failure as terminal', async () => {
    const payment = await simulatePayment(normalizePaymentScenario({ scenario: 'LATE_SUCCESS_AFTER_FAILURE' }));

    expect(payment.finalStatus).toBe('SUCCESS');
    expect(payment.webhooks.map((webhook) => webhook.event)).toEqual(['payment.failed', 'payment.captured']);
  });

  it('places high risk mule scenarios into pre-settlement hold', async () => {
    const payment = await simulatePayment(normalizePaymentScenario({ scenario: 'RISK_HOLD', repoContext: 'INTERDICT', riskScore: 94 }));

    expect(payment.finalStatus).toBe('RISK_HOLD');
    expect(payment.reconciliation.settlementStatus).toBe('HELD');
    expect(payment.timeline.some((event) => event.state === 'MULE_GRAPH_RISK_SCORED')).toBe(true);
  });
});

