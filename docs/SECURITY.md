# Security

## Data Safety

No live UPI, bank, PSP, Aadhaar, PAN, mobile number, account number, or customer data is used. All records are synthetic.

## Controls Implemented

- Helmet for defensive HTTP headers.
- express-rate-limit for request throttling.
- Zod validation on all write and scoring endpoints.
- RBAC middleware on every API route.
- Admin-only destructive operations.
- CORS origin configurable through CORS_ORIGIN.
- No secrets committed.
- Dependency audit script: npm run audit:high.

## Known Prototype Boundaries

The x-user-role header is a portfolio RBAC simulator. A production system would replace it with OIDC, signed JWTs, short-lived sessions, tenant isolation, audit log immutability, and KMS-backed secret management.

