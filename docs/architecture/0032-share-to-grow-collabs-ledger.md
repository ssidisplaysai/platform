# ADR-0032: Genesis Share-to-Grow / Collabs Ledger

## Status

PROPOSED FOR ACCEPTANCE

## Date

2026-10-05

## Context

Genesis already contains a Partner & QR Identity Engine covering partner identity, QR tracking, referral events, attribution records, commissions, payouts, permissions, dashboards, and events.

STONER's Share-to-Grow business model requires a stronger collaboration economics capability:

- permanent Genesis-managed QR and short-link identities;
- collaborators who may recruit one compensated creator layer;
- multi-channel commerce ingestion;
- deterministic attribution with explicit precedence;
- line-item profit waterfalls;
- versioned collaboration economics;
- append-only economic ledger history;
- transparent but permission-bounded collaborator/creator views;
- payout clearing and reconciliation;
- AWS deployment without laptop-specific state.

Creating a separate affiliate or STONER-only subsystem would duplicate canonical Genesis capabilities and fragment attribution and payout logic.

RAR-0002 and ARD-0002 define the proposed extension and its invariants.

## Decision

Genesis SHALL extend the existing Partner & QR Identity Engine into a reusable **Share-to-Grow / Collabs Ledger** capability.

### Decision 1: Extend, Do Not Duplicate

The existing Partner & QR Identity Engine remains canonical for partner, QR/referral, attribution, commission/payout concepts, permissions, dashboards, and related events.

Share-to-Grow may extend those models, but SHALL NOT introduce a parallel:
- QR identity engine;
- affiliate engine;
- event bus;
- tenant/identity platform;
- payout ledger authority.

### Decision 2: Genesis Is the Attribution and Economic Authority

Commerce platforms and sales channels report orders, line items, refunds, fees, and source metadata.

Genesis determines:
1. qualified attribution evidence;
2. selected attribution source;
3. applicable economic-rule version;
4. distributable merchandise profit;
5. participant allocations;
6. ledger postings;
7. payout-accounting eligibility.

External commerce systems are not the system of record for collaboration economics.

### Decision 3: Stable Tracking Identity, Mutable Destination

A Genesis tracking identity is durable after issuance.

A printed QR code or shared short link SHALL resolve through Genesis so its destination can change without replacing the identity.

Destination changes are versioned and auditable.

### Decision 4: One Compensated Creator Layer in v1

The supported hierarchy is:

Brand -> Vertical -> Founding Collaborator -> Recruited Creator -> Customer

A recruited creator may not create another compensated downstream creator relationship in v1.

This prevents an unlimited economic tree while preserving Daniel's ability to recruit and benefit from creators he brings into STONER GYM.

### Decision 5: Attribution Policy Is Versioned Configuration

Genesis SHALL retain:
- first touch;
- last qualified touch;
- conversion source;
- selected source;
- policy version;
- decision reason.

The initial STONER GYM policy is a configurable 30-day window using last qualified collaborator/creator touch, subject to verified channel-source precedence defined by the policy version.

If no qualified source exists, the sale is organic/unattributed.

Historical attribution decisions are not silently rewritten by future policy changes.

### Decision 6: Economics Are Line-Item, Versioned, and Deterministic

Economic allocation occurs at order-line granularity.

Distributable merchandise profit is computed from explicit configured components, including as applicable:
- gross merchandise amount;
- discounts;
- refunds/returns;
- product COGS;
- allocated inbound freight/duty;
- direct fulfillment/packaging;
- payment-processing fees.

Monetary values SHALL use integer minor units plus ISO currency. Floating-point money arithmetic is prohibited.

Every allocation SHALL reference the immutable economic-rule version used.

### Decision 7: Initial STONER GYM Economics Are Configuration, Not Code

Reference configuration:

**Daniel direct attributed sale**
- STONER: 50%
- Daniel: 50%

**Sale attributed to a creator recruited by Daniel**
- STONER: 50%
- Creator: 35%
- Daniel: 15%

**Organic/unattributed STONER GYM**
- STONER: 100%

These percentages SHALL NOT be hard-coded into platform logic. Product-, capsule-, campaign-, or agreement-specific rule versions may override them.

### Decision 8: Ledger History Is Append-Only

Posted ledger entries SHALL NOT be edited or deleted.

Refunds, chargebacks, corrections, and contractual adjustments create explicit reversing or adjusting entries linked to prior economic facts.

Materialized balances may be derived for performance, but ledger history remains the source of economic truth.

### Decision 9: Open Ledger Means Scoped Transparency

Open-ledger access exposes the calculation and history a participant is authorized to see.

It does not expose all STONER financial information.

- administrators may see authorized tenant/brand scope;
- founding collaborators may see their own economics and explicitly permitted recruited-creator views;
- creators may see their own attribution, allocations, adjustments, balances, and statements;
- customer PII and unrelated partner/company economics remain protected.

### Decision 10: Payout Accounting Precedes Automated Money Movement

Genesis SHALL support:

Pending -> Cleared -> Payable -> Paid

Payout statements must reconcile exactly to included ledger entries.

Automated ACH or other payment execution is out of scope until the ledger and reconciliation model have been proven and separately approved.

### Decision 11: AWS Is the Production Destination

Implementation SHALL follow existing Genesis AWS architecture and staging conventions rather than create a new cloud stack.

Target production characteristics include:
- PostgreSQL/RDS transactional persistence;
- existing Genesis identity/security context;
- durable asynchronous processing using existing AWS/event conventions;
- S3 for generated artifacts/statements where needed;
- Secrets Manager for credentials;
- CloudWatch for telemetry;
- GitHub-versioned migrations and infrastructure;
- no laptop-specific production state.

### Decision 12: STONER GYM + Daniel Is the First Reference Implementation

STONER GYM and Daniel validate the capability, but are data/configuration rather than architectural dependencies.

The same subsystem must support future STONER verticals/collaborators and other Genesis-powered brands without code forks.

## Consequences

### Positive

- Reuses existing Genesis partner and QR architecture.
- Establishes a single attribution and collaboration-economic authority.
- Makes QR codes and links durable, measurable assets.
- Supports transparent collaborator economics without exposing unrelated company accounting.
- Makes refunds, adjustments, and payout statements auditable.
- Prevents historical economics from changing when rules change.
- Provides a reusable platform capability rather than a STONER-only feature.
- Aligns with the AWS migration and removes laptop dependence.

### Negative

- Financial correctness introduces stricter transactional and testing requirements than the existing referral model.
- Commerce adapters must normalize different refund, fee, discount, and source-data behaviors.
- Append-only ledger corrections are more complex than editing balances.
- Participant permission scopes require careful policy and authorization tests.
- Automated payouts are intentionally delayed until proof is complete.

### Mitigations

- integer minor-unit arithmetic;
- immutable rule versions;
- line-item allocation;
- idempotent ingestion;
- explicit attribution provenance;
- append-only reversals;
- exact reconciliation assertions;
- authorization isolation tests;
- AWS staging proof;
- required production proof suite before live payout automation.

## Implementation Authority

Upon acceptance of this ADR:

1. RAR-0002 and ARD-0002 become the approved architecture baseline for this capability.
2. A scoped implementation branch may be created from the approved Genesis baseline.
3. Initial implementation SHALL begin with schema/contracts and deterministic ledger tests before UI or automatic payment execution.
4. Existing Genesis infrastructure, runtime, identity, event, and AWS conventions must be reused.
5. Any material departure from these decisions requires a new architecture review or explicit ADR amendment.

## Required First Implementation Sequence

1. Schema and migration contracts.
2. Economic-rule version model.
3. Ledger primitives and reconciliation invariants.
4. Commerce normalization/idempotency.
5. Tracking identity and destination versioning.
6. Attribution policy engine.
7. STONER GYM reference configuration.
8. Collaborator/creator scoped ledger APIs.
9. Payout statement accounting.
10. AWS staging proof.
11. STONERUSA.com commerce integration.
12. UI/dashboard.
13. Separate approval for automated payment execution.

## Acceptance Criteria

Before production activation, the implementation must prove at least the twenty scenarios defined in RAR-0002, including:
- Daniel direct 50/50 allocation;
- recruited creator 50/35/15 allocation;
- attribution precedence;
- expiration to organic;
- multi-line orders;
- discounts;
- partial and full refunds;
- post-payment recovery entries;
- webhook replay idempotency;
- mutable QR destination with stable identity;
- authorization isolation;
- rule-history immutability;
- exact rounding reconciliation;
- manual/POS attribution;
- out-of-order event reconciliation;
- exact payout-statement reconciliation.

## References

- GitHub Issue #72 - Genesis Share-to-Grow / Collabs Ledger
- RAR-0002 - Share-to-Grow / Collabs Ledger Architecture Review
- ARD-0002 - Share-to-Grow / Collabs Ledger Architecture Requirements & Definition
- Genesis Partner & QR Identity Engine v1
- Genesis Identity & Tenant Platform v1
- Genesis Event Engine
- Genesis Engineering Handbook

---

**Decision state:** Proposed for acceptance  
**Implementation begins only after this ADR is accepted through repository governance.**
