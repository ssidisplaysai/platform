# Share-to-Grow Daniel Production Referral Attribution Certification

Date (UTC): 2026-10-13  
Branch: `infra/genesis-staging-runtime-v1`  
Phase status: `SHARE_TO_GROW_DANIEL_REFERRAL=BLOCKED_STOREFRONT_INTEGRATION`

## Scope

Read-only certification of Daniel production referral/token/QR readiness:

- payout safety reconfirmation
- source trace for attribution token contract
- signing authority audit
- landing URL evidence
- Woo storefront integration readiness classification
- controlled acceptance readiness planning

No real Woo order was placed.  
No payout enablement occurred.  
No canonical commerce state mutation was performed.

## 1) Payout Safety Reconfirmation

### Runtime/infra evidence

- ECS services in `genesis-production`:
  - `genesis-production-web`
  - `genesis-share-to-grow-production`
  - `genesis-staging-web`
- no dedicated payout worker service present

### Code/dependency evidence

- Share-to-Grow code contains payout accounting state transitions (`pending/cleared/payable/paid/reversed`) but no external payout provider executor path in runtime code.
- repository dependencies contain no Stripe/PayPal payout SDK wiring for Share-to-Grow runtime execution.

### Canonical state evidence

- all current payout entitlements are `reversed` (no payable exposure)
- no new commerce records in this phase

Conclusion:

- `AUTOMATED_EXTERNAL_PAYOUTS_ENABLED=NO`
- provider payout calls observed in this phase: `0`
- external transfers observed in this phase: `0`
- payout safety: `PASS`

## 2) Attribution Token Contract (Source Trace)

Sources:

- `src/modules/share-to-grow/wordpress-attribution-token.ts`
- `src/modules/share-to-grow/wordpress-woocommerce-attribution.ts`
- `src/modules/share-to-grow/adapters/woocommerce.ts`

Contract:

- query parameter: `genesis_attribution`
- token payload schema:
  - `organizationId`
  - `touchId`
  - `trackingIdentityId`
  - `canonicalPartnerId`
  - optional `campaignId`
  - `issuedAt`
  - `expiresAt`
- token encoding/signing:
  - payload JSON -> base64url
  - signature: HMAC SHA-256 over encoded payload
  - output: `<payloadB64Url>.<signatureB64Url>`
- verification:
  - strict two-part format
  - recompute HMAC and compare via constant-time `timingSafeEqual`
  - decode payload JSON
  - validate required fields and issued/expires chronology
  - enforce current time within validity window
  - enforce `expectedOrganizationId`
- expiration behavior:
  - outside `[issuedAt, expiresAt]` => `ATTRIBUTION_TOKEN_EXPIRED`
- Woo metadata mapping from accepted session:
  - `_genesis_touch_id`
  - `_genesis_tracking_identity_id`
  - `_genesis_partner_id`
  - optional `_genesis_campaign_id`

Persistence contract at source layer:

- session key constant exists: `genesis_share_to_grow_attribution`
- helper preserves existing verified attribution if no new token is provided
- browser storage primitive (cookie/localStorage/server-session) is not implemented in this repository’s production storefront runtime; it is left to WordPress/Woo integration layer.

## 3) Attribution Signing Secret Authority Audit

### Runtime configuration (ECS task definition `genesis-share-to-grow-production:2`)

Environment vars include:

- `GENESIS_RDS_CA_CERT`
- `GENESIS_STATE_BACKEND`
- `GENESIS_ENVIRONMENT`

Secrets include:

- Share-to-Grow Postgres secret fields
- `GENESIS_WOOCOMMERCE_WEBHOOK_SECRET`

Not configured:

- any attribution-token signing secret variable

### Secrets Manager inventory under `genesis/production/share-to-grow/*`

Present:

- `genesis/production/share-to-grow/postgres-app`
- `genesis/production/share-to-grow/woocommerce-webhook`

Absent:

- `genesis/production/share-to-grow/attribution-signing`

Conclusion:

- dedicated attribution signing secret configured: `NO`
- production signing authority available: `NO`
- signing secret exposed: `NO`
- Woo webhook secret reuse for attribution token: `NOT ALLOWED` (kept separate by policy)

## 4) Production Landing URL Evidence

Strongest documented contract:

- `docs/integrations/stonerusa-share-to-grow-v1.md` declares public tracking conventions:
  - human examples: `https://stonerusa.com/daniel`, `https://stonerusa.com/gym/{creator-slug}`
  - durable QR target: `https://stonerusa.com/q/{public-slug}`

Also observed:

- WordPress refund bridge defaults to **staging** host gating `staging.stonerusa.com` and is explicitly not yet deployed to production.

Determination:

- production host evidence: `stonerusa.com`
- path convention evidence exists (`/q/{public-slug}`), but no certified production storefront deployment for attribution-capture/verification is present.

Reported base:

- `PRODUCTION_LANDING_URL_BASE=https://stonerusa.com`

## 5) WordPress/Woo Attribution Integration Status

Assessed against required capabilities:

1. receive `genesis_attribution`
2. verify signed attribution token
3. persist attribution for 30 days
4. attach attribution metadata to Woo cart/order
5. preserve line-item attribution evidence for handoff
6. include metadata in outgoing Woo payload

Findings:

- TypeScript attribution token/session contract exists in Genesis source.
- WordPress integration code present in repo is a **refund bridge** plugin for staging, not attribution-capture/session persistence for production storefront.
- no production-certified WordPress plugin/deployment evidence found here for token capture/verification/session persistence/order-meta write path.

Classification: `C. PARTIALLY_IMPLEMENTED`

- contract/code fragments exist
- production storefront attribution plumbing is not certified/deployed

Blocking impact: cannot certify live referral landing, token acceptance persistence, or checkout attribution handoff in production storefront.

## 6) Daniel Production Token Generation Gate

Gate result:

- production attribution signing authority not configured (`NO`)

Per guardrail, production token generation was not executed.

- Daniel token generated: `NO`
- token round-trip with production authority: `NOT RUN (blocked)`

## 7) Daniel Production Referral URL Gate

Because production signing authority is missing and storefront plumbing is not certified, placeholder-free final production referral URL issuance is blocked in this phase.

- exact certified Daniel production referral URL: `NOT ISSUED (blocked)`
- HTTPS requirement feasibility: `YES` (host contract is HTTPS)

## 8) QR Payload / Artifacts Gate

No final QR payload/artifact was generated in this phase, because final referral URL issuance is blocked.

- QR payload: `NOT ISSUED`
- SVG artifact: `NOT GENERATED`
- PNG artifact: `NOT GENERATED`
- QR round-trip decode: `NOT RUN`

## 9) Attribution Landing / Persistence / Checkout Handoff

Live production storefront acceptance testing (landing session persistence and checkout metadata handoff without purchase) could not be certified in this phase due missing certified storefront plumbing and signing authority.

- token accepted in production storefront: `NOT CERTIFIED`
- Daniel resolved in storefront session: `NOT CERTIFIED`
- 30-day persistence behavior in storefront runtime: `NOT CERTIFIED`
- checkout attribution handoff (no purchase): `DEFERRED`

## 10) Webhook Payload Contract for Future Real Order

Expected attribution meta keys on Woo order payload:

- `_genesis_touch_id`
- `_genesis_tracking_identity_id`
- `_genesis_partner_id`
- `_genesis_campaign_id` (optional)

These are consumed through existing order payload parsing and attribution extraction in Genesis runtime.

## 11) Controlled Real-Order Acceptance Test Plan (Prepared, Not Executed)

Precondition gates before execution:

1. install/activate certified WordPress attribution bridge on production storefront
2. provision dedicated signing secret `genesis/production/share-to-grow/attribution-signing`
3. wire secret to signing/verification integration path (without exposing secret)
4. certify token acceptance + 30-day persistence + order metadata handoff in non-purchase checkout walkthrough

Planned controlled order:

- product: one approved low-value STONER GYM SKU
- amount: minimal approved real amount (business-approved)
- payment method: controlled real method approved by operator
- session entry: Daniel referral URL with signed `genesis_attribution` token
- order actor: designated internal operator/test purchaser
- fulfillment prevention: immediate internal hold + cancellation workflow
- expected Woo event: signed `order.updated` with Genesis attribution order meta keys
- expected Share-to-Grow attribution:
  - selected partner `daniel-coffeen`
  - tracking identity `tracking-stoner-gym-daniel-coffeen-v1`
- expected economics on direct Daniel sale:
  - STONER 50%
  - Daniel 50%
- expected persistence artifacts:
  - +1 source receipt (real, non-canary)
  - +1 processed line
  - +2 earning ledger entries (50/50)
  - +2 pending payout entitlements
- cleanup/reversal:
  - immediate controlled cancellation/refund
  - verify compensating reversal entries and entitlement adjustments
  - maintain append-only audit trail

## 12) Canonical State Check (Must Remain Unchanged)

Observed final state:

- `schema_version=1`
- `revision=13`
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
- `REAL_PRODUCTION_WOO_EVENTS=0`

State unchanged verdict: `PASS`

## 13) Service / Woo Health

- ECS: `1/1/0`
- rollout: `COMPLETED`
- target: `healthy`
- health endpoint: `200`
- unsigned Woo POST: `401`
- alarms in `ALARM`: `0`
- RDS: `available`, `MultiAZ=true`, `PendingModifiedValues={}`

## 14) Page Factory No-Drift

No STG-caused changes to:

- PF source
- PF ECS
- PF IAM
- PF ECR
- PF ALB
- PF DB
- PF monitoring

`PAGE_FACTORY_DRIFT_RISK=NO`

## Final Status

`SHARE_TO_GROW_DANIEL_REFERRAL=BLOCKED_STOREFRONT_INTEGRATION`

Next action:

"Implement and certify the STONER WooCommerce attribution capture/handoff before placing any real order."

## Follow-up Implementation Status (Storefront Bridge Package Prepared)

Subsequent follow-up work created a production-ready WordPress/Woo bridge package in-repo:

- `integrations/wordpress/stoner-share-to-grow/stoner-share-to-grow.php`
- `integrations/wordpress/stoner-share-to-grow/includes/class-stoner-s2g-attribution-bridge.php`
- `integrations/wordpress/stoner-share-to-grow/README.md`
- `integrations/wordpress/stoner-share-to-grow/tests/run.php`

And provisioned dedicated signing secret:

- `genesis/production/share-to-grow/attribution-signing`

Current blocker remains deployment/certification on the actual production storefront path.  
See `docs/operations/share-to-grow-storefront-attribution.md` for full evidence and final phase status.
