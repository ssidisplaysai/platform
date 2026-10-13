# Share-to-Grow Stoner Gym Production Onboarding

Date (UTC): 2026-10-13  
Branch: `infra/genesis-staging-runtime-v1`  
Phase status: `SHARE_TO_GROW_STONER_GYM_ONBOARDING=PASS`

## Scope

Created only canonical production configuration objects for first real onboarding:

- collaboration participants
- tracking identity
- economic rule versions

No real Woo commerce event was sent.  
Automated payouts remain disabled.

## Source Schema Audit (Canonical Types)

Canonical object shapes were derived from source:

- participants: `CollaborationParticipantRecord` in `src/modules/share-to-grow/persistence-types.ts`
- tracking identities: `TrackingIdentityReferenceRecord` in `src/modules/share-to-grow/persistence-types.ts`
- rule versions: `EconomicRuleVersion` in `src/modules/share-to-grow/economic-rule.ts`
- repository registration semantics: `registerCollaborationParticipant`, `registerTrackingIdentityReference`, `registerEconomicRuleVersion` in `src/modules/share-to-grow/share-to-grow-repository.ts`

Hierarchy representation is source-supported via participant role and optional `sponsorPartnerId` (creator-only depth guard). No MLM tiers were introduced.

## Pre-State Snapshot

- `schema_version=1`
- `revision=8`
- canonical SHA-256: `5ac81450bc69dad98d0f72dca09c30767dba4ad0120810e7283494dc23d56a06`
- counts:
  - participants `0`
  - trackingIdentities `0`
  - ruleVersions `0`
  - ledgerEntries `7`
  - sourceEventReceipts `7`
  - processedCommerceLines `3`
  - payoutEntitlements `3`
  - commerceAdjustments `4`

Real business config counts before onboarding:

- participants `0`
- trackingIdentities `0`
- ruleVersions `0`

Canary history was already retained and balanced (possible payable `0`).

## Production IDs

- program: `stoner-gym`
- brand participant: `stoner`
- founding collaborator participant: `daniel-coffeen`
- tracking identity: `tracking-stoner-gym-daniel-coffeen-v1`
- tracking slug: `daniel-coffeen`
- canonical partner QR reference: `qr-stoner-gym-daniel-coffeen-v1`
- rule versions:
  - `stoner-gym-production-organic-v1`
  - `stoner-gym-production-daniel-direct-v1`

## Participant Objects Persisted

1) STONER brand

- `participantId=stoner`
- `organizationId=stoner`
- `collaborationId=stoner-gym`
- `canonicalPartnerId=stoner`
- `role=brand`
- `status=active`

2) Daniel Coffeen founding collaborator

- `participantId=daniel-coffeen`
- `organizationId=stoner`
- `collaborationId=stoner-gym`
- `canonicalPartnerId=daniel-coffeen`
- `role=founding_collaborator`
- `status=active`

No creator participants were created.

## Tracking Identity Persisted

- `trackingIdentityId=tracking-stoner-gym-daniel-coffeen-v1`
- `organizationId=stoner`
- `canonicalPartnerId=daniel-coffeen`
- `canonicalPartnerQrId=qr-stoner-gym-daniel-coffeen-v1`
- `publicSlug=daniel-coffeen`
- `status=active`
- attribution window policy anchor remains `30` days (`stoner-gym-attribution-30d-v1`)

## Rule Versions Persisted

### Organic rule

- ID: `stoner-gym-production-organic-v1`
- Split: STONER `10000` bp (100%)

### Daniel direct rule

- ID: `stoner-gym-production-daniel-direct-v1`
- Split:
  - STONER `5000` bp (50%)
  - Daniel `5000` bp (50%)

## Recruited Creator Split Handling

Source rule schema requires concrete beneficiary IDs. Because no real creator participant exists yet, a persistent creator rule version was not written in this phase.

Required recruited-creator economics were validated in dry-run only (synthetic in-memory creator):

- STONER `50%`
- Creator `35%`
- Daniel `15%`

Synthetic creator was not persisted.

## Dry-Run Resolution (Required)

Using source-compatible allocation behavior on DMP `3700` minor:

- Scenario A (no attribution): STONER `3700` (100%)
- Scenario B (Daniel direct): STONER `1850`, Daniel `1850` (50/50)
- Scenario C (synthetic recruited creator): STONER `1850`, Creator `1295`, Daniel `555` (50/35/15)

Dry-run status: `PASS`

## Canonical Write Mechanism

Repository-semantic optimistic revision updates were used for namespace `share-to-grow-repository`:

- no direct JSON patch SQL
- no overwrite/delete of canary history
- per-object revision increments captured

Writes recorded:

- participant `stoner` -> revision `9`
- participant `daniel-coffeen` -> revision `10`
- tracking identity `tracking-stoner-gym-daniel-coffeen-v1` -> revision `11`
- rule version `stoner-gym-production-organic-v1` -> revision `12`
- rule version `stoner-gym-production-daniel-direct-v1` -> revision `13`

Raw SQL direct patch usage: `NO`

## Post-State Snapshot

- `schema_version=1`
- `revision=13`
- `updated_at=2026-10-13 03:53:39.892603+00`
- canonical SHA-256: `ea144a01d7791858da2baf8d99f9e493e56ed29fb052681119d6cb855f7a0b91`
- counts:
  - participants `2`
  - trackingIdentities `1`
  - ruleVersions `2`
  - ledgerEntries `7`
  - sourceEventReceipts `7`
  - processedCommerceLines `3`
  - payoutEntitlements `3`
  - commerceAdjustments `4`

Configuration-only phase checks:

- new ledger entries: `0`
- new receipts: `0`
- new processed lines: `0`
- new payout entitlements: `0`
- new commerce adjustments: `0`

Canary history remained intact.

## Invariants

- schema valid: pass
- split totals valid (`10000` bp): pass
- no negative percentages: pass
- participant references valid: pass
- tracking references valid: pass
- rule references valid: pass
- duplicate participant IDs: none
- duplicate tracking IDs: none
- duplicate slug-per-org: none
- payout execution state unchanged: pass
- canonical hash reproducible from canonical JSON state: pass

Invariant status: `PASS`

## Tracking / Link Format

Derived from source constants:

- token query key: `genesis_attribution` (`GENESIS_WORDPRESS_TOKEN_QUERY_KEY` in `src/modules/share-to-grow/wordpress-woocommerce-attribution.ts`)
- token format: `<base64url-payload>.<base64url-hmac-signature>`
- referral URL format:
  - `https://<landing-host>/<path>?genesis_attribution=<signed-token>`
- QR payload format:
  - same URL string as referral URL

## Woo Readiness

- production Woo listener on `/api/share-to-grow/woocommerce/webhook`: active
- `DANIEL_ATTRIBUTION_LOOKUP=PASS`
- `DANIEL_DIRECT_RULE_RESOLUTION=PASS`
- real Woo event sent in this phase: `NO`
- `REAL_PRODUCTION_WOO_EVENTS=0`

## Payout Safety

- automated payouts enabled: `NO`
- new payout entitlements from this phase: `0`
- payout provider calls: `0`
- external transfers: `0`

## Service Health

- ECS: `1/1/0`
- rollout: `COMPLETED`
- target: `healthy`
- health: `200`
- unsigned Woo POST: `401` (expected auth reject)
- alarms in `ALARM`: `0`
- RDS: `available`, `MultiAZ=true`, `PendingModifiedValues={}`
- onboarding-induced task restart: none observed

## Page Factory Boundary

STG onboarding phase caused zero changes to:

- PF ECS/task definitions
- PF ECR
- PF IAM
- PF secrets
- PF ALB/default route
- PF DNS
- PF DB
- PF monitoring
- PF source

`PAGE_FACTORY_DRIFT_RISK=NO`

## Final Status

`SHARE_TO_GROW_STONER_GYM_ONBOARDING=PASS`

Next action:

"Create Daniel's production referral/QR assets and prepare one controlled real-order acceptance test before opening broader collaborator traffic. Automated payouts remain disabled."
