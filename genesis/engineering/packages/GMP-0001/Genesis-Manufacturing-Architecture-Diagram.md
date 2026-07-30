# Genesis Manufacturing Architecture Diagram

## Manufacturing Authority And Integration View
```mermaid
flowchart LR
    C[Genesis Commerce Platform]\nCommercial Authority
    M[Genesis Manufacturing Platform]\nProduction Authority
    I[Genesis Inventory Platform]\nStock Authority
    F[Genesis Finance Platform]\nAccounting Authority
    S[Genesis Shipping Platform]\nDelivery Authority

    C -- OrderCreated / OrderReleased / OrderCancelled / OrderRevised --> M
    M -- Material allocation request --> I
    M -- Material consumption record --> I
    M -- Finished goods receipt request --> I
    M -- Manufacturing KPIs and events --> F
    I -- Available stock and receipts status --> S

    subgraph SharedServices[Shared Services]
      ID[Identity]
      WF[Workflow]
      MSG[Messaging]
      SCH[Scheduling]
      NTF[Notifications]
      SRCH[Search]
      DOC[Documents]
      MED[Media]
      TEL[Telemetry]
      OBS[Observability]
      CFG[Configuration]
      SEC[Secrets]
      AI[AI]
      HLT[Health]
    end

    ID --> M
    WF --> M
    MSG --> M
    SCH --> M
    NTF --> M
    SRCH --> M
    DOC --> M
    MED --> M
    TEL --> M
    OBS --> M
    CFG --> M
    SEC --> M
    AI --> M
    HLT --> M

    M -. no direct persistence access .- C
    M -. no inventory authority duplication .- I
    M -. no invoicing, payments, or shipping ownership .- F
```

## Boundary Notes
1. Manufacturing consumes Commerce contracts only.
2. Manufacturing requests inventory actions; Inventory remains quantity authority.
3. Manufacturing does not own invoicing, payments, or shipping operations.
