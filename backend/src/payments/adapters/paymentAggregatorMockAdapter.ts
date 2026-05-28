import type {
  AggregatorWebhook,
  NpciRailResponse,
  PaymentAggregatorOrder,
  PaymentAttempt,
  PaymentGatewayCreatePaymentResponse,
  PaymentLifecycleEvent,
  PaymentScenario
} from '../contracts.js';
import { eventAt, stableHash } from '../paymentScenario.js';
import { signWebhook } from '../webhooks/webhookSigner.js';

const WEBHOOK_SECRET = process.env.WEBHOOK_SIM_SECRET ?? 'upi-simulator-webhook-secret';

export function createAggregatorOrder(input: PaymentScenario, pg: PaymentGatewayCreatePaymentResponse): PaymentAggregatorOrder {
  const paymentId = paymentIdFor(input);
  const attempt: PaymentAttempt = {
    paymentId,
    orderId: input.orderId,
    method: 'UPI',
    flow: input.flow === 'MANDATE' ? 'UPI_INTENT' : input.flow,
    status: input.scenario === 'DUPLICATE_REQUEST' ? 'FAILED' : 'PENDING'
  };

  return {
    orderId: input.orderId,
    merchantId: input.merchantId,
    amountPaise: input.amountPaise,
    currency: 'INR',
    status: 'ATTEMPTED',
    attempts: [attempt],
    timeline: [
      event(1, 'ORDER_CREATED', input, paymentId, { gatewayOrderId: pg.gatewayOrderId }),
      event(2, 'PAYMENT_ATTEMPT_CREATED', input, paymentId),
      event(3, 'PAYMENT_AUTHORIZATION_STARTED', input, paymentId)
    ]
  };
}

export function emitAggregatorWebhooks(input: PaymentScenario, order: PaymentAggregatorOrder, npci: NpciRailResponse): AggregatorWebhook[] {
  const paymentId = order.attempts[0]?.paymentId ?? paymentIdFor(input);

  if (input.scenario === 'LATE_SUCCESS_AFTER_FAILURE') {
    return [
      webhook('payment.failed', input, paymentId, { errorReason: 'CUSTOMER_RETRY_PENDING', rrn: npci.rrn }, 1),
      webhook('payment.captured', input, paymentId, { rrn: npci.rrn, retryRecovered: true }, 2)
    ];
  }

  if (input.scenario === 'WEBHOOK_OUT_OF_ORDER') {
    return [
      webhook('payment.captured', input, paymentId, { rrn: npci.rrn, receivedBeforeAuthorized: true }, 2),
      webhook('payment.authorized', input, paymentId, { rrn: npci.rrn }, 1)
    ];
  }

  if (input.scenario === 'WEBHOOK_DUPLICATE') {
    const captured = webhook('payment.captured', input, paymentId, { rrn: npci.rrn }, 1);
    return [captured, { ...captured, createdAt: eventAt(2400) }];
  }

  if (input.scenario === 'RISK_HOLD') {
    return [webhook('risk.pre_settlement_hold', input, paymentId, { rrn: npci.rrn, holdReason: 'MULE_CLUSTER_HIGH_CENTRALITY' }, 1)];
  }

  if (input.scenario === 'PSP_DOWN') {
    return [
      webhook('payment.downtime.started', input, paymentId, { provider: input.payerPsp, affectedFlow: input.flow }, 1),
      webhook('payment.failed', input, paymentId, { errorReason: 'PSP_DEGRADED' }, 2)
    ];
  }

  if (npci.railStatus === 'SUCCESS') return [webhook('payment.captured', input, paymentId, { rrn: npci.rrn }, 1)];
  if (npci.railStatus === 'REVERSAL_PENDING') return [webhook('refund.processed', input, paymentId, { rrn: npci.rrn }, 1)];
  if (npci.railStatus === 'DEEMED_PENDING') return [webhook('payment.authorized', input, paymentId, { rrn: npci.rrn, deemedPending: true }, 1)];
  return [webhook('payment.failed', input, paymentId, { errorReason: npci.responseCode, rrn: npci.rrn }, 1)];
}

export function paymentIdFor(input: PaymentScenario) {
  return `pay_${stableHash(input.orderId + input.txnId).slice(0, 14)}`;
}

function webhook(
  event: AggregatorWebhook['event'],
  input: PaymentScenario,
  paymentId: string,
  payload: Record<string, unknown>,
  sequence: number
): AggregatorWebhook {
  const body = {
    event,
    orderId: input.orderId,
    paymentId,
    txnId: input.txnId,
    amountPaise: input.amountPaise,
    payload
  };
  const eventId = `wh_${stableHash(JSON.stringify(body) + sequence).slice(0, 16)}`;
  return {
    eventId,
    event,
    orderId: input.orderId,
    paymentId,
    payload: body,
    signature: signWebhook(JSON.stringify(body), WEBHOOK_SECRET),
    createdAt: eventAt(sequence * 900)
  };
}

function event(sequence: number, state: string, input: PaymentScenario, paymentId: string, raw: Record<string, unknown> = {}): PaymentLifecycleEvent {
  return {
    sequence,
    state,
    actor: 'PAYMENT_AGGREGATOR',
    at: eventAt(sequence * 360),
    raw: {
      orderId: input.orderId,
      paymentId,
      statusPrinciple: 'Only terminal SUCCESS/CAPTURED should mark an order paid.',
      ...raw
    }
  };
}

