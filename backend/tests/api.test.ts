import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestDatabase } from '../src/db.js';

describe('UPI FlowPilot API', () => {
  it('recommends UPI Lite for low-value degraded collect context', async () => {
    const app = createApp(createTestDatabase());
    const response = await request(app)
      .post('/api/recommendations')
      .set('x-user-role', 'OPS_MANAGER')
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
    const created = await request(app)
      .post('/api/payment-events')
      .set('x-user-role', 'OPS_MANAGER')
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
      .set('x-user-role', 'OPS_MANAGER');
    expect(denied.status).toBe(403);

    const deleted = await request(app)
      .delete('/api/payment-events/' + created.body.id)
      .set('x-user-role', 'ADMIN');
    expect(deleted.status).toBe(204);
  });
});

