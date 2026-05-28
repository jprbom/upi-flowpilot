# API Contract

All APIs are synthetic demo APIs under `/api`. Write operations require a signed local demo bearer token from `POST /api/auth/demo-token`.

## Payment Ecosystem

```text
POST /api/payments/initiate
GET  /api/payments/:id/status
POST /api/payments/:id/simulate-event
GET  /api/payments/:id/timeline
GET  /api/reconciliation/batches
POST /api/refunds/initiate
POST /api/disputes/raise
POST /api/webhooks/payment-gateway
POST /api/webhooks/payment-aggregator
POST /api/webhooks/tpap
POST /api/webhooks/npci
```

## Request Example

```json
{
  "amountPaise": 249900,
  "purpose": "synthetic checkout",
  "flow": "UPI_INTENT",
  "scenario": "LATE_SUCCESS_AFTER_FAILURE",
  "riskScore": 32
}
```

## Response Guarantees

- The response includes `txnId`, `orderId`, `paymentId`, `finalStatus`, `timeline`, `webhooks`, `reconciliation`, and adapter metadata.
- No response contains live VPA, account, phone, card, bank, PSP, or NPCI confidential data.
- Webhook receiver requires HMAC signatures and ignores duplicate `eventId` values.
- Terminal captured/success state wins over earlier failed/pending webhook events.

