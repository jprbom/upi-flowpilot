<p align="center">
  <img src="frontend/public/logo.svg" width="96" alt="UPI FlowPilot logo">
</p>

# UPI FlowPilot

Real-time UPI checkout reliability, flow selection, retry, and degradation intelligence for Bharat merchants.

Author: Prashant Jagtap <jprbom@gmail.com>

## Portfolio Positioning

A payment reliability command center that recommends UPI Intent, QR, Collect, Lite, retry, or risk decline paths using success prediction, bank/PSP degradation signals, and GenAI-style operational explanations.

This repo uses synthetic UPI-style data only. It is designed as an India-scale payment AI infrastructure prototype, not as a production integration with NPCI, PSPs, banks, account aggregators, or live UPI rails.

## Highlights

- TypeScript Express backend with RBAC, Helmet, CORS controls, rate limiting, Zod validation, and JSON persistence.
- React and Vite frontend with role-aware operations dashboard, animated KPI panels, CRUD controls, and model explanation surface.
- Domain engine endpoint at /api/recommendations.
- DB-backed CRUD for payment events and routing rules.
- Documentation set covering SDLC, API, security, testing, deployment, and diagrams.
- Mermaid diagrams for architecture, DFD, deployment, integration, API flow, and RBAC.

## Run Locally

~~~bash
npm install
npm run dev:backend
npm run dev:frontend
~~~

Backend: http://127.0.0.1:4101

Frontend: http://127.0.0.1:5171

## Verify

~~~bash
npm run build
npm run test
npm run audit:high
~~~

## Repo Name

upi-flowpilot

