# Diagrams

## Architecture

~~~mermaid
flowchart LR
  User["Role-aware dashboard user"] --> UI["React Vite frontend"]
  UI --> API["Express API"]
  API --> RBAC["RBAC middleware"]
  API --> VALID["Zod validation"]
  API --> ENGINE["Domain intelligence engine"]
  API --> DB[("Synthetic JSON database")]
  ENGINE --> EXPLAIN["Reason codes and explanation"]
  EXPLAIN --> UI
  classDef ui fill:#ecfeff,stroke:#0891b2,color:#083344
  classDef api fill:#fff7ed,stroke:#f97316,color:#431407
  classDef sec fill:#fee2e2,stroke:#dc2626,color:#450a0a
  classDef data fill:#ecfdf5,stroke:#059669,color:#052e16
  class UI ui
  class API,ENGINE,EXPLAIN api
  class RBAC,VALID sec
  class DB data
~~~

## Data Flow Diagram

~~~mermaid
flowchart TD
  A["Synthetic input or CRUD form"] --> B["Request validation"]
  B --> C{"Role has permission?"}
  C -- No --> D["403 RBAC_DENIED"]
  C -- Yes --> E["Route handler"]
  E --> F[("JSON persistence")]
  E --> G["Domain engine"]
  G --> H["Reason codes"]
  F --> I["Dashboard response"]
  H --> I
  classDef start fill:#e0f2fe,stroke:#0284c7,color:#082f49
  classDef guard fill:#fef3c7,stroke:#d97706,color:#451a03
  classDef stop fill:#fee2e2,stroke:#ef4444,color:#450a0a
  classDef data fill:#dcfce7,stroke:#16a34a,color:#052e16
  class A,I start
  class B,C,E,G,H guard
  class D stop
  class F data
~~~

## Deployment

~~~mermaid
flowchart LR
  Dev["Developer workstation"] --> Git["Private GitHub repo"]
  Git --> CI["Build and test workflow"]
  CI --> Image["Container image optional"]
  Image --> Runtime["Node runtime"]
  Runtime --> Backend["Backend on port 4101"]
  Runtime --> Frontend["Static frontend preview on port 5101"]
  Backend --> Store[("Mounted JSON DB")]
  classDef repo fill:#ede9fe,stroke:#7c3aed,color:#2e1065
  classDef build fill:#fef3c7,stroke:#ca8a04,color:#422006
  classDef run fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
  classDef data fill:#dcfce7,stroke:#16a34a,color:#052e16
  class Git repo
  class CI,Image build
  class Runtime,Backend,Frontend run
  class Store data
~~~

## Integration Flow

~~~mermaid
sequenceDiagram
  participant User as Dashboard User
  participant UI as React UI
  participant API as Express API
  participant RBAC as RBAC
  participant Engine as Domain Engine
  participant DB as JSON DB
  User->>UI: Select role and submit action
  UI->>API: Request with x-user-role
  API->>RBAC: Check permission
  RBAC-->>API: Allow or deny
  API->>DB: Read or write synthetic record
  API->>Engine: Compute recommendation or score
  Engine-->>API: Reason codes and explanation
  API-->>UI: JSON response
  UI-->>User: Updated dashboard state
~~~

## API Flow

~~~mermaid
flowchart LR
  H["GET /api/health"] --> Status["service and roles"]
  M["GET /api/metrics"] --> KPI["dashboard KPIs"]
  C["CRUD endpoints"] --> Persist["create/read/update/delete"]
  D["Domain endpoint"] --> Score["recommendation or score"]
  classDef route fill:#f0f9ff,stroke:#0284c7,color:#082f49
  classDef result fill:#f7fee7,stroke:#65a30d,color:#1a2e05
  class H,M,C,D route
  class Status,KPI,Persist,Score result
~~~

## RBAC

~~~mermaid
flowchart TD
  Role["Selected role"] --> Read["read"]
  Role --> Write{"write?"}
  Role --> Admin{"admin?"}
  Write --> Create["create and patch"]
  Admin --> Delete["delete"]
  classDef role fill:#eef2ff,stroke:#4f46e5,color:#1e1b4b
  classDef ok fill:#dcfce7,stroke:#16a34a,color:#052e16
  classDef danger fill:#fee2e2,stroke:#dc2626,color:#450a0a
  class Role role
  class Read,Create ok
  class Delete danger
~~~

