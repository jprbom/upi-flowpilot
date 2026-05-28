# Observability

## Implemented

- `/api/live`
- `/api/ready`
- `/api/metrics/prometheus`
- E2E report artifact at `artifacts/e2e-report.json`
- Dependency audit through `npm run audit:high`

## Enterprise Metrics

- API latency p50/p95/p99.
- Payment decision latency.
- Payment lifecycle scenario distribution.
- Webhook duplicate, retry, and out-of-order rates.
- Settlement held/ready/settled/reversed counts.
- Domain decision distribution.
- RBAC denial count.
- Model score drift.
- Human review backlog.

## Logging

Enterprise deployment should use JSON logs with `trace_id`, `correlation_id`, `tenant_id`, `user_id`, `role`, `decision_id`, `txn_id`, `order_id`, `payment_id`, and error taxonomy.

