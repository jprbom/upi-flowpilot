# Data Model

The local prototype uses JSON persistence for fast portfolio demos. The enterprise target is PostgreSQL plus Redis and a queue/event bus.

## Enterprise Tables

```text
tenants
users
roles
permissions
payment_events
upi_lifecycle_events
risk_decisions
decision_reason_codes
webhook_events
settlement_batches
refunds
disputes
audit_logs
model_versions
model_predictions
human_reviews
domain_records
```

## Key Controls

- Every mutable record carries `tenant_id`, `created_by`, `updated_by`, `created_at`, and `updated_at`.
- `audit_logs` are append-only and include correlation ID, actor, role, permission, route, entity type, entity ID, before/after hash, and decision ID.
- Payment initiation uses `idempotency_key` and must reject conflicting replays.
- Webhook events are deduped by provider and `event_id`.
- Retention policies separate operational logs, audit records, synthetic training data, and evidence exports.

