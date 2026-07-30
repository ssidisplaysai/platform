# Genesis Commerce Document Architecture Diagram

## Structural View
```mermaid
flowchart TD
  A[GenesisCommerceDocument Base Framework]

  A --> B[Identity and Numbering Contracts]
  A --> C[Lifecycle and Status Contracts]
  A --> D[Revision and Version Contracts]
  A --> E[Parties and Addresses Contracts]
  A --> F[Line Collection Contracts]
  A --> G[Totals and Commercial Envelope]
  A --> H[Attachment and Notes Contracts]
  A --> I[Metadata and Audit Contracts]
  A --> J[Approval and Export Hooks]

  A --> Q[Quote]
  A --> SO[Sales Order]
  A --> PO[Purchase Order]
  A --> RA[Rental Agreement]
  A --> SVO[Service Order]
  A --> WO[Work Order]
  A --> INV[Invoice]
  A --> CM[Credit Memo]
  A --> RMA[Return Authorization]

  Q --> QL[Pricing, Expiration, Negotiation, Conversion]
  SO --> SOL[Fulfillment and Shipping Behavior]
  PO --> POL[Vendor and Procurement Behavior]
  RA --> RAL[Rental Lifecycle Behavior]
  SVO --> SVOL[Service Behavior]
  WO --> WOL[Execution Behavior]
  INV --> INVL[Posting and Payment Behavior]
  CM --> CML[Credit Reversal Behavior]
  RMA --> RMAL[Return Acceptance Behavior]

  K[Reference Domains] --> A
  K1[Customers] --> K
  K2[Products] --> K
  K3[Inventory] --> K
  K4[Sites] --> K
  K5[Integration Profiles] --> K
  K6[Business Genome Entities] --> K
  K7[Marketing Entities] --> K
```

## Boundary View
```mermaid
flowchart LR
  subgraph Framework[GCDF Framework]
    F1[Structure Contracts]
    F2[Lifecycle Contracts]
    F3[Provider Interfaces]
    F4[Audit and Metadata Hooks]
  end

  subgraph Derived[Derived Transactional Documents]
    D1[Quote Rules]
    D2[Order Rules]
    D3[Invoice Rules]
    D4[Rental and Service Rules]
  end

  subgraph Forbidden[Forbidden in Framework]
    X1[Pricing Engines]
    X2[Inventory Reservation]
    X3[Workflow Execution]
    X4[Business Genome Mutation]
    X5[Marketing Kernel Execution]
  end

  Framework --> Derived
  Forbidden -.excluded.-> Framework
```

## Decision
APPROVED. Framework is suitable as canonical base for future transactional document specializations.
