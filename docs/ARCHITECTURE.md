# Architecture

UPI FlowPilot uses a split React and Express architecture with a public-safe payment ecosystem simulator.

## Components

- React dashboard: RBAC role switcher, KPI cards, command panels, tables, CRUD actions, and Payment Ecosystem Timeline.
- Express API: health, metrics, CRUD, domain intelligence, signed demo auth, payment lifecycle, webhooks, refund, dispute, and reconciliation endpoints.
- RBAC middleware: signed local demo bearer tokens and role-to-permission mapping.
- JSON persistence: deterministic synthetic DB file for local demos.
- Domain engine: checkout success, flow recommendation, retry, and degradation reason-code simulator.
- Payment ecosystem simulator: PG, PA, TPAP, PSP/bank, and NPCI-style rail adapters with HMAC webhooks and idempotency.
- AIML/DL artifacts: 10,000-row synthetic training harness with model card, metrics, and feature importance.

## Runtime Ports

- Backend: 4101
- Frontend dev server: 5171
- Frontend preview server: 5101

