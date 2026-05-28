# Enterprise Architecture

```mermaid
flowchart LR
  UI["React RBAC Console"] --> API["API Gateway / WAF"]
  API --> AUTH["OIDC + Tenant + Permission Service"]
  API --> APP["Express Domain API"]
  APP --> SIM["Payment Ecosystem Simulator"]
  SIM --> PG["PG Adapter"]
  SIM --> PA["PA Adapter"]
  SIM --> TPAP["TPAP Adapter"]
  SIM --> PSP["PSP/Bank Adapter"]
  SIM --> RAIL["NPCI-style Rail Simulator"]
  APP --> DB["PostgreSQL"]
  APP --> REDIS["Redis"]
  APP --> BUS["Kafka/Event Bus"]
  APP --> OBS["Logs / Metrics / Traces"]
  APP --> ML["Model Registry + Governance"]
```

The public repositories are enterprise-oriented MVPs. They demonstrate the workflow, contracts, simulator, UI, tests, and governance path. Production would replace local JSON and in-memory stores with managed cloud services and regulated integrations.

