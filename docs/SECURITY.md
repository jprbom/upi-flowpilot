# Security

## Data Safety

No live UPI, bank, PSP, Aadhaar, PAN, mobile number, account number, or customer data is used. All records are synthetic.

## Controls Implemented

- Helmet for defensive HTTP headers.
- express-rate-limit for request throttling.
- Zod validation on all write and scoring endpoints.
- RBAC middleware on every API route.
- Admin-only destructive operations.
- Unknown or missing roles fall back to read-only `VIEWER`.
- CORS origin configurable through CORS_ORIGIN.
- No secrets committed.
- Dependency audit script: npm run audit:high.

## Prototype Boundary

The `x-user-role` header is a portfolio RBAC simulator. It is client-controlled and therefore not production authentication or authorization.

A production system would replace this with OIDC, signed JWTs, short-lived sessions, tenant isolation, immutable audit logs, idempotency controls, replay protection, and KMS-backed secret management.
