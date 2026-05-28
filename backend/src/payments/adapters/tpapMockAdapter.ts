import type { PaymentLifecycleEvent, TpapRequest, TpapResponse } from '../contracts.js';
import { eventAt } from '../paymentScenario.js';

export function tpapMockAdapter(req: TpapRequest): TpapResponse {
  const timeline: PaymentLifecycleEvent[] = [
    event(1, 'APP_OPENED', req),
    event(2, req.flow === 'UPI_COLLECT' ? 'COLLECT_REQUEST_SHOWN' : 'INTENT_RECEIVED', req)
  ];

  if (req.customerAction === 'APP_SWITCH_DROP') {
    timeline.push(event(3, 'APP_SWITCH_DROP', req, 'CUSTOMER_DROPPED_DURING_APP_SWITCH'));
    return response(req, 'APP_SWITCH_DROPPED', 'Customer dropped during TPAP app switch.', 'RETRY_ALLOWED', timeline);
  }

  if (req.customerAction === 'DECLINE' || req.customerAction === 'PIN_FAILURE') {
    timeline.push(event(3, req.customerAction === 'PIN_FAILURE' ? 'PIN_FAILURE' : 'CUSTOMER_CANCELLED', req));
    return response(req, 'DECLINED', 'Customer declined or PIN validation failed.', 'FAIL_PAYMENT', timeline);
  }

  if (req.customerAction === 'TIMEOUT') {
    timeline.push(event(3, 'TPAP_TIMEOUT', req, 'TPAP_CALLBACK_TIMEOUT'));
    return response(req, 'TIMEOUT', 'UPI app timeout. Retry may be safer than fail-fast.', 'RETRY_ALLOWED', timeline);
  }

  if (req.customerAction === 'RETRY') {
    timeline.push(event(3, 'CUSTOMER_RETRIED', req, 'RETRY_FROM_TPAP'));
    timeline.push(event(4, 'CUSTOMER_ENTERED_PIN', req));
    timeline.push(event(5, 'SUCCESS_CALLBACK_SENT', req));
    return response(req, 'RETRY_STARTED', 'Customer retried from TPAP and a success callback may arrive after a failure webhook.', 'SEND_TO_NPCI', timeline);
  }

  timeline.push(event(3, 'CUSTOMER_ENTERED_PIN', req));
  timeline.push(event(4, 'SUCCESS_CALLBACK_SENT', req));
  return response(req, 'APPROVED', 'Customer approved in TPAP app.', 'SEND_TO_NPCI', timeline);
}

function response(
  req: TpapRequest,
  tpapStatus: TpapResponse['tpapStatus'],
  customerVisibleMessage: string,
  nextAction: TpapResponse['nextAction'],
  timeline: PaymentLifecycleEvent[]
): TpapResponse {
  return { txnId: req.txnId, app: req.app, tpapStatus, customerVisibleMessage, nextAction, timeline };
}

function event(sequence: number, state: string, req: TpapRequest, reasonCode?: string): PaymentLifecycleEvent {
  return {
    sequence,
    state,
    actor: state.includes('CUSTOMER') || state.includes('PIN') ? 'CUSTOMER' : 'TPAP',
    at: eventAt(sequence * 450),
    reasonCode,
    raw: { app: req.app, flow: req.flow, deviceTrustScore: req.deviceTrustScore }
  };
}

