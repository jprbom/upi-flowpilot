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

- Backend API tests cover domain intelligence behavior, CRUD creation, RBAC denial, and admin-only deletion.
- Backend RBAC tests also verify that unknown/forged roles fall back to read-only `VIEWER`.
- Frontend tests cover formatting and score tone helpers used by the dashboard.
- Local E2E smoke covers page render, sidebar tabs, model CTA, mocked UPI response, create/patch/delete CRUD, read-only RBAC denial, and mobile render smoke.
- Build verifies TypeScript correctness for backend and frontend.

## Current Limits

This is not yet load testing, payment-grade security testing, model validation, browser-matrix testing, or Docker Compose smoke testing. Those are tracked in `docs/PROTOTYPE_AUDIT.md`.
