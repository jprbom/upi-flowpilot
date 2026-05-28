import type { PaymentGatewayCreatePaymentRequest, PaymentGatewayCreatePaymentResponse, PaymentLifecycleEvent, PaymentScenario } from '../contracts.js';
import { eventAt, stableHash } from '../paymentScenario.js';

export function createGatewayRequest(input: PaymentScenario): PaymentGatewayCreatePaymentRequest {
  return {
    merchantOrderId: input.orderId,
    amount: input.amountPaise,
    expireAfter: 900,
    paymentFlow: {
      type: 'PG_CHECKOUT',
      message: 'Synthetic UPI checkout session. No live gateway is used.',
      merchantUrls: {
        redirectUrl: `https://merchant.example/payments/${input.orderId}/return`
      },
      paymentModeConfig: {
        enabledPaymentModes: [{ type: 'UPI_INTENT' }, { type: 'UPI_QR' }, { type: 'CARD' }, { type: 'NET_BANKING' }]
      }
    },
    metaInfo: {
      simulator: 'PUBLIC_SAFE_PAYMENT_ECOSYSTEM',
      flow: input.flow
    }
  };
}

export function paymentGatewayMockAdapter(input: PaymentScenario): PaymentGatewayCreatePaymentResponse {
  const gatewayOrderId = `pg_${stableHash(input.orderId).slice(0, 14)}`;
  return {
    merchantOrderId: input.orderId,
    gatewayOrderId,
    checkoutUrl: `https://checkout.simulated.local/${gatewayOrderId}`,
    status: 'CHECKOUT_CREATED',
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
    timeline: [
      event(1, 'PG_CHECKOUT_REQUESTED', input, gatewayOrderId),
      event(2, 'CHECKOUT_CREATED', input, gatewayOrderId)
    ]
  };
}

function event(sequence: number, state: string, input: PaymentScenario, gatewayOrderId: string): PaymentLifecycleEvent {
  return {
    sequence,
    state,
    actor: 'PAYMENT_GATEWAY',
    at: eventAt(sequence * 300),
    raw: {
      merchantOrderId: input.orderId,
      gatewayOrderId,
      amountPaise: input.amountPaise,
      enabledModes: ['UPI_INTENT', 'UPI_QR', 'CARD', 'NET_BANKING']
    }
  };
}

