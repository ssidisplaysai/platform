# Share-to-Grow Storefront Attribution Bridge Certification

Date (UTC): 2026-10-13  
Branch: `infra/genesis-staging-runtime-v1`  
Phase status: `SHARE_TO_GROW_STOREFRONT_ATTRIBUTION=BLOCKED`

## Scope

Goal: production storefront attribution bridge for `stonerusa.com`:

- signed `genesis_attribution` token capture
- server-side verification
- 30-day persistence
- Woo cart/checkout order metadata handoff
- compatibility with Share-to-Grow Woo webhook parsing contract

No real Woo order placed.  
No payment submitted.  
No payout enablement.

## 1) Dedicated Attribution Signing Secret

Created secret:

- name: `genesis/production/share-to-grow/attribution-signing`
- ARN: `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/share-to-grow/attribution-signing-cZvaag`
- tags:
  - `Environment=production`
  - `Application=GenesisShareToGrow`
  - `Purpose=AttributionTokenSigning`

Secret value was generated randomly and never logged/documented.

## 2) Secret Ownership/Distribution Model

Required consumers:

1. Genesis backend/operator tooling (token issuance)
2. WordPress storefront bridge (token verification)

Security model:

- server-side only secret access
- never client-side JS/HTML/URL/QR
- no secret persistence in source control
- no secret logging

Bridge implementation expects:

- `GENESIS_S2G_ATTRIBUTION_SIGNING_SECRET` constant in `wp-config.php` (preferred), or
- `GENESIS_S2G_ATTRIBUTION_SIGNING_SECRET` environment variable

## 3) Canonical Source Contract (Token/Metadata)

Canonical TypeScript source:

- `src/modules/share-to-grow/wordpress-attribution-token.ts`
- `src/modules/share-to-grow/wordpress-woocommerce-attribution.ts`

Derived contract:

- query key: `genesis_attribution`
- session key: `genesis_share_to_grow_attribution`
- payload:
  - `organizationId`
  - `touchId`
  - `trackingIdentityId`
  - `canonicalPartnerId`
  - optional `campaignId`
  - `issuedAt`
  - `expiresAt`
- signing:
  - HMAC SHA-256 over base64url payload
  - signature comparison via constant-time semantics
- validation:
  - format
  - required fields
  - time window validity
  - organization match
- Woo order metadata keys:
  - `_genesis_touch_id`
  - `_genesis_tracking_identity_id`
  - `_genesis_partner_id`
  - optional `_genesis_campaign_id`

## 4) Production WordPress/Woo Audit

Public production (`stonerusa.com`) evidence:

- WordPress generator: `https://wordpress.org/?v=7.1.3`
- theme observed in public assets: `hello-elementor`
- public plugin asset evidence: `wp-shopify`, `elementor`, `elementor-pro`
- WooCommerce REST namespaces on production: none found
- Woo plugin public readme probe:
  - `https://stonerusa.com/wp-content/plugins/woocommerce/readme.txt` -> `404`

Staging (`staging.stonerusa.com`) evidence:

- Woo namespaces present (`wc/v1`, `wc/v2`, `wc/v3`, `wc/store`, etc.)
- Woo readme probe stable tag: `11.2.0`

Conclusion:

- production storefront currently appears Shopify-backed (no public Woo evidence)
- staging storefront is Woo-enabled

## 5) Bridge Implementation Package (Repository)

Implemented server-side WordPress/Woo plugin package:

- `integrations/wordpress/stoner-share-to-grow/stoner-share-to-grow.php`
- `integrations/wordpress/stoner-share-to-grow/includes/class-stoner-s2g-attribution-bridge.php`
- `integrations/wordpress/stoner-share-to-grow/README.md`
- `integrations/wordpress/stoner-share-to-grow/tests/run.php`

Capabilities implemented:

- token capture from `genesis_attribution`
- HMAC verification + payload/time/org validation (fail closed)
- 30-day persistence:
  - Woo session key `genesis_share_to_grow_attribution`
  - secure cookie `genesis_share_to_grow_attribution` (`Secure`, `HttpOnly`, `SameSite=Lax`)
- order metadata handoff:
  - `_genesis_touch_id`
  - `_genesis_tracking_identity_id`
  - `_genesis_partner_id`
  - optional `_genesis_campaign_id`

Validation executed:

- existing TypeScript attribution contract test passed:
  - `npm run test -- src/modules/share-to-grow/__tests__/wordpress-woocommerce-attribution.test.ts`
- plugin PHP unit test harness prepared at `integrations/wordpress/stoner-share-to-grow/tests/run.php`
- local PHP runtime unavailable in this environment, so PHP harness execution is deferred to deployment environment CI/host

Line-item attribution handling:

- current Share-to-Grow Woo processor resolves deterministic source from order-level metadata
- no line-item attribution keys are required by current source contract for attribution identity reconstruction

## 6) Daniel Production Token Issuance

Using dedicated secret, issued Daniel production token:

- organization: `stoner`
- canonicalPartnerId: `daniel-coffeen`
- trackingIdentityId: `tracking-stoner-gym-daniel-coffeen-v1`
- campaignId: `STONER-GYM-PRODUCTION`
- issuedAt: `2026-10-13T04:25:25Z`
- expiresAt: `2026-11-12T04:25:25Z`

Token verification round-trip:

- sign: pass
- decode: pass
- verify: pass
- expiry ordering check: pass

Token artifact:

- `artifacts/production/share-to-grow/daniel-coffeen-referral.txt`

## 7) Landing Route and QR Strategy

Checked production route candidates:

- `/q/daniel-coffeen` -> `404`
- `/daniel` -> `404`
- `/gym/daniel-coffeen` -> `404`

Current candidate fallback landing path that exists: `/` (root).

QR strategy decision:

- preferred long-term: durable `/q/{public-slug}` indirection
- current production route not yet implemented/certified
- v1 fallback uses direct signed URL when needed until durable route exists

## 8) Capture/Persistence/Checkout Certification Outcome

Because production `stonerusa.com` is not presently certified as Woo-backed and no approved production deployment operation was executed from this environment, live production capture/persistence/checkout handoff tests cannot be certified in this phase.

Status:

- valid token capture on production storefront: blocked
- invalid-token matrix on production storefront: blocked
- last-qualified-touch browser persistence on production storefront: blocked
- checkout metadata handoff without order creation: blocked/deferred

## 9) Security Review (Bridge)

Implemented/required controls:

- fail-closed verification on malformed/signature/time/org failures
- no signing secret in URL/HTML/JS/source/logs
- `hash_equals` for signature comparison in PHP implementation
- `Secure` + `HttpOnly` + `SameSite=Lax` cookie attributes
- canonical metadata keys only (no alternate key drift)

## 10) STG Backend Immutability and Safety

Canonical backend state remained unchanged:

- `schema_version=1`
- `revision=13`
- SHA-256 `ea144a01d7791858da2baf8d99f9e493e56ed29fb052681119d6cb855f7a0b91`
- counts unchanged:
  - participants `2`
  - trackingIdentities `1`
  - ruleVersions `2`
  - ledgerEntries `7`
  - sourceEventReceipts `7`
  - processedCommerceLines `3`
  - payoutEntitlements `3`
  - commerceAdjustments `4`

`REAL_PRODUCTION_WOO_EVENTS=0`

Payout safety:

- `AUTOMATED_EXTERNAL_PAYOUTS_ENABLED=NO`
- provider calls `0`
- external transfers `0`

## 11) Service/Woo Health

- ECS `1/1/0`, rollout `COMPLETED`
- target `healthy`
- health `200`
- unsigned Woo POST `401`
- alarms in `ALARM`: `0`
- RDS `available`, `MultiAZ=true`, `PendingModifiedValues={}`

## 12) Deployment Method Status

Prepared package is ready for approved WordPress deployment path.

Production deployment was not executed in this phase due storefront architecture/deployment-state mismatch (production appears Shopify-backed; staging is Woo-backed).

Backup, versioned deployment evidence, and production activation are therefore pending the explicit platform decision on Woo storefront target.

Prepared package checksums (SHA-256):

- `stoner-share-to-grow.php`:
  - `c509147f964a138cf07b02938bfd8302c82732ae3ddd22bcc650512a36382d47`
- `includes/class-stoner-s2g-attribution-bridge.php`:
  - `b86e79c16cd5ed5ceea3e47f43dfbb2716cf7a5e7f8996857cdb2caee14b80bc`
- `README.md`:
  - `e5c3138b517f58ea9fdb4b28cb9aee598e58d1c0512dd33e53377ce808ac0c6d`
- `tests/run.php`:
  - `7598666f081dec39ac14d25e6e4432ebf88944d798332a51a264426a71c22a8f`

## 13) Page Factory Boundary

No Page Factory modifications:

- source: none
- ECS/IAM/ECR/ALB/DB/monitoring: none

`PAGE_FACTORY_DRIFT_RISK=NO`

## Final Status

`SHARE_TO_GROW_STOREFRONT_ATTRIBUTION=BLOCKED`

Blocking reason:

- production architecture certification later confirmed a hybrid production path (WordPress landing + Shopify cart/checkout/order authority), not a Woo-primary checkout path.
- live production deployment/activation for attribution handoff into the Shopify order authority was not completed in this phase.

Next action:

1. Use the certified production architecture in `docs/operations/share-to-grow-production-commerce-architecture.md`.
2. Implement certified hybrid WordPress->Shopify attribution handoff on production path.
3. Re-run non-purchase landing, invalid-token matrix, persistence, and checkout metadata certification on the production Shopify path.
4. Then execute one controlled real production order under Daniel referral.

## Follow-up: Production Commerce Architecture Certification

Read-only architecture certification completed after this phase:

- result: `SHARE_TO_GROW_PRODUCTION_COMMERCE_ARCHITECTURE=PASS`
- classification: `HYBRID` (WordPress landing shell + Shopify cart/checkout/order authority)
- current Woo webhook real-order authority status: `CURRENT_WOO_WEBHOOK_CAN_RECEIVE_REAL_STONER_ORDER=NO`
- details: `docs/operations/share-to-grow-production-commerce-architecture.md`

## Follow-up: Shopify Hybrid Adapter Implementation

Hybrid bridge software implementation has now been completed in source:

- WordPress durable route + token capture/persistence updates
- WordPress -> Shopify metadata handoff helpers
- Shopify webhook route + adapter normalization + auth + idempotency + refund/cancel parity tests

Current status remains blocked on live production storefront deployment/handoff certification:

- `SHARE_TO_GROW_SHOPIFY_BRIDGE=BLOCKED_STOREFRONT_HANDOFF`
- details: `docs/operations/share-to-grow-shopify-production-adapter.md`

## Follow-up: Live Production Handoff Attempt

Live non-purchase production handoff certification was attempted with strict no-order/no-payment guardrails.

Key observations:

- `https://stonerusa.com/q/daniel-coffeen` currently returns `404` on production
- production landing probes with valid/invalid `genesis_attribution` tokens return `200` with no attribution cookie evidence
- Shopify cart/checkout path is live, but cart attributes and line properties remained empty in controlled session
- no real order was submitted; no payment attempted

Current phase status:

- `SHARE_TO_GROW_LIVE_STOREFRONT_HANDOFF=BLOCKED_DEPLOYMENT`
- blocker: production WordPress bridge deployment/activation on `stonerusa.com` not yet completed through approved admin/release channel
- details: `docs/operations/share-to-grow-shopify-production-adapter.md`
