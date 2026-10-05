# Architecture Requirements & Definition - Genesis Share-to-Grow / Collabs Ledger v1

**Document ID:** ARD-0002  
**Date:** October 5, 2026  
**Status:** Proposed  
**Parent:** RAR-0002  
**Tracking:** GitHub Issue #72

## 1. Architecture Decision Target

Extend the existing Genesis Partner & QR Identity Engine into a deterministic collaboration economics subsystem without duplicating canonical partner, QR, identity, event, or AWS infrastructure.

## 2. Bounded Contexts

### Partner & Collaboration
Owns partner/collaborator/creator participation, vertical/collaboration membership, sponsor relationship, agreement/economic-rule assignment, and lifecycle.

### Tracking Identity
Owns stable public tracking identities, QR/link aliases, destination versions, campaign association, activation/expiration, and scan/click events.

### Attribution
Owns qualified touches, attribution windows, precedence, conversion decisions, evidence, and decision provenance.

### Commerce Ingestion
Owns normalized external channel/order/order-line/refund/fee events and idempotency/reconciliation state. It does not decide partner economics.

### Economic Rules
Owns immutable rule versions, waterfall components, beneficiaries, percentage/fixed allocation definitions, effective periods, and precedence.

### Ledger
Owns append-only economic entries, lineage, reversals/adjustments, balances derived from entries, and reconciliation invariants.

### Payout Accounting
Owns clearing eligibility, statements/batches, Payable/Paid transitions, and external payment references. It does not execute money movement in v1.

## 3. Canonical Entity Extensions

Existing entities remain canonical where applicable. New/extended logical records:

- Vertical: tenant_id, brand_id, vertical_id, name, status.
- Collaboration: collaboration_id, vertical_id, name, status, effective period.
- CollaborationParticipant: collaboration_id, partner_id, role (founding_collaborator|creator|other), sponsor_partner_id nullable, status.
- TrackingIdentity: tracking_identity_id, tenant_id, owner_partner_id, campaign_id nullable, public_slug/token, type, status, issued_at.
- TrackingDestinationVersion: tracking_identity_id, version, destination_uri, effective_from, effective_to.
- AttributionTouch: touch_id, tracking_identity_id, subject/session pseudonymous key, channel, occurred_at, qualification state, campaign context.
- CommerceChannel: channel_id, tenant_id, type, external account reference, status.
- CommerceOrder: order_id, channel_id, external_order_id, currency, timestamps, source payload reference/hash, ingestion state.
- CommerceOrderLine: order_line_id, order_id, external_line_id, product reference, quantity, gross_minor, discount_minor, refund_minor, tax_minor, shipping allocation where applicable.
- CommerceCostComponent: order_line_id, type (cogs|inbound_freight_duty|fulfillment_packaging|processing_fee|other_configured), amount_minor, source/provenance.
- AttributionDecision: decision_id, order/order_line scope, selected_tracking_identity_id nullable, selected_partner_id nullable, first_touch_id nullable, last_qualified_touch_id nullable, conversion_source, policy_version_id, decision_reason, decided_at.
- EconomicRule: rule_id, tenant_id, name, status.
- EconomicRuleVersion: rule_version_id, rule_id, immutable version, effective period, waterfall definition, beneficiary definition, rounding policy, status.
- EconomicAllocation: allocation_id, order_line_id, attribution_decision_id, rule_version_id, beneficiary_party_id, role, amount_minor, currency, calculation_provenance.
- LedgerEntry: ledger_entry_id, account/party scope, allocation_id nullable, entry_type, signed_amount_minor, currency, source_entry_id nullable, status, occurred_at, posted_at, idempotency_key.
- PayoutStatement: statement_id, beneficiary_party_id, period, currency, status, total_minor.
- PayoutStatementEntry: statement_id, ledger_entry_id.
- PayoutPaymentReference: statement_id, external_provider nullable, external_reference, paid_at.

IDs may use the repository's existing identity conventions; this ARD specifies semantic identity, not a new global ID algorithm.

## 4. Database Invariants

1. Unique (channel_id, external_order_id).
2. Unique (order_id, external_line_id).
3. Unique ingestion idempotency key per source event.
4. Tracking public slug/token unique within routing namespace.
5. Tracking identity owner and issued identity cannot be rewritten after economic use.
6. EconomicRuleVersion immutable after activation/use.
7. LedgerEntry immutable after posting.
8. Reversal entry references the entry/economic fact it reverses.
9. All monetary columns are integer minor units; currency required.
10. Allocation totals reconcile to distributable profit under explicit rounding policy.
11. Payout statement entries cannot be included in two simultaneously payable/paid statements for the same economic entitlement.
12. Paid statement cannot be mutated; later corrections are new ledger entries/statements.
13. sponsor_partner_id cannot create depth > 1 for compensated creator relationships in v1.
14. All tenant-owned records include tenant scope directly or through an enforced parent relationship.

## 5. Attribution Contract

Input:
- tenant/security context
- order/order-line
- conversion timestamp
- verified channel attribution metadata, if present
- qualified Genesis touches
- AttributionPolicyVersion

Output AttributionDecision:
- selected identity/partner or organic
- first touch
- last qualified touch
- conversion source
- policy version
- human-readable/machine-readable decision reason

Default STONER GYM policy version:
- window: 30 days
- model: last qualified collaborator/creator touch
- verified explicit Genesis identity from channel integration is eligible according to policy precedence
- no eligible touch -> organic

Reprocessing with the same normalized evidence and same policy version MUST produce the same decision. Historical decisions are not silently rewritten when policy changes.

## 6. Economic Calculation Contract

For each order line:
1. Normalize gross, discount, refund, cost components, currency.
2. Compute distributable_profit_minor using the active rule's component policy.
3. Resolve EconomicRuleVersion by contractual/product/campaign/participant precedence.
4. Allocate distributable profit to beneficiaries using integer arithmetic.
5. Apply deterministic rounding rule; assign residual minor units to the rule-designated residual beneficiary (default retained brand share).
6. Assert exact reconciliation.
7. Persist allocation provenance and append ledger entries atomically.

Reference configurations:
- stoner-gym-daniel-direct-v1: retained brand 50%, Daniel 50%.
- stoner-gym-daniel-creator-v1: retained brand 50%, attributed creator 35%, Daniel sponsor override 15%.
- stoner-gym-organic-v1: retained brand 100%.

Configuration names are illustrative; platform code MUST not branch on them.

## 7. Event Contracts

Reuse Genesis event infrastructure. Proposed domain events:
- tracking.identity_issued
- tracking.destination_changed
- tracking.touch_captured
- commerce.order_ingested
- commerce.order_adjusted
- attribution.decided
- economics.allocated
- ledger.entry_posted
- ledger.entry_reversed
- payout.statement_created
- payout.statement_payable
- payout.statement_paid

Events include tenant_id, event_id, occurred_at, correlation_id, causation_id where supported, and canonical entity references. Consumers MUST be idempotent.

## 8. API Boundary

Initial logical API capabilities:
- POST /tracking-identities
- POST /tracking-identities/{id}/destinations
- GET /r/{publicSlug} (record qualified touch then redirect)
- POST /commerce/events/{channel}
- GET /collaborations/{id}/ledger
- GET /partners/{id}/ledger
- GET /partners/{id}/creators
- POST /collaborations/{id}/participants
- POST /economic-rules
- POST /economic-rules/{id}/versions
- POST /payout-statements
- POST /payout-statements/{id}/mark-paid

These are contract targets, not authorization to create an independent HTTP stack. They must use existing Genesis routing/auth/runtime conventions.

## 9. Authorization Matrix

- Genesis/tenant admin: manage collaboration configuration, rules, reconciliation, statements; read authorized tenant ledger.
- Brand manager: manage scoped collaborations/campaigns/participants subject to permissions; read scoped ledger.
- Founding collaborator: read own direct ledger; read recruited-creator data only at the detail/aggregate level explicitly granted by collaboration policy.
- Creator: read own tracking performance, allocations, adjustments, balances, statements.
- Viewer/auditor: read only scopes explicitly granted.

Customer PII is not required in collaborator ledger responses. Use pseudonymous attribution/session identifiers where practical.

## 10. Transaction Boundaries

The following must commit atomically:
- attribution decision + economic allocations + corresponding initial ledger entries for a normalized order version;
- reversal/adjustment allocations + ledger entries;
- statement creation + locking/inclusion of eligible ledger entries.

External webhooks/events are acknowledged only according to existing integration policy, but retries MUST be safe.

## 11. Reconciliation

Genesis stores source channel identifiers and payload hash/reference sufficient to compare:
- source order totals vs normalized totals;
- normalized line totals vs economic inputs;
- distributable profit vs allocations;
- allocations vs ledger entries;
- eligible ledger entries vs payout statements;
- paid statements vs external payment references.

Discrepancies enter an explicit reconciliation exception state; they are never silently balanced by editing posted ledger history.

## 12. Observability

Required metrics/logs:
- redirect/touch volume and failures
- commerce ingestion latency/errors/replays
- attribution decision counts by reason
- allocation/reconciliation failures
- ledger posting failures
- pending/cleared/payable balances
- statement reconciliation status

Logs must not expose secrets or unnecessary customer PII.

## 13. AWS Deployment Requirements

Use existing Genesis AWS conventions and staging architecture. Required production properties:
- transactional PostgreSQL-compatible persistence;
- encrypted secrets and data transport;
- asynchronous delivery with durable retry/DLQ where event processing is used;
- deployable without local machine state;
- migrations versioned in GitHub;
- staging proof before production.

## 14. Implementation Gates

Before production:
1. ADR ratifies this architecture or an amended version.
2. Schema/migrations pass invariant tests.
3. Twenty RAR proof cases are automated or have reproducible integration proofs.
4. Replay/idempotency and refund tests pass.
5. Authorization isolation tests pass.
6. Historical rule immutability test passes.
7. AWS staging deployment and rollback are proven.
8. Automatic payout execution remains disabled until separately approved.
