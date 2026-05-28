# Threat Model

| Threat | Prototype Control | Enterprise Control |
| --- | --- | --- |
| Forged role header | Ignored; signed demo bearer token required | OIDC/JWT plus backend role lookup |
| Duplicate payment request | Idempotency key index | DB unique constraint and replay conflict rules |
| Duplicate webhook | Event ID dedupe | Durable webhook event store |
| Out-of-order webhook | Terminal success/captured wins | Event-sourced payment state machine |
| Payload tampering | Zod and HMAC webhook verification | Schema validation, signatures, mTLS |
| Tenant data leakage | Demo-only single tenant | Row-level security and tenant-scoped queries |
| Model misuse | Synthetic-only model card | Model governance, approval, monitoring |
| Sensitive data exposure | No live UPI/NPCI/customer data | Tokenization, masking, DLP, retention |

