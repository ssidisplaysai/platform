# Share-to-Grow Production Canary Governance + Real Onboarding Readiness

Date (UTC): 2026-10-13  
Branch: `infra/genesis-staging-runtime-v1`  
Phase status: `SHARE_TO_GROW_CANARY_GOVERNANCE=PASS`

## Scope

Governance audit with one authorized canonical balancing mutation:

- no ALB/DNS/ECS/IAM/Secrets mutation
- no direct database edits
- no payout execution
- no cleanup/deletion of canary records

## Canonical Snapshot (Post-Governance)

- `schema_version=1`
- `revision=8`
- `updated_at=2026-10-13 03:24:30.33174+00`
- counts:
  - participants `0`
  - trackingIdentities `0`
  - ruleVersions `0`
  - ledgerEntries `7`
  - sourceEventReceipts `7`
  - processedCommerceLines `3`
  - payoutEntitlements `3`
  - commerceAdjustments `4`

## Canary Inventory (Authoritative Records)

Canary provenance marker: `sourceEventId` prefix `s2g-prod-canary-20261013`.

Receipts (`7`):

- `s2g-prod-canary-20261013-o3-d1` (`order.updated`)
- `s2g-prod-canary-20261013-o1-d1` (`order.updated`)
- `s2g-prod-canary-20261013-o1-r1` (`refund.created`)
- `s2g-prod-canary-20261013-o1-c1` (`order.updated` cancelled)
- `s2g-prod-canary-20261013-o2-d1` (`order.updated`)
- `s2g-prod-canary-20261013-o2-r1` (`refund.created`)
- `s2g-prod-canary-20261013-o3-r1` (`refund.created`)

Processed lines (`3`):

- `woocommerce:91013003:9101300301`
- `woocommerce:91013011:9101301101`
- `woocommerce:91013012:9101301201`

Ledger entries (`7`):

- earnings (`3`): `+3700`, `+3700`, `+3700`
- reversals (`4`): `-2000`, `-1700`, `-3700`, `-3700`

Payout entitlements (`3`):

- `entitlement:...91013003...` state=`reversed`, amount=`3700`
- `entitlement:...91013011...` state=`reversed`, amount=`1700`
- `entitlement:...91013012...` state=`reversed`, amount=`3700`

Commerce adjustments (`4`):

- `refund:91013011:9101301191` (brand loss `0`)
- `cancellation:91013011` (brand loss `0`)
- `refund:91013012:9101301291` (brand loss `1300`)
- `refund:91013003:9101300391` (brand loss `0`)

## Economic Exposure Computation

Computed from canonical records:

- gross earnings: `11100` minor (`$111.00`)
- gross reversals: `11100` minor (`$111.00`)
- net ledger: `0` minor (`$0.00`)
- net entitlement amount: `9100` minor (includes reversed-state records by design)
- canary brand loss cumulative: `1300` minor (`$13.00`)
- possible payable exposure:
  - pending `0`
  - cleared `0`
  - payable `0`
  - paid `0`
  - aggregate possible payable: `0` minor (`$0.00`)

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

Observed classification: **A**

Rationale:

1. Provenance marker exists and is consistent (`sourceEventId` prefix match for all receipts).
2. No non-canary Woo events are present.
3. All canary entitlements are now non-payable (`reversed`) and aggregate possible payable is `0`.

## Strategy Decision and Executed Canonical Mutation

Selected strategy: **B — preserve records and neutralize live balance via canonical reversal**.

Reason:

- preserve immutable canary lineage/audit trail
- remove payable exposure before real onboarding/payout readiness
- avoid non-canonical direct data edits

Executed canonical mutation:

- submitted one additional signed Woo refund event for canary order `91013003`
- target line: `9101300301`
- cumulative refund required: `$37.00` (3700 minor)
- realized outcomes:
  - one additional reversal entry `-3700` against earning `earning:woocommerce:91013003:9101300301:stoner-gym-organic-v1:stoner`
  - entitlement `entitlement:...91013003...` transitioned `pending -> reversed`
  - possible payable reduced to `0`
  - canary lineage preserved (no deletions or non-canonical edits)

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

- payouts remain disabled until explicit payout-phase authorization
- onboarding object creation remains a separate authorized mutation phase

## Boundary and Safety Confirmation

- no Page Factory drift
- no secrets exposed
- no payout execution/transfers
- no destructive cleanup
- post-mutation runtime checks:
  - ECS service steady `1/1/0`, rollout `COMPLETED`
  - target `healthy`
  - `GET /api/health` -> `200`
  - unsigned Woo POST -> `401`
  - STG alarms in `ALARM`: `0`
  - RDS `available`, `MultiAZ=true`, `PendingModifiedValues={}`

## Final Classification

- `SHARE_TO_GROW_CANARY_GOVERNANCE=PASS`
