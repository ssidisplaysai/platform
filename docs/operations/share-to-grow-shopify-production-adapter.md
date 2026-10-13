# Share-to-Grow Shopify Production Adapter (Hybrid Bridge)

Date (UTC): 2026-10-13  
Branch: `infra/genesis-staging-runtime-v1`  
Phase status: `SHARE_TO_GROW_SHOPIFY_BRIDGE=BLOCKED_STOREFRONT_HANDOFF`

## Scope

Implemented and validated source-level hybrid bridge components for:

- WordPress durable attribution capture/route support
- WordPress -> Shopify metadata handoff contract
- Shopify webhook ingestion/authentication route in Genesis
- Shopify event normalization into existing canonical Share-to-Grow ledger pipeline
- refund/cancellation/idempotency parity tests

No real production order was placed.  
No payment was submitted.  
No public Shopify webhook ingress was activated in AWS in this phase.

## 1) Canonical Attribution Model (Frozen)

Canonical logical fields (cross-commerce):

- `touchId`
- `trackingIdentityId`
- `canonicalPartnerId`
- optional `campaignId`

Shopify durable metadata names:

- `genesis_touch_id`
- `genesis_tracking_identity_id`
- `genesis_partner_id`
- `genesis_campaign_id`

Source:

- `src/modules/share-to-grow/adapters/shopify.ts`
- `src/modules/share-to-grow/wordpress-shopify-attribution.ts`

## 2) Signing + Webhook Secrets

### Attribution signing secret (existing)

- name: `genesis/production/share-to-grow/attribution-signing`
- ARN: `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/share-to-grow/attribution-signing-cZvaag`
- versions: `1` (`AWSCURRENT`)
- tags:
  - `Environment=production`
  - `Application=GenesisShareToGrow`
  - `Purpose=AttributionTokenSigning`
- resource policy: not present

### Shopify webhook secret (created for dedicated ingress auth)

- name: `genesis/production/share-to-grow/shopify-webhook`
- ARN: `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/share-to-grow/shopify-webhook-S5BVr8`
- versions: `1` (`AWSCURRENT`)
- tags:
  - `Environment=production`
  - `Application=GenesisShareToGrow`
  - `Purpose=ShopifyWebhookAuth`
- resource policy: not present

### Consumer binding status

Current ECS task definition (`genesis-share-to-grow-production:2`) remains unchanged and currently binds:

- Postgres secret fields
- `GENESIS_WOOCOMMERCE_WEBHOOK_SECRET`

Not yet bound (intentional for this software phase):

- attribution signing secret
- Shopify webhook secret

## 3) WordPress Durable Route + Capture Bridge

Implemented in plugin package:

- `integrations/wordpress/stoner-share-to-grow/includes/class-stoner-s2g-attribution-bridge.php`

Capabilities:

1. capture `genesis_attribution` query token
2. strict verification (format/signature/time/org)
3. fail-closed for malformed/expired/mismatched tokens
4. persist last qualified touch for 30 days:
   - session key: `genesis_share_to_grow_attribution`
   - secure cookie: `Secure`, `HttpOnly`, `SameSite=Lax`
5. durable route handling:
   - `/q/<public-slug>` (including `/q/daniel-coffeen`)
   - resolves configured slug map
   - dynamically issues signed token server-side
   - redirects to configured Shopify destination with `genesis_attribution`

Default route map includes Daniel:

- slug: `daniel-coffeen`
- tracking identity: `tracking-stoner-gym-daniel-coffeen-v1`
- canonical partner: `daniel-coffeen`

## 4) WordPress -> Shopify Handoff Contract

Source utilities:

- `src/modules/share-to-grow/wordpress-shopify-attribution.ts`

Behavior:

- maps verified WordPress session to Shopify cart attributes and line properties
- uses durable Shopify namespaced keys only
- exposes no secret material

## 5) Shopify Webhook Adapter

### Route

- `src/app/api/share-to-grow/shopify/webhook/route.ts`

Route behavior:

- requires `GENESIS_SHOPIFY_WEBHOOK_SECRET`
- validates webhook auth in adapter layer
- keeps Woo route unchanged:
  - `/api/share-to-grow/woocommerce/webhook`

### Topics supported

- `orders/create` -> `order.created`
- `orders/paid` -> `order.paid`
- `orders/updated` -> `order.updated`
- `orders/cancelled` -> `order.cancelled`
- `refunds/create` -> `refund.created`

### Auth

- raw body HMAC verification (`X-Shopify-Hmac-Sha256`)
- constant-time comparison
- missing/invalid signature: fail-closed
- no IP-allowlist-only trust

Core files:

- `src/modules/share-to-grow/adapters/shopify-events.ts`
- `src/modules/share-to-grow/adapters/shopify-webhook-http.ts`
- `src/modules/share-to-grow/adapters/shopify-raw-processor.ts`
- `src/modules/share-to-grow/adapters/shopify-processor.ts`
- `src/modules/share-to-grow/adapters/shopify-payloads.ts`
- `src/modules/share-to-grow/adapters/shopify-adjustments.ts`
- `src/modules/share-to-grow/adapters/shopify-eligibility.ts`
- `src/modules/share-to-grow/adapters/shopify.ts`

## 6) Canonical Normalization + Idempotency + Parity

Implemented:

- Shopify orders normalize into the same canonical commerce model and allocation engine used by Woo
- source event receipt dedupe keyed by webhook delivery id (`x-shopify-webhook-id`)
- adjustment parity for refunds/cancellations:
  - partial refund
  - duplicate refund replay
  - over-refund cap + brand-loss accounting
  - cancellation replay safety

No second ledger engine was introduced.

## 7) Non-Purchase Storefront Certification State

Software harness and contracts are present, but live production storefront proof is incomplete in this phase because plugin deployment/activation on the authoritative production path was intentionally not executed.

- order created: `NO`
- payment submitted: `NO`
- production Shopify webhook ingress activated: `NO`

## 8) Validation

Executed and passed:

- `npx jest src/modules/share-to-grow/__tests__ --runInBand`
- `npm run typecheck:share-to-grow:production`
- `npm run lint:share-to-grow:production`
- `npm run test:share-to-grow:production`
- `npm run build`
- `docker build -t genesis-staging-runtime:local-shopify-bridge .`
- docker route assertions:
  - `.next/server/app/api/share-to-grow/woocommerce/webhook/route.js`
  - `.next/server/app/api/share-to-grow/shopify/webhook/route.js`

## 9) Canonical Backend / Payout / PF Guardrails

No runtime mutating commerce execution was performed from this phase.

Certified baseline remains:

- `revision=13`
- SHA-256 `ea144a01d7791858da2baf8d99f9e493e56ed29fb052681119d6cb855f7a0b91`
- `REAL_PRODUCTION_WOO_EVENTS=0`
- `REAL_PRODUCTION_SHOPIFY_EVENTS=0` (no live Shopify ingress activation in this phase)

Payout safety:

- `AUTOMATED_EXTERNAL_PAYOUTS_ENABLED=NO`
- provider calls `0`
- transfers `0`

Page Factory:

- no access/mutation
- `PAGE_FACTORY_DRIFT_RISK=NO`

## Final Status

`SHARE_TO_GROW_SHOPIFY_BRIDGE=BLOCKED_STOREFRONT_HANDOFF`

Blocking reason:

- Software adapter and tests are complete, but live production storefront handoff/deployment certification on the authoritative production path is not yet executed.

Next action:

"Bind the production Shopify webhook secret, expose only the Shopify webhook route, register bounded Shopify webhooks, and perform one controlled real Daniel-attributed Shopify order. Automated payouts remain disabled."
