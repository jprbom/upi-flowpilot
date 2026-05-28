import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { signDemoToken, type Role } from '../src/auth.js';
import { createTestDatabase } from '../src/db.js';

function bearer(role: Role) {
  return 'Bearer ' + signDemoToken(role);
}

describe('UPI FlowPilot API', () => {
  it('recommends UPI Lite for low-value degraded collect context', async () => {
    const app = createApp(createTestDatabase());
    const response = await request(app)
      .post('/api/recommendations')
      .set('Authorization', bearer('OPS_MANAGER'))
      .send({
        amount: 240,
        payerBank: 'SBI',
        psp: 'GPay',
        collectDeclineRate: 0.31,
        payerBankSuccessRate: 0.9,
        customerSegment: 'returning',
        riskScore: 18
      });

    expect(response.status).toBe(200);
    expect(response.body.recommendedFlow).toBe('UPI_LITE');
    expect(response.body.reasonCodes).toContain('LOW_TICKET_LITE_ELIGIBLE');
  });

  it('supports payment event CRUD with RBAC boundaries', async () => {
    const app = createApp(createTestDatabase());
    const forgedAdmin = await request(app)
      .delete('/api/payment-events/pay_forged_header')
      .set('x-user-role', 'ADMIN');

    expect(forgedAdmin.status).toBe(403);
    expect(forgedAdmin.body.error).toBe('RBAC_DENIED');

    const forgedRole = await request(app)
      .post('/api/payment-events')
      .set('x-user-role', 'UNKNOWN_ADMIN')
      .send({
        merchantId: 'forged-role-test',
        amount: 500,
        payerBank: 'SBI',
        psp: 'GPay',
        flow: 'UPI_INTENT',
        status: 'PENDING',
        latencyMs: 900,
        riskScore: 10
      });

    expect(forgedRole.status).toBe(403);
    expect(forgedRole.body.role).toBe('VIEWER');

    const created = await request(app)
      .post('/api/payment-events')
      .set('Authorization', bearer('OPS_MANAGER'))
      .send({
        merchantId: 'test-merchant',
        amount: 999,
        payerBank: 'ICICI Bank',
        psp: 'PhonePe',
        flow: 'UPI_INTENT',
        status: 'PENDING',
        latencyMs: 1200,
        riskScore: 12
      });

    expect(created.status).toBe(201);
    expect(created.body.id).toMatch(/^pay_/);

    const denied = await request(app)
      .delete('/api/payment-events/' + created.body.id)
      .set('Authorization', bearer('OPS_MANAGER'));
    expect(denied.status).toBe(403);

    const deleted = await request(app)
      .delete('/api/payment-events/' + created.body.id)
      .set('Authorization', bearer('ADMIN'));
    expect(deleted.status).toBe(204);
  });

  it('returns NPCI-style mock UPI rail response for end-to-end demo flows', async () => {
    const app = createApp(createTestDatabase());
    const response = await request(app)
      .post('/api/mock-upi')
      .set('Authorization', bearer('OPS_MANAGER'))
      .send({
        txnId: 'TXN-DEMO-001',
        payerVpa: 'payer@oksbi',
        payeeVpa: 'merchant@upi',
        amount: 499,
        flow: 'UPI_INTENT',
        purpose: 'portfolio test flow',
        riskScore: 24,
        scenario: 'HAPPY_PATH'
      });

    expect(response.status).toBe(200);
    expect(response.body.gateway).toBe('NPCI_UPI_MOCK');
    expect(response.body.txnId).toBe('TXN-DEMO-001');
    expect(response.body.rrn).toMatch(/^RRN/);
    expect(response.body.risk.reasonCodes).toContain('SYNTHETIC_NPCI_SANDBOX');
    expect(response.body.settlement).toHaveProperty('preSettlementHold');
  });

});
