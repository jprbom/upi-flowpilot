import type { AggregatorWebhook, WebhookEventStore } from '../contracts.js';
import { verifyWebhook } from './webhookSigner.js';

export type WebhookProvider = WebhookEventStore['provider'];

export type WebhookReceiveResult = {
  accepted: boolean;
  duplicate: boolean;
  processed: boolean;
  finalOrderStatus: 'CREATED' | 'PENDING' | 'PAID' | 'FAILED' | 'HELD' | 'REFUNDED';
  eventStore: WebhookEventStore;
};

export function createWebhookReceiver(secret = process.env.WEBHOOK_SIM_SECRET ?? 'upi-simulator-webhook-secret') {
  const received = new Map<string, WebhookEventStore>();
  const orderState = new Map<string, WebhookReceiveResult['finalOrderStatus']>();

  function receive(provider: WebhookProvider, webhook: AggregatorWebhook, rawBody = JSON.stringify(webhook.payload)): WebhookReceiveResult {
    if (!verifyWebhook(rawBody, webhook.signature, secret)) {
      const rejected = store(webhook, provider, false, false);
      return { accepted: false, duplicate: false, processed: false, finalOrderStatus: stateFor(webhook.orderId), eventStore: rejected };
    }

    if (received.has(webhook.eventId)) {
      const duplicate = { ...received.get(webhook.eventId)!, duplicate: true, processed: false };
      received.set(webhook.eventId, duplicate);
      return { accepted: true, duplicate: true, processed: false, finalOrderStatus: stateFor(webhook.orderId), eventStore: duplicate };
    }

    const current = stateFor(webhook.orderId);
    const next = nextOrderState(current, webhook.event);
    orderState.set(webhook.orderId, next);
    const eventStore = store(webhook, provider, true, true);
    return { accepted: true, duplicate: false, processed: true, finalOrderStatus: next, eventStore };
  }

  function all() {
    return [...received.values()];
  }

  function stateFor(orderId: string): WebhookReceiveResult['finalOrderStatus'] {
    return orderState.get(orderId) ?? 'CREATED';
  }

  function store(webhook: AggregatorWebhook, provider: WebhookProvider, processed: boolean, accepted: boolean): WebhookEventStore {
    const record: WebhookEventStore = {
      eventId: webhook.eventId,
      provider,
      paymentId: webhook.paymentId,
      orderId: webhook.orderId,
      eventType: webhook.event,
      receivedAt: new Date().toISOString(),
      processed: accepted && processed,
      duplicate: false,
      rawPayload: webhook.payload
    };
    received.set(webhook.eventId, record);
    return record;
  }

  return { receive, all, stateFor };
}

function nextOrderState(
  current: WebhookReceiveResult['finalOrderStatus'],
  event: AggregatorWebhook['event']
): WebhookReceiveResult['finalOrderStatus'] {
  if (current === 'PAID' && event !== 'refund.processed') return 'PAID';
  if (event === 'payment.captured') return 'PAID';
  if (event === 'payment.failed') return current === 'CREATED' ? 'FAILED' : current;
  if (event === 'payment.authorized') return current === 'CREATED' ? 'PENDING' : current;
  if (event === 'risk.pre_settlement_hold') return 'HELD';
  if (event === 'refund.processed') return 'REFUNDED';
  return current;
}

