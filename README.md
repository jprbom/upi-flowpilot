<p align="center">
  <img src="docs/assets/hero.svg" width="100%" alt="UPI FlowPilot rich animated hero infographic">
</p>

<p align="center">
  <img src="frontend/public/logo.svg" width="92" alt="UPI FlowPilot animated logo">
</p>

<h1 align="center">UPI FlowPilot</h1>

<p align="center"><strong>Real-time UPI checkout reliability, flow selection, retry, and degradation intelligence for Bharat merchants.</strong></p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178c6?style=for-the-badge&logo=typescript&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca?style=for-the-badge&logo=react&logoColor=white">
  <img alt="Express" src="https://img.shields.io/badge/Express-5-111827?style=for-the-badge&logo=express&logoColor=white">
  <img alt="Security" src="https://img.shields.io/badge/Audit-0%20High%20Vulns-16a34a?style=for-the-badge&logo=securityscorecard&logoColor=white">
  <img alt="Synthetic" src="https://img.shields.io/badge/Data-Synthetic%20Only-f97316?style=for-the-badge">
</p>

<p align="center">
  <a href="#product-story">Product Story</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="#run-locally">Run Locally</a> &middot;
  <a href="#documentation">Documentation</a>
</p>

## Product Story

A payment reliability command center that recommends UPI Intent, QR, Collect, Lite, retry, or risk decline paths using success prediction, bank/PSP degradation signals, and GenAI-style operational explanations.

This is a synthetic-data, portfolio-grade UPI AI infrastructure prototype. It does not connect to live UPI rails, NPCI, PSPs, banks, account aggregators, or real customer data.

**Author:** Prashant Jagtap <jprbom@gmail.com>

## Experience Preview

<p align="center">
  <img src="docs/assets/system-map.svg" width="100%" alt="UPI FlowPilot architecture system map">
</p>

## What Makes It Portfolio-Strong

| Layer | What it demonstrates |
| --- | --- |
| Product thinking | UPI-native workflow, role-aware operating model, and explainable decisioning |
| Frontend | Modern React/Vite command center with animated KPI panels and CRUD controls |
| Backend | Express API with Helmet, CORS, rate limiting, RBAC, Zod validation, and JSON persistence |
| AI simulation | Deterministic domain engine with reason codes and human-readable explanation |
| SDLC | Project plan, API docs, security notes, tests, Docker files, and rich diagrams |

## Core Modules

| # | Module | Flow |
| ---: | --- | --- |
| 1 | Flow optimizer | Payment context |
| 2 | Retry engine | Success prediction |
| 3 | Bank/PSP health | Flow optimizer |
| 4 | UPI Lite fallback | Customer nudge |
| 5 | Failure explainer | Merchant action |

## RBAC Personas

`Ops Manager` `Merchant Analyst` `Support Agent`

Destructive operations are admin-only. Read/write operations are guarded through a role-to-permission map in the backend middleware.

## Architecture

~~~mermaid
flowchart LR
  UI["React RBAC Command Center"]:::ui --> API["Express API"]:::api
  API --> SEC["Helmet + CORS + Rate Limit"]:::sec
  API --> RBAC["RBAC Permission Gate"]:::sec
  API --> VALID["Zod Validation"]:::sec
  API --> CRUD["Payment Events + Routing Rules CRUD"]:::api
  API --> ENGINE["Recommend best UPI rail Engine"]:::ai
  CRUD --> DB[("Synthetic JSON DB")]:::data
  ENGINE --> EXPLAIN["Reason Codes + Explanation"]:::ai
  EXPLAIN --> UI

  classDef ui fill:#ecfeff,stroke:#06b6d4,stroke-width:2px,color:#083344
  classDef api fill:#fff7ed,stroke:#f97316,stroke-width:2px,color:#431407
  classDef sec fill:#fee2e2,stroke:#ef4444,stroke-width:2px,color:#450a0a
  classDef ai fill:#eef2ff,stroke:#06b6d4,stroke-width:2px,color:#1e1b4b
  classDef data fill:#dcfce7,stroke:#22c55e,stroke-width:2px,color:#052e16
~~~

## API Surface

| Purpose | Endpoint |
| --- | --- |
| Health and role catalogue | `GET /api/health` |
| Dashboard metrics | `GET /api/metrics` |
| Domain decision | `POST /api/recommendations` |
| Primary CRUD | `Payment Events` |
| Secondary CRUD | `Routing Rules` |

## Run Locally

~~~bash
npm install
npm run dev:backend
npm run dev:frontend
~~~

Backend: http://127.0.0.1:4101

Frontend: http://127.0.0.1:5171

Preview build: http://127.0.0.1:5101

## Verify

~~~bash
npm run verify
~~~

`npm run verify` runs TypeScript build, backend/frontend tests, and `npm audit --audit-level=high`.

## Documentation

- [Project Plan](docs/PROJECT_PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Security](docs/SECURITY.md)
- [Testing](docs/TESTING.md)
- [Rich Diagrams](docs/DIAGRAMS.md)

## Repository

`upi-flowpilot`

