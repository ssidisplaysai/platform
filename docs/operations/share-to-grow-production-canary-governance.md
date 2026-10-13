# Share-to-Grow Production Canary Governance + Real Onboarding Readiness

Date (UTC): 2026-10-13  
Branch: `infra/genesis-staging-runtime-v1`  
Phase status: `SHARE_TO_GROW_CANARY_GOVERNANCE=BLOCKED_LIVE_CANARY_BALANCE`

## Scope

Read-only governance audit only:

- no ALB/DNS/ECS/IAM/Secrets mutation
- no database mutation
- no payout mutation
- no cleanup of canary records

## Canonical Snapshot (Read-Only)

- `schema_version=1`
- `revision=7`
- `updated_at=2026-10-13 02:54:11.43932+00`
- counts:
  - participants `0`
  - trackingIdentities `0`
  - ruleVersions `0`
  - ledgerEntries `6`
  - sourceEventReceipts `6`
  - processedCommerceLines `3`
  - payoutEntitlements `3`
  - commerceAdjustments `3`

## Canary Inventory (Authoritative Records)

Canary provenance marker: `sourceEventId` prefix `s2g-prod-canary-20261013`.

Receipts (`6`):

- `s2g-prod-canary-20261013-o3-d1` (`order.updated`)
- `s2g-prod-canary-20261013-o1-d1` (`order.updated`)
- `s2g-prod-canary-20261013-o1-r1` (`refund.created`)
- `s2g-prod-canary-20261013-o1-c1` (`order.updated` cancelled)
- `s2g-prod-canary-20261013-o2-d1` (`order.updated`)
- `s2g-prod-canary-20261013-o2-r1` (`refund.created`)

Processed lines (`3`):

- `woocommerce:91013003:9101300301`
- `woocommerce:91013011:9101301101`
- `woocommerce:91013012:9101301201`

Ledger entries (`6`):

- earnings (`3`): `+3700`, `+3700`, `+3700`
- reversals (`3`): `-2000`, `-1700`, `-3700`

Payout entitlements (`3`):

- `entitlement:...91013003...` state=`pending`, amount=`3700`
- `entitlement:...91013011...` state=`reversed`, amount=`1700`
- `entitlement:...91013012...` state=`reversed`, amount=`3700`

Commerce adjustments (`3`):

- `refund:91013011:9101301191` (brand loss `0`)
- `cancellation:91013011` (brand loss `0`)
- `refund:91013012:9101301291` (brand loss `1300`)

## Economic Exposure Computation

Computed from canonical records:

- gross earnings: `11100` minor (`$111.00`)
- gross reversals: `7400` minor (`$74.00`)
- net ledger: `3700` minor (`$37.00`)
- net entitlement amount: `9100` minor (includes reversed-state records by design)
- canary brand loss cumulative: `1300` minor (`$13.00`)
- possible payable exposure:
  - pending `3700`
  - cleared `0`
  - payable `0`
  - paid `0`
  - aggregate possible payable: `3700` minor (`$37.00`)

## Real Production Woo Activity Separation

- non-canary Woo receipts: `0`
- non-canary receipts (all sources): `0`
- `REAL_PRODUCTION_WOO_EVENTS=0` (excluding canary namespace)

## Governance Classification

Classification model used:

- **A**: canary records are fully isolated and have zero possible payable exposure
- **B**: canary records are isolated but retain possible payable exposure
- **C**: canary records are not isolated and require mixed-data governance
- **D**: marker/provenance insufficient for reliable governance

Observed classification: **B**

Rationale:

1. Provenance marker exists and is consistent (`sourceEventId` prefix match for all receipts).
2. No non-canary Woo events are present.
3. Remaining pending entitlement `3700` minor leaves a live payable path once clearing time is reached.

## Strategy Decision (No Mutation Performed)

Selected strategy: **B — preserve records and neutralize live balance via canonical reversal**.

Reason:

- preserve immutable canary lineage/audit trail
- remove payable exposure before real onboarding/payout readiness
- avoid non-canonical direct data edits

Proposed canonical mutation (not executed in this phase):

- submit one additional signed Woo refund event for canary order `91013003`
- target line: `9101300301`
- cumulative refund required: `$37.00` (3700 minor)
- expected outcomes:
  - one reversal entry `-3700` against earning `earning:woocommerce:91013003:9101300301:stoner-gym-organic-v1:stoner`
  - entitlement `entitlement:...91013003...` transitions `pending -> reversed`
  - possible payable becomes `0`

## Real Onboarding Readiness Baseline (Source-Schema Derived)

Current readiness baseline:

- runtime ingress/auth: enabled and certified
- canary lineage: isolated and queryable
- real onboarding records:
  - participants `0`
  - tracking identities `0`
  - rule versions `0`

Required onboarding object schemas from source:

1. `CollaborationParticipantRecord`
   - `participantId`
   - `organizationId`
   - `collaborationId`
   - `canonicalPartnerId`
   - `role` (`founding_collaborator` | `creator` | `brand`)
   - optional `sponsorPartnerId`
   - `status`
   - `createdAt`
2. `TrackingIdentityReferenceRecord`
   - `trackingIdentityId`
   - `organizationId`
   - `canonicalPartnerId`
   - `canonicalPartnerQrId`
   - `publicSlug` (org-unique)
   - `status`
   - `createdAt`
3. `EconomicRuleVersion`
   - `id`, `ruleId`, `version`
   - `effectiveFrom` (+ optional `effectiveTo`)
   - `beneficiaries[]` with `beneficiaryId`, `role`, `basisPoints`
   - `residualBeneficiaryId`

Attribution and payout policy anchors:

- attribution window: `30` days (`stoner-gym-attribution-30d-v1`)
- payout clearing: `30` days (`stoner-gym-standard-30d-v1`)
- Woo metadata keys required for deterministic source:
  - `_genesis_touch_id`
  - `_genesis_tracking_identity_id`
  - `_genesis_partner_id`
  - `_genesis_campaign_id`

Pre-onboarding constraints:

- do not create production participants/tracking/rules until canary payable exposure is neutralized or explicitly accepted by governance owner
- keep payouts disabled

## Boundary and Safety Confirmation

- no Page Factory drift
- no secrets exposed
- no payout execution/transfers
- no destructive cleanup

## Final Classification

- `SHARE_TO_GROW_CANARY_GOVERNANCE=BLOCKED_LIVE_CANARY_BALANCE`
