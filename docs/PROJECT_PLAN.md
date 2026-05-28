# UPI FlowPilot Project Plan

## Goal

Build a private GitHub-ready full-stack portfolio project for UPI FlowPilot.

## Scope

1. Backend API with RBAC, validation, security headers, rate limits, CRUD operations, synthetic persistence, and domain intelligence endpoint.
2. Frontend RBAC dashboard with operational metrics, synthetic data fallback, create/delete flows, and explainability panel.
3. Documentation: README, SDLC, API, architecture, security, testing, and diagrams.
4. Verification: build, unit/API tests, and npm audit.

## Architecture

The frontend calls the Express API through the Vite dev proxy. The API obtains a signed local demo bearer token, enforces role permissions backend-side, validates input with Zod, persists synthetic data to a JSON database, computes domain recommendations through a pure TypeScript engine module, and can run the five-adapter payment ecosystem simulator.

## SDLC Loop

Plan, implement, test, security scan, document, commit, publish private GitHub repo.
