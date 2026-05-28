import type { Express, Request, Response } from 'express';
import { requirePermission } from '../auth.js';
import type { AggregatorWebhook, PaymentSimulationResult, WebhookEventStore } from './contracts.js';
import { normalizePaymentScenario } from './paymentScenario.js';
import { simulatePayment } from './paymentLifecycle.js';
import { settlementSimulator, type SettlementBatch } from './reconciliation/settlementSimulator.js';
import { disputeSimulator, type DisputeRecord } from './reconciliation/disputeSimulator.js';
import { createWebhookReceiver, type WebhookProvider } from './webhooks/webhookReceiver.js';

const payments = new Map<string, PaymentSimulationResult>();
const idempotencyIndex = new Map<string, string>();
const settlementBatches: SettlementBatch[] = [];
const disputes: DisputeRecord[] = [];
const webhookReceiver = createWebhookReceiver();

export function registerPaymentRoutes(app: Express) {
  app.post('/api/payments/initiate', requirePermission('write'), async (req: Request, res: Response) => {
    const scenario = normalizePaymentScenario(req.body ?? {});
    const previousTxnId = idempotencyIndex.get(scenario.idempotencyKey);
    if (previousTxnId) {
      res.status(200).json({ idempotentReplay: true, payment: payments.get(previousTxnId) });
      return;
    }

    const payment = await simulatePayment(scenario);
    payments.set(payment.txnId, payment);
    idempotencyIndex.set(scenario.idempotencyKey, payment.txnId);
    settlementBatches.push({
      settlementBatchId: payment.reconciliation.settlementBatchId ?? `set_${payment.txnId}`,
      txnId: payment.txnId,
      orderId: payment.orderId,
      status: payment.reconciliation.settlementStatus,
      amountPaise: scenario.amountPaise,
      rrn: payment.rrn,
      createdAt: new Date().toISOString()
    });
    res.status(201).json(payment);
  });

  app.get('/api/payments/:id/status', requirePermission('read'), (req: Request, res: Response) => {
    const payment = paymentById(param(req.params.id));
    if (!payment) {
      res.status(404).json({ error: 'PAYMENT_NOT_FOUND' });
      return;
    }
    res.json({
      txnId: payment.txnId,
      orderId: payment.orderId,
      paymentId: payment.paymentId,
      finalStatus: payment.finalStatus,
      railStatus: payment.adapters.railStatus,
      settlement: payment.reconciliation,
      rrn: payment.rrn,
      timelineEvents: payment.timeline.length
    });
  });

  app.post('/api/payments/:id/simulate-event', requirePermission('write'), (req: Request, res: Response) => {
    const payment = paymentById(param(req.params.id));
    if (!payment) {
      res.status(404).json({ error: 'PAYMENT_NOT_FOUND' });
      return;
    }

    const state = typeof req.body?.state === 'string' ? req.body.state : 'MANUAL_EVENT';
    const actor = typeof req.body?.actor === 'string' ? req.body.actor : 'PAYMENT_AGGREGATOR';
    payment.timeline.push({
      sequence: payment.timeline.length + 1,
      state,
      actor,
      at: new Date().toISOString(),
      reasonCode: typeof req.body?.reasonCode === 'string' ? req.body.reasonCode : 'MANUAL_SCENARIO_EVENT',
      raw: { simulatedBy: 'payment-ecosystem-simulator', body: req.body }
    });
    if (state === 'REVERSAL_SUCCESS') payment.finalStatus = 'REVERSED';
    if (state === 'SUCCESS' || state === 'PAYMENT_CAPTURED') payment.finalStatus = 'SUCCESS';
    res.json(payment);
  });

  app.get('/api/payments/:id/timeline', requirePermission('read'), (req: Request, res: Response) => {
    const payment = paymentById(param(req.params.id));
    if (!payment) {
      res.status(404).json({ error: 'PAYMENT_NOT_FOUND' });
      return;
    }
    res.json({ txnId: payment.txnId, orderId: payment.orderId, timeline: payment.timeline, webhooks: payment.webhooks });
  });

  app.get('/api/reconciliation/batches', requirePermission('read'), (_req: Request, res: Response) => {
    res.json({ batches: settlementBatches, disputes });
  });

  app.post('/api/refunds/initiate', requirePermission('write'), (req: Request, res: Response) => {
    const payment = paymentById(req.body?.txnId ?? req.body?.paymentId ?? '');
    if (!payment) {
      res.status(404).json({ error: 'PAYMENT_NOT_FOUND' });
      return;
    }
    payment.finalStatus = 'REVERSED';
    payment.timeline.push({
      sequence: payment.timeline.length + 1,
      state: 'REVERSAL_PENDING',
      actor: 'PAYMENT_AGGREGATOR',
      at: new Date().toISOString(),
      reasonCode: 'MERCHANT_REFUND_INITIATED',
      raw: { amountPaise: req.body?.amountPaise, reason: req.body?.reason ?? 'CUSTOMER_REFUND' }
    });
    res.status(202).json({ refundId: `refund_${payment.paymentId}`, status: 'REVERSAL_PENDING', payment });
  });

  app.post('/api/disputes/raise', requirePermission('write'), (req: Request, res: Response) => {
    const payment = paymentById(req.body?.txnId ?? req.body?.paymentId ?? '');
    if (!payment) {
      res.status(404).json({ error: 'PAYMENT_NOT_FOUND' });
      return;
    }
    const dispute = disputeSimulator(payment, req.body?.reason);
    disputes.push(dispute);
    res.status(201).json(dispute);
  });

  registerWebhookRoute(app, '/api/webhooks/payment-gateway', 'PG_SIM');
  registerWebhookRoute(app, '/api/webhooks/payment-aggregator', 'PA_SIM');
  registerWebhookRoute(app, '/api/webhooks/tpap', 'TPAP_SIM');
  registerWebhookRoute(app, '/api/webhooks/npci', 'NPCI_SIM');
}

function registerWebhookRoute(app: Express, path: string, provider: WebhookProvider) {
  app.post(path, (req: Request, res: Response) => {
    const signature = req.header('x-webhook-signature') ?? req.body?.signature;
    if (!signature) {
      res.status(400).json({ error: 'WEBHOOK_SIGNATURE_REQUIRED' });
      return;
    }

    const webhook = normalizeWebhook(req.body);
    const result = webhookReceiver.receive(provider, { ...webhook, signature }, JSON.stringify(webhook.payload));
    res.status(result.accepted ? 202 : 401).json(result);
  });
}

function normalizeWebhook(body: Partial<AggregatorWebhook>): AggregatorWebhook {
  const payload = typeof body.payload === 'object' && body.payload ? body.payload : {};
  return {
    eventId: String(body.eventId ?? `manual_${Date.now()}`),
    event: (body.event ?? 'payment.authorized') as AggregatorWebhook['event'],
    orderId: String(body.orderId ?? 'order_unknown'),
    paymentId: String(body.paymentId ?? 'pay_unknown'),
    payload,
    signature: String(body.signature ?? ''),
    createdAt: String(body.createdAt ?? new Date().toISOString())
  };
}

function paymentById(id: string): PaymentSimulationResult | undefined {
  return payments.get(id) ?? [...payments.values()].find((payment) => payment.orderId === id || payment.paymentId === id);
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export function paymentSimulatorSnapshot() {
  return {
    payments: [...payments.values()],
    settlementBatches,
    disputes,
    webhooks: webhookReceiver.all() as WebhookEventStore[]
  };
}
