# Testing

## Commands

~~~bash
npm run build
npm run test
npm run audit:high
npm run test:e2e:local
~~~

`npm run test:e2e:local` expects backend and frontend to be running locally. It launches the installed system Chrome through Playwright Core and drives the live dashboard.

## Coverage Intent

- Backend API tests cover domain intelligence behavior, CRUD creation, RBAC denial, admin-only deletion, and signed-token role enforcement.
- Backend RBAC tests also verify that unknown/forged role headers fall back to read-only `VIEWER`.
- Payment ecosystem tests cover lifecycle success, late-success-after-failure retry, risk hold, adapter contract, webhook idempotency, and out-of-order terminal-state handling.
- Frontend tests cover formatting and score tone helpers used by the dashboard.
- Local E2E smoke covers page render, sidebar tabs, model CTA, mocked UPI response, Payment Ecosystem Timeline, create/patch/delete CRUD, read-only RBAC denial, and mobile render smoke.
- Build verifies TypeScript correctness for backend and frontend.

## Current Limits

This is not yet load testing, formal payment-grade security testing, cross-browser matrix testing, or regulated integration certification. Those are tracked in `docs/PROTOTYPE_AUDIT.md`.
