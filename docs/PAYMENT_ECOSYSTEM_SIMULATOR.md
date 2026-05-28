# Payment Ecosystem Simulator

This repository does **not** use live NPCI, bank, PSP, TPAP, payment aggregator, or payment gateway APIs.

It implements a public-safe payment ecosystem simulator inspired by common payment lifecycle patterns:

- UPI rail lifecycle states such as validation, customer approval, timeout, deemed pending, risk hold, reversal, dispute, and settlement.
- TPAP customer authorization behaviour such as app switch, collect display, customer retry, PIN entry, app drop, timeout, and success callback.
- PSP/bank success, timeout, decline, throttling, daily-limit, and outage states.
- Payment aggregator order, attempt, capture, retry, webhook, refund, dispute, and settlement patterns.
- Payment gateway hosted checkout/session style flow with synthetic redirect URLs and payment mode configuration.
- Webhook HMAC signing, duplicate delivery handling, out-of-order delivery, and terminal-state governance.

Real production integration requires approved partner access, certification, security review, contracts, keys, certificates, regulated sandbox access, and go-live approval.

## Implemented Backend Surface

```text
POST /api/payments/initiate
GET  /api/payments/:id/status
POST /api/payments/:id/simulate-event
POST /api/webhooks/payment-gateway
POST /api/webhooks/payment-aggregator
POST /api/webhooks/tpap
POST /api/webhooks/npci
GET  /api/payments/:id/timeline
GET  /api/reconciliation/batches
POST /api/refunds/initiate
POST /api/disputes/raise
```

## Implemented Scenarios

| Scenario | Expected result | Why it matters |
| --- | --- | --- |
| `HAPPY_PATH` | Captured and settled | Normal checkout |
| `CUSTOMER_DECLINED` | Failed | User cancels or wrong PIN |
| `BANK_TIMEOUT` | Deemed pending | Payment ambiguity |
| `LATE_SUCCESS_AFTER_FAILURE` | Failed webhook then captured webhook | UPI retry realism |
| `PSP_DOWN` | Failed with degradation metadata | PSP/bank health and fallback |
| `DUPLICATE_REQUEST` | Duplicate detected | Double-debit prevention |
| `VPA_INVALID` | Validation failure | QR/VPA mismatch |
| `INSUFFICIENT_FUNDS` | Issuer decline | Bank-side decline |
| `RISK_HOLD` | Pre-settlement hold | Fraud interdiction |
| `REVERSAL` | Success then reversal | Refund/dispute/reconciliation |
| `WEBHOOK_DUPLICATE` | Duplicate event ignored | Idempotent webhook handling |
| `WEBHOOK_OUT_OF_ORDER` | Terminal success wins | Enterprise webhook robustness |

## Module Map

```text
backend/src/payments/
  contracts.ts
  paymentScenario.ts
  paymentLifecycle.ts
  paymentRoutes.ts
  adapters/
    npciMockAdapter.ts
    tpapMockAdapter.ts
    pspBankMockAdapter.ts
    paymentAggregatorMockAdapter.ts
    paymentGatewayMockAdapter.ts
  webhooks/
    webhookSigner.ts
    webhookDispatcher.ts
    webhookReceiver.ts
  reconciliation/
    settlementSimulator.ts
    disputeSimulator.ts
  tests/
    README.md
```

Executable tests live under `backend/tests/` and cover lifecycle, adapter contracts, webhook idempotency, and payment terminal-state handling.

