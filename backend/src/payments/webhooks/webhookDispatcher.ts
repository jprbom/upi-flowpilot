import type { AggregatorWebhook } from '../contracts.js';
import { signWebhook } from './webhookSigner.js';

export function signAndDispatchWebhook(webhook: AggregatorWebhook, secret = process.env.WEBHOOK_SIM_SECRET ?? 'upi-simulator-webhook-secret') {
  const rawBody = JSON.stringify(webhook.payload);
  return {
    ...webhook,
    signature: signWebhook(rawBody, secret),
    headers: {
      'x-webhook-event-id': webhook.eventId,
      'x-webhook-signature': signWebhook(rawBody, secret),
      'x-webhook-provider': 'PA_SIM'
    }
  };
}

