# 08 - Enterprise Architecture Diagrams

## Capability Stack
```mermaid
flowchart TD
  A[Constitution + Governance] --> B[Platform Core]
  B --> C[Identity + Policy + Audit]
  C --> D[Runtime + Workflow + Events]
  D --> E[AI + Knowledge + Analytics]
  E --> F[Business Domain Capabilities]
  F --> G[Enterprise Applications]
```

## Platform Layers
```mermaid
flowchart TB
  L1[Governance Layer]
  L2[Capability Contract Layer]
  L3[Core Platform Services]
  L4[Intelligence and Automation Layer]
  L5[Application Experience Layer]
  L1 --> L2 --> L3 --> L4 --> L5
```

## Application Composition
```mermaid
flowchart LR
  A[Business Logic] --> C[Enterprise Application]
  B[Genesis Shared Capabilities] --> C
  C --> D[Mission Control + Operations + Users]
```

## Identity Relationships
```mermaid
flowchart TD
  P[Principal] --> I[Identity Subject]
  I --> S[Session]
  I --> M[Membership]
  M --> R[Roles]
  R --> PERM[Permissions]
  PERM --> POL[Policies]
  POL --> DEC[Authorization Decision]
  DEC --> AUD[Audit Record]
```

## Enterprise Services
```mermaid
flowchart LR
  EAR[Enterprise Registry] --> GMC[Mission Control]
  EHC[Enterprise Health] --> GMC
  ID[Identity Platform] --> GMC
  ID --> APPS[Applications]
  RUNTIME[Runtime Services] --> APPS
```

## AI Platform
```mermaid
flowchart TD
  PR[Prompt Registry] --> AI[AI Services]
  KG[Knowledge Graph] --> AI
  RET[Retrieval] --> AI
  AI --> PLAN[Planning]
  AI --> REASON[Reasoning]
  PLAN --> WF[Workflow Automation]
  REASON --> DEC[Decision Support]
```

## Business Platform
```mermaid
flowchart LR
  OPS[Operations] --> BOS[Business Operating System]
  FIN[Finance] --> BOS
  CRM[CRM] --> BOS
  MFG[Manufacturing] --> BOS
  COM[Commerce] --> BOS
  AN[Analytics] --> BOS
```

## Application Lifecycle
```mermaid
flowchart TD
  A[Proposal] --> B[Governance Review]
  B --> C[EAR Registration]
  C --> D[Implementation]
  D --> E[Certification]
  E --> F[Production]
  F --> G[Versioned Evolution]
```

## Capability Dependency Flow
```mermaid
flowchart TD
  GOV[Governance] --> CORE[Platform Core]
  CORE --> ID[Identity]
  CORE --> EVT[Events]
  ID --> APPS[Applications]
  EVT --> AI[AI and Analytics]
  AI --> DOM[Domain Capabilities]
  DOM --> APPS
```

## Long-Term Cloud Architecture
```mermaid
flowchart LR
  TEN[Tenant Control Plane] --> CAP[Capability Services]
  CAP --> APP[Application Planes]
  CAP --> OBS[Observability]
  CAP --> SEC[Security and Compliance]
  OBS --> AUD[Audit and Certification Evidence]
```
