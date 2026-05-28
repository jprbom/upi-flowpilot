# Prototype Audit Response

## Honest Status

UPI FlowPilot is a runnable portfolio-grade prototype, not a production UPI platform. It demonstrates checkout reliability decisioning, synthetic CRUD workflows, RBAC simulation, a mocked UPI/NPCI response, tests, CI, Docker packaging, and SDLC documentation.

It should be presented as: **a UPI-native payment reliability product prototype with synthetic data and explainable rule-based decisioning.**

It should not be presented as: **a production-ready payment router or certified UPI switch integration.**

## What Is Real Today

- React dashboard with working tabs, CTAs, drill-downs, CRUD, and RBAC role selection.
- Express API with Zod validation, Helmet, rate limiting, CORS, and permission middleware.
- Mock NPCI/UPI rail returning RRN, UPI request id, bank reference, response code, settlement state, risk decision, reason codes, and callback metadata.
- Local JSON persistence for demo review.
- Backend tests, frontend helper tests, local browser E2E smoke script, Docker files, and CI verify workflow.
- Python ML/DL training demonstration that creates a model-card artifact from synthetic data.

## Prototype Boundaries

- RBAC is a simulator. It uses `x-user-role`; production would require OIDC/JWT, signed sessions, tenant isolation, KMS-backed secrets, and immutable audit logs.
- The decision engine is deterministic scoring, not a deployed ML model.
- The ML script is educational and synthetic, not statistically valid payment model training.
- Persistence is JSON file storage, not PostgreSQL, Kafka, Redis, ledger storage, or event sourcing.
- The UPI rail is fully mocked and does not connect to NPCI, PSPs, banks, UDIR, settlement, mandates, or UPI Lite infrastructure.

## Serious Upgrade Path

- Add `payment_attempts`, `bank_health_windows`, `psp_health_windows`, and `merchant_routing_policies`.
- Implement rolling degradation detection using success rate, timeout rate, p95 latency, and issuer/PSP split.
- Add idempotency keys, duplicate callback handling, retry-window logic, and settlement reconciliation states.
- Add a domain scenario matrix for low, medium, and high reliability-risk conditions.
- Promote local E2E into CI using a managed browser image when the repo is ready for longer CI runs.

