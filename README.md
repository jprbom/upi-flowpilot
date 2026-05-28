<p align="center">
  <img src="docs/assets/hero.svg" width="100%" alt="UPI FlowPilot rich animated hero infographic">
</p>

<p align="center">
  <img src="frontend/public/logo.svg" width="92" alt="UPI FlowPilot animated logo">
</p>

<h1 align="center">UPI FlowPilot</h1>

<p align="center"><strong>Real-time UPI checkout reliability and payment-flow recovery engine.</strong></p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178c6?style=for-the-badge&logo=typescript&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca?style=for-the-badge&logo=react&logoColor=white">
  <img alt="Express" src="https://img.shields.io/badge/Express-5-111827?style=for-the-badge&logo=express&logoColor=white">
  <img alt="Mock UPI" src="https://img.shields.io/badge/NPCI%20UPI-Mocked%20Sandbox-f97316?style=for-the-badge">
  <img alt="Security" src="https://img.shields.io/badge/Audit-0%20High%20Vulns-16a34a?style=for-the-badge&logo=securityscorecard&logoColor=white">
</p>

<p align="center">
  <a href="#concept">Concept</a> &middot;
  <a href="#working-demo">Working Demo</a> &middot;
  <a href="#bfsi--fintech-benefit">BFSI Benefit</a> &middot;
  <a href="#aiml--dl-layer">AIML/DL</a> &middot;
  <a href="#run-locally">Run Locally</a>
</p>

## Concept

UPI FlowPilot is a full-stack UPI-native AI infrastructure prototype. It combines a React RBAC command center, secure Express APIs, CRUD data operations, concept-specific decisioning, and a mocked NPCI/UPI rail response layer. The repo is designed for portfolio demonstration and SDLC review, not live payment processing.

The system uses synthetic data to show how a BFSI or fintech product team could operate real-time upi checkout reliability and payment-flow recovery engine. without touching real customer, bank, PSP, NPCI, or UPI rail data.

## Working Demo

The frontend now has working tabs, CTAs, row drill-downs, create/patch/delete CRUD actions, domain-specific AI decision calls, and a mock UPI/NPCI request-response flow.

| Flow | What works |
| --- | --- |
| RBAC | Role selector sends `x-user-role` to the backend. Admin can perform destructive operations. |
| Tabs | Every sidebar tab changes active content and drill-down context. |
| CRUD | The primary workspace can create, patch, inspect, and delete synthetic records. |
| AI decision | `/recommendations` returns explainable reason codes. |
| Mock UPI | `/api/mock-upi` returns RRN, UPI request id, bank reference, response code, settlement state, and webhook metadata. |

## BFSI / Fintech Benefit

BFSI and fintech teams can use this pattern to reduce failed payments, explain checkout failures, lower support volume, and dynamically recommend the best UPI path before a customer abandons payment.

This project is useful for senior payment, fintech, digital banking, risk, platform, and AI product portfolios because it shows the full product chain: business concept, test data, secure APIs, RBAC, frontend workflows, explainability, model training, CI, documentation, and deployment thinking.

## Architecture

<p align="center">
  <img src="docs/assets/system-map.svg" width="100%" alt="UPI FlowPilot architecture system map">
</p>

~~~mermaid
flowchart LR
  UI["React RBAC Command Center"] --> API["Express API"]
  API --> RBAC["RBAC + Zod + Helmet + Rate Limit"]
  API --> CRUD["Synthetic CRUD Store"]
  API --> AI["Domain AI Decision Engine"]
  API --> MOCK["Mock NPCI/UPI Rail"]
  MOCK --> UI
  AI --> UI
~~~

## AIML / DL Layer

The repository includes working Python code in `ml/train_model.py`.

It trains:

- an explainable logistic-regression AIML baseline
- a compact one-hidden-layer neural-network model as the DL demonstration
- a model-card artifact at `ml/model_card.json`

Run:

```bash
python ml/train_model.py
```

Features used for this concept: `amount`, `bank_success_rate`, `collect_decline_rate`, `risk_score`, `latency_ms`.

## Mock UPI / NPCI API

Example request:

```json
{
  "txnId": "TXN-DEMO-001",
  "payerVpa": "payer@oksbi",
  "payeeVpa": "merchant@upi",
  "amount": 499,
  "flow": "UPI_INTENT",
  "purpose": "portfolio test flow",
  "riskScore": 24,
  "scenario": "HAPPY_PATH"
}
```

The response is intentionally NPCI-like for demos, but fully synthetic:

- `gateway: NPCI_UPI_MOCK`
- `rrn`, `upiRequestId`, `bankRefId`
- `npciStatus`, `responseCode`, `responseMessage`
- settlement and pre-settlement hold metadata
- risk decision and reason codes
- synthetic PSP/bank webhook callback state

## Run Locally

```bash
npm install
npm run verify
npm --workspace backend run start
npm --workspace frontend run preview
python ml/train_model.py
```

Frontend: `http://127.0.0.1:5101`

Backend health: `http://127.0.0.1:4101/api/health`

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Diagrams](docs/DIAGRAMS.md)
- [Security](docs/SECURITY.md)
- [SDLC](docs/SDLC.md)
- [Testing](docs/TESTING.md)

**Author:** Prashant Jagtap <jprbom@gmail.com>
