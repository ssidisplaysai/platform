# Genesis Business Agent Sequence Diagrams

## 1) Lead -> Customer
```mermaid
sequenceDiagram
  participant M as Marketing Agent
  participant S as Sales Agent
  participant D as Enterprise Domain
  participant E as Executive Agent

  M->>S: Publish lead quality and engagement intelligence
  S->>D: Resolve canonical customer/account references (read)
  S->>S: Update owned pipeline/account intelligence
  S-->>E: Publish pipeline and conversion KPI signals
  E->>E: Aggregate cross-agent enterprise narrative
```

## 2) Customer -> Invoice
```mermaid
sequenceDiagram
  participant D as Enterprise Domain
  participant S as Sales Agent
  participant F as Finance Agent
  participant E as Executive Agent

  S->>D: Read canonical customer and commercial context
  S-->>F: Publish booking/forecast intelligence (read signal)
  F->>F: Generate owned AR/invoice intelligence
  F-->>E: Publish financial KPI and risk summary
  E->>E: Aggregate enterprise reporting
```

## 3) Manufacturing -> Finance
```mermaid
sequenceDiagram
  participant O as Operations Agent
  participant MFG as Manufacturing Agent
  participant F as Finance Agent
  participant E as Executive Agent

  O-->>MFG: Provide demand and execution context
  MFG->>MFG: Compute throughput, quality, and costing intelligence
  MFG-->>F: Publish cost and production intelligence
  F->>F: Recompute profitability and forecast outputs
  F-->>E: Publish financial impact summary
```

## 4) Marketing -> Sales
```mermaid
sequenceDiagram
  participant M as Marketing Agent
  participant S as Sales Agent
  participant E as Executive Agent

  M->>M: Compute campaign and engagement intelligence
  M-->>S: Publish demand and intent signals
  S->>S: Update owned forecast/account intelligence
  S-->>E: Publish conversion and pipeline outcomes
```

## 5) Customer Success -> Executive
```mermaid
sequenceDiagram
  participant CS as Customer Success Agent
  participant S as Sales Agent
  participant F as Finance Agent
  participant E as Executive Agent

  CS->>S: Read account context (read-only)
  CS->>F: Read renewal and risk context (read-only)
  CS->>CS: Compute health, renewal, and churn intelligence
  CS-->>E: Publish customer health and retention signals
  E->>E: Aggregate retention impact in executive briefings
```

## 6) Recommendation Generation
```mermaid
sequenceDiagram
  participant A as Owning Business Agent
  participant R as Runtime
  participant X as Consumer Agent
  participant E as Executive Agent

  A->>R: Generate owned recommendation and lineage
  R->>A: Persist recommendation in owner repository
  A-->>X: Publish recommendation summary event
  A-->>E: Publish recommendation summary event
  Note over X,E: Consumption is read-only; no external mutation allowed
```

## 7) Executive Reporting
```mermaid
sequenceDiagram
  participant O as Operations Agent
  participant MFG as Manufacturing Agent
  participant M as Marketing Agent
  participant S as Sales Agent
  participant F as Finance Agent
  participant CS as Customer Success Agent
  participant E as Executive Agent

  O-->>E: Publish operational KPIs and health
  MFG-->>E: Publish production/cost KPIs and health
  M-->>E: Publish campaign/engagement KPIs and health
  S-->>E: Publish pipeline/forecast KPIs and health
  F-->>E: Publish financial KPIs and health
  CS-->>E: Publish retention/renewal KPIs and health
  E->>E: Synthesize enterprise report and priorities
```
