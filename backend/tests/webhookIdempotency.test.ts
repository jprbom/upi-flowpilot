import { describe, expect, it } from 'vitest';
import { createWebhookReceiver } from '../src/payments/webhooks/webhookReceiver.js';
import { signWebhook } from '../src/payments/webhooks/webhookSigner.js';

describe('webhook idempotency and terminal status handling', () => {
  it('ignores duplicate webhook event ids', () => {
    const receiver = createWebhookReceiver('secret');
    const payload = { event: 'payment.captured', orderId: 'ord_1', paymentId: 'pay_1' };
    const webhook = {
      eventId: 'evt_same',
      event: 'payment.captured' as const,
      orderId: 'ord_1',
      paymentId: 'pay_1',
      payload,
      signature: signWebhook(JSON.stringify(payload), 'secret'),
      createdAt: new Date().toISOString()
    };

    const first = receiver.receive('PA_SIM', webhook, JSON.stringify(payload));
    const second = receiver.receive('PA_SIM', webhook, JSON.stringify(payload));

    expect(first.processed).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(second.processed).toBe(false);
    expect(receiver.stateFor('ord_1')).toBe('PAID');
  });

  it('allows out-of-order success to become terminal paid after earlier pending authorization', () => {
    const receiver = createWebhookReceiver('secret');
    const authorizedPayload = { event: 'payment.authorized', orderId: 'ord_2', paymentId: 'pay_2' };
    const capturedPayload = { event: 'payment.captured', orderId: 'ord_2', paymentId: 'pay_2' };

    receiver.receive(
      'PA_SIM',
      {
        eventId: 'evt_auth',
        event: 'payment.authorized',
        orderId: 'ord_2',
        paymentId: 'pay_2',
        payload: authorizedPayload,
        signature: signWebhook(JSON.stringify(authorizedPayload), 'secret'),
        createdAt: new Date().toISOString()
      },
      JSON.stringify(authorizedPayload)
    );
    const captured = receiver.receive(
      'PA_SIM',
      {
        eventId: 'evt_cap',
        event: 'payment.captured',
        orderId: 'ord_2',
        paymentId: 'pay_2',
        payload: capturedPayload,
        signature: signWebhook(JSON.stringify(capturedPayload), 'secret'),
        createdAt: new Date().toISOString()
      },
      JSON.stringify(capturedPayload)
    );

    expect(captured.finalOrderStatus).toBe('PAID');
  });
});

