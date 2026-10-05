# Request for Architecture Review - Genesis Share-to-Grow / Collabs Ledger v1

**Document ID:** RAR-0002  
**Title:** Request for Architecture Review - Genesis Share-to-Grow / Collabs Ledger v1  
**Date:** October 5, 2026  
**Status:** Under Review  
**Subject:** Extension of Genesis Partner & QR Identity Engine for collaboration economics  
**Prepared By:** Genesis Architecture  
**Review Stage:** Pre-Implementation Governance Review  
**Tracking:** GitHub Issue #72

---

## Executive Summary

Genesis already contains a production-ready Partner & QR Identity Engine covering partners, QR identity, referral events, sales attribution, commissions, payouts, permissions, dashboards, and audit-oriented events. Share-to-Grow MUST extend that canonical capability rather than create a parallel affiliate or QR subsystem.

The proposed extension adds the requirements needed for STONER collaboration economics: durable redirect identities, collaborators with one recruited-creator layer, line-item commerce ingestion, deterministic attribution precedence, versioned profit waterfalls, append-only economic ledger entries, permission-bounded open-ledger views, and payout clearing/reconciliation.

**Review recommendation:** APPROVE FOR ARCHITECTURE DEFINITION, subject to the invariants and implementation gates in this review.

## 1. Purpose and Scope

The first reference implementation is STONER -> STONER GYM -> Daniel -> recruited creator -> customer. Daniel and STONER GYM are configuration/data, not hard-coded platform concepts.

In scope:
1. Reuse/extension of Partner, PartnerAccount, PartnerQRCode, Campaign, ReferralEvent, SaleEvent, AttributionRecord, CommissionRule, and PartnerPayout.
2. Collaboration/vertical membership and a single recruited-creator economic relationship.
3. Durable Genesis-managed tracking identities for QR and short links.
4. Order and order-line ingestion from multiple commerce channels.
5. Attribution resolution with stored first touch, last qualified touch, and conversion source.
6. Versioned economic rules and deterministic line-item allocation.
7. Append-only ledger events and reversal/adjustment entries.
8. Permission-bounded collaborator/creator ledger views.
9. Pending -> Cleared -> Payable -> Paid payout accounting.
10. AWS-ready persistence and event integration.

Out of scope for v1:
1. Unlimited creator/downline trees.
2. Automated ACH or other money movement.
3. General accounting/ERP replacement.
4. Cross-brand customer identity graph beyond what is required for attribution.
5. Hard-coded STONER, Daniel, or creator economics.

## 2. Existing Architecture Reuse

The canonical Partner & QR Identity Engine remains authoritative for partner identity, QR identity, referral events, attribution concepts, commission/payout concepts, permissions, dashboard contracts, and domain events.

Share-to-Grow extends these concepts where the existing model is insufficient:
- PartnerQRCode.url becomes a mutable destination behind a stable tracking identity; printed QR identity MUST remain stable.
- SaleEvent is supplemented by canonical commerce order/order-line records so partial refunds and product-level economics are deterministic.
- CommissionRule is generalized by versioned EconomicRule/EconomicRuleVersion capable of profit waterfalls and multiple beneficiaries.
- PartnerPayout is backed by immutable ledger allocations rather than mutable balance arithmetic.
- Partner relationships gain exactly one optional sponsoring/founding partner relationship for recruited creators in v1.

No duplicate QR engine, affiliate engine, event bus, tenant/identity platform, or payout ledger may be introduced.

## 3. Architectural Invariants

1. **Genesis authority:** commerce systems report transactions; Genesis resolves economic attribution.
2. **Stable tracking identity:** QR/link public identity is immutable after issuance; its destination is configurable and versioned.
3. **One recruited-creator layer:** a creator may have one sponsoring/founding partner for this economic model. A recruited creator cannot sponsor another compensated downstream creator in v1.
4. **Line-item determinism:** economic allocations are calculated at order-line granularity before order-level aggregation.
5. **Money precision:** monetary values are stored as integer minor units plus ISO currency; floating-point arithmetic is prohibited.
6. **Versioned rules:** every allocation references the exact immutable economic-rule version used.
7. **Append-only ledger:** posted economic entries are never edited or deleted. Corrections use explicit reversing/adjusting entries.
8. **Idempotent ingestion:** the same source event/order cannot create duplicate economic effects.
9. **Balanced allocation:** participant allocations plus retained/unallocated amount MUST reconcile exactly to distributable merchandise profit for the line.
10. **No negative ambiguity:** refunds, chargebacks, and corrections are explicit signed/reversal ledger events tied to prior entries.
11. **Attribution evidence retained:** first touch, last qualified touch, conversion source, selected source, rule version, and decision reason are persisted.
12. **Tenant/security boundary:** every operation executes in Genesis tenant/security context. Partners/creators can only read ledger scope explicitly granted to them.
13. **No automatic payout before proof:** payout accounting may reach Payable before external money movement is enabled; payment execution is a separately governed integration.
14. **Auditability:** allocation inputs, source commerce identifiers, rule versions, and ledger lineage are sufficient to reproduce every statement.
15. **AWS portability:** no laptop-specific paths, secrets, schedulers, or local-only state are permitted in production design.

## 4. Attribution Policy v1

Default configurable policy:
1. Accept deterministic source identity supplied by an authenticated/verified commerce integration when it maps to an active Genesis tracking identity.
2. Otherwise evaluate qualified Genesis QR/link touches for the conversion subject/session.
3. Select the last qualified collaborator/creator touch within the configured attribution window (initial STONER GYM setting: 30 days).
4. Preserve first touch and last qualified touch even when they are not selected for payment.
5. If no qualified source exists, mark the conversion organic/unattributed and apply the configured organic economic rule.
6. Product-specific contractual rules may determine beneficiary economics after attribution, but may not rewrite historical attribution evidence.

Attribution windows, precedence, and qualification criteria are versioned configuration.

## 5. Economic Waterfall v1

Distributable merchandise profit is computed from explicit line-level components:

gross merchandise amount
- discounts allocated to the line
- refunds/returns allocated to the line
- product COGS
- allocated inbound freight/duty where configured
- direct fulfillment/packaging where configured
- payment-processing fees allocated to the line
= distributable merchandise profit

Taxes collected for taxing authorities and customer-paid shipping are not distributable merchandise profit unless an explicit versioned rule states otherwise.

Initial STONER GYM configuration targets:
- Daniel direct attributed sale: 50% STONER / 50% Daniel.
- Creator recruited by Daniel: 50% STONER / 35% creator / 15% Daniel.
- Organic unattributed STONER GYM: 100% STONER.
- Product/capsule-specific contracts may select a different rule version.

These percentages are reference configuration only and MUST NOT be hard-coded.

## 6. Ledger and Payout Model

Ledger entry states are append-only economic facts, not editable balances. Materialized balances may be derived for performance.

Payout eligibility progresses:
- Pending: economic event recorded but still inside clearing/return policy.
- Cleared: eligible after configured clearing conditions.
- Payable: included in an approved payout statement/batch.
- Paid: external payment reference recorded.

A payout statement MUST reconcile to its underlying ledger entries. Refunds after payment create new negative/recovery entries; they do not mutate the paid statement.

## 7. Security and Open-Ledger Boundary

"Open ledger" means transparent calculations within authorized economic scope, not open company accounting.

Admin scope: all records for the tenant/brand as permitted.
Founding collaborator scope: own direct economics plus explicitly authorized aggregate/detail views for recruited creators.
Creator scope: own attributed activity, rule basis, adjustments, balances, and payouts.
No participant receives unrelated COGS, margins, partner earnings, customer PII, or company financial records merely because they participate in a collaboration.

## 8. AWS and Runtime Direction

Implementation must integrate with existing Genesis AWS work. Target capabilities:
- PostgreSQL/RDS for transactional commerce, rule, ledger, and payout records.
- Existing Genesis identity/security context.
- Existing event architecture, with SQS/EventBridge where asynchronous AWS delivery is appropriate.
- S3 for generated statements/artifacts where needed.
- Secrets Manager for integration credentials.
- CloudWatch for runtime telemetry.
- Existing Genesis deployment pipeline/infrastructure conventions.

Exact infrastructure choices remain subordinate to the existing AWS architecture and must not create a second deployment stack without review.

## 9. Required Proof Cases Before Production

At minimum:
1. Daniel direct QR -> purchase -> 50/50 allocation.
2. Daniel short link -> delayed purchase inside window.
3. Recruited creator -> purchase -> 50/35/15 allocation.
4. Daniel touch followed by creator touch -> last-qualified precedence.
5. Creator touch followed by Daniel touch -> precedence proof.
6. Expired attribution window -> organic rule.
7. Multi-line order with different economic rules.
8. Discount allocated across lines.
9. Partial refund of one line.
10. Full refund after Pending.
11. Refund after Paid creates recovery entry.
12. Duplicate webhook/order replay produces no duplicate ledger effect.
13. Destination URL changes while printed QR identity remains valid.
14. Unauthorized creator cannot view another creator's ledger.
15. Founding collaborator view respects configured recruited-creator visibility.
16. Rule changes do not alter historical allocations.
17. Rounding reconciliation exactly balances minor units.
18. Manual/POS sale with explicit Genesis tracking identity.
19. Source-channel event arrives out of order and reconciles safely.
20. Payout statement reconciles exactly to included ledger entries.

## 10. Review Findings

**Strengths**
- Strong fit with existing Partner & QR Identity Engine.
- Clear platform reuse beyond STONER.
- Deterministic, auditable economic model.
- Separates attribution evidence from economic contracts.
- AWS direction aligns with Genesis migration goals.

**Primary risks**
- Existing partner model is commission-centric and requires careful extension for profit-sharing.
- Commerce channels differ in refund/fee timing and source metadata.
- Permission semantics for collaborator aggregate views require explicit contracts.
- Financial correctness requires stronger invariants than ordinary referral analytics.

**Mitigations**
- Versioned rules, integer minor units, append-only ledger, idempotency keys, line-level allocation, proof suite, and delayed automatic payout integration.

## 11. Recommendation

**APPROVE FOR ARD DEFINITION.**

Implementation authority is not granted by this RAR. ARD and ADR approval remain required before foundational production implementation.
