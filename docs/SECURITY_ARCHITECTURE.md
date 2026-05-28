# Security Architecture

## Implemented In Prototype

- Helmet HTTP headers.
- CORS allow-list support through `CORS_ORIGIN`.
- Express body-size limits.
- Rate limiting.
- Zod validation in domain routes.
- Signed local demo bearer tokens.
- Backend permission checks for read/write/admin actions.
- HMAC webhook signature verification.

## Enterprise Target

- OIDC/JWT validation from an enterprise identity provider.
- Backend-side tenant, role, and permission resolution.
- Short session lifetime and token revocation.
- KMS-backed secrets.
- Immutable audit logging.
- Maker-checker for destructive and high-risk decisions.
- Row-level tenant isolation in PostgreSQL.
- WAF, mTLS for internal service calls, and private networking.
- Secret scanning, SAST, dependency scanning, container scanning, and IaC scanning in CI.

