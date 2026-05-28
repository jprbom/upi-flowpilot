# Security

## Data Safety

No live UPI, bank, PSP, Aadhaar, PAN, mobile number, account number, or customer data is used. All records are synthetic.

## Controls Implemented

- Helmet for defensive HTTP headers.
- express-rate-limit for request throttling.
- Zod validation on all write and scoring endpoints.
- RBAC middleware on every API route.
- Signed local demo bearer tokens issued by `/api/auth/demo-token`.
- Raw `x-user-role` headers are ignored for authorization.
- Admin-only destructive operations.
- Unknown or missing roles fall back to read-only `VIEWER`.
- HMAC signatures for simulated payment webhooks.
- Duplicate webhook idempotency and out-of-order event handling.
- CORS origin configurable through CORS_ORIGIN.
- No secrets committed.
- Dependency audit script: npm run audit:high.

## Prototype Boundary

The signed local demo token is still a portfolio auth simulator. It is materially safer than a client-controlled role header, but it is not production identity, SSO, or bank-grade authorization.

A production system would replace this with OIDC, signed JWTs, short-lived sessions, tenant isolation, immutable audit logs, idempotency controls, replay protection, and KMS-backed secret management.
