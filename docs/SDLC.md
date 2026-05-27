# SDLC

## Requirements

- Demonstrate a UPI-native AI product with frontend, backend, API, DB, CRUD, RBAC, tests, and security posture.
- Keep all data synthetic and privacy-safe.
- Attribute authorship only to Prashant Jagtap <jprbom@gmail.com>.

## Design

The project is separated into backend, frontend, data, and documentation. Domain logic is isolated from HTTP routes so tests can verify intelligence behavior without browser dependencies.

## Implementation

- Backend: Express 5, Zod, Helmet, CORS, express-rate-limit, JSON database.
- Frontend: React 19, Vite, lucide icons, responsive CSS, role switcher.
- Tests: Vitest for backend API behavior and frontend view helpers.

## Verification

Run npm run verify from the repository root. This executes TypeScript builds, tests, and high-severity dependency audit.

## Release

The repository is private by default. Main branch contains a runnable portfolio release.

