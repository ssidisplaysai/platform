# Share-to-Grow Production Commerce Architecture Certification

Date (UTC): 2026-10-13  
Branch: `infra/genesis-staging-runtime-v1`  
Phase status: `SHARE_TO_GROW_PRODUCTION_COMMERCE_ARCHITECTURE=PASS`

## Scope

Read-only architecture audit only for:

- `https://stonerusa.com`
- `https://shop.stonerusa.com`
- `https://staging.stonerusa.com`

No deployment, no order placement, no checkout submission, and no storefront mutation were performed.

## 1) Public Site Fingerprint (Production)

### `stonerusa.com` evidence

- WordPress site and assets present (`wp-content`, `wp-json` reachable).
- `wp-shopify` plugin assets present:
  - `/wp-content/plugins/wp-shopify/css/front-styles.css`
  - `/wp-content/plugins/wp-shopify/js/front.js`
- Public navigation link to Shopify-hosted store:
  - `https://shop.stonerusa.com/collections/all`
- Woo production signals absent on the public production host:
  - `/cart` -> `404`
  - `/checkout` -> `404`
  - `/wp-json/wc/store/v1/cart` -> `404`

### `shop.stonerusa.com` evidence

- Shopify-specific headers and assets observed:
  - `link: <https://cdn.shopify.com>; rel="preconnect"`
  - `window.Shopify.MCP.shop = "55a551-c7.myshopify.com"`
  - multiple `shopifycloud`/`shopifycdn` resources
- Shopify cart cookies observed:
  - `_shopify_essential`, `_shopify_analytics`, `_shopify_marketing`, `cart`, `cart_currency`
- Checkout redirect authority observed:
  - `/checkout` -> `302` to `https://shop.app/checkout/...`

## 2) Cart Flow Classification

- Production cart authority: `SHOPIFY`
- Evidence:
  - `https://shop.stonerusa.com/cart` returns `200` (Shopify response headers and cookies).
  - Cart/session persistence uses Shopify cookies (`cart`, `_shopify_*`, `cart_currency`).
- `stonerusa.com` does not expose active Woo cart endpoints (`/cart` is `404`).

## 3) Checkout Flow Classification

- Production checkout authority: `SHOPIFY`
- Checkout hostname/redirect: `shop.stonerusa.com` -> `shop.app/checkout/...`
- Payment authority: `SHOPIFY`
- Checkout execution leaves `stonerusa.com` and proceeds through Shopify-hosted checkout infrastructure.

## 4) Woo vs Shopify Evidence Summary

### Production (`stonerusa.com` + `shop.stonerusa.com`)

- Woo active in production host: `NO EVIDENCE`
- Shopify active in production flow: `YES`
- Production order authority appears Shopify-based.

### Staging (`staging.stonerusa.com`)

- Woo active: `YES`
- Evidence includes Woo scripts/meta/endpoints:
  - `woocommerce` assets and `meta name="generator" content="WooCommerce 11.2.1"`
  - Woo cart/checkout routes
  - `/wp-json/wc/store/v1/cart` -> `200`
- `wp-shopify` is also present in staging, indicating mixed plugin presence.

## 5) Real Order Authority Classification

`REAL_ORDER_SYSTEM=HYBRID`

Current evidence-backed mapping:

- content/landing authority: `WordPress (stonerusa.com)`
- product/catalog browsing + cart authority: `Shopify (shop.stonerusa.com)`
- checkout/payment authority: `Shopify (shop.app/Shopify checkout)`
- order creation authority: `Shopify`
- refund/cancellation status authority: `Shopify` (for real production orders under current flow)
- current Genesis ingress path configured today: Woo webhook (not currently aligned with production order authority)

## 6) Current Production Order Event Path

Observed path:

1. user lands on `stonerusa.com` (WordPress content)
2. user enters catalog/cart on `shop.stonerusa.com` (Shopify)
3. checkout redirects to Shopify checkout (`shop.app/checkout/...`)
4. payment/order completion occurs in Shopify order system

Result:

`CURRENT_WOO_WEBHOOK_CAN_RECEIVE_REAL_STONER_ORDER=NO`

Reason: current real production order authority is Shopify; Woo webhook ingestion does not sit on the active production order path.

## 7) Attribution Insertion Point

Best-fit insertion layer for current production architecture:

`C + D` represented operationally as `HYBRID_BRIDGE`:

- capture on WordPress landing (`stonerusa.com`) from `genesis_attribution`
- persist in WordPress/browser session
- transfer canonical attribution into Shopify cart/checkout/order metadata

Required metadata continuity fields:

- `touchId`
- `trackingIdentityId`
- `canonicalPartnerId`
- `campaignId` (optional)

## 8) Metadata Survival Strategy (Production Target)

For current production authority (Shopify), metadata survival should use Shopify-supported channels end-to-end:

- cart-level attributes and/or line item properties (capture phase)
- checkout/order attributes or metafields (order phase)
- webhook payload extraction for Genesis adapter ingestion

Woo order meta keys remain valid for Woo-only paths but are not sufficient for current production Shopify order authority.

## 9) Webhook Strategy Decision

Recommended future Genesis ingress strategy:

`C. support both Woo + Shopify`

- keep Woo webhook for Woo/staging/backward compatibility use cases
- add bounded Shopify webhook adapter for production order/refund authority
- enforce adapter-level idempotency and canonical ledger mapping parity with Woo path

## 10) Staging vs Production Comparison

`SAME_COMMERCE_ARCHITECTURE=NO`

- staging: WordPress + active WooCommerce checkout/order path
- production: WordPress marketing shell + Shopify cart/checkout/order path

## 11) Existing WordPress/Woo Bridge Disposition

Disposition: `C. PARTIALLY_REUSABLE_FOR_PRODUCTION`

Reusable components:

- token signing/verification contract parity
- secure capture/persistence patterns
- canonical attribution payload fields and validation semantics

Not directly authoritative for current production checkout/orders:

- Woo hook/order-meta attachment path (production order authority is Shopify)

## 12) Daniel Referral Readiness

Publish status now: `NO`

Classification:

- readiness: `ROUTE_CHANGE_REQUIRED`
- token usability: `TOKEN_REISSUE_REQUIRED` after certified production handoff path is finalized

Reasoning:

- production flow must be wired to preserve attribution into Shopify order authority first
- referral route/hand-off behavior must be certified on active production architecture before public rollout

## 13) Backend / Payout / Guardrail Invariants

Audit remained read-only with no mutating operations.

Expected canonical baseline remains:

- `revision=13`
- SHA-256 `ea144a01d7791858da2baf8d99f9e493e56ed29fb052681119d6cb855f7a0b91`
- `REAL_PRODUCTION_WOO_EVENTS=0`

Runtime safety reconfirmed during this audit window:

- ECS `1/1/0`, rollout `COMPLETED`
- target `healthy`
- `/api/health` `200`
- unsigned Woo probe `401`
- CloudWatch alarms in `ALARM`: `0`

Payout safety requirement remains:

- `AUTOMATED_EXTERNAL_PAYOUTS_ENABLED=NO`
- provider calls `0`
- transfers `0`

Page Factory boundary:

- no Page Factory access/modification
- `PAGE_FACTORY_DRIFT_RISK=NO`

## 14) Implementation Direction

Selected direction: `C. HYBRID_BRIDGE`

Explanation:

- production landing shell is WordPress
- production cart/checkout/order authority is Shopify
- attribution must be captured near landing and transferred into Shopify-native order metadata/webhook events

## 15) Next Implementation Plan (No Implementation in This Phase)

1. Certify canonical production landing route for Daniel (`/q/{slug}` or approved equivalent) on `stonerusa.com`.
2. Implement/activate production attribution capture on WordPress landing (`genesis_attribution` verify + secure persistence).
3. Implement WordPress -> Shopify handoff:
   - map canonical fields into Shopify cart/order metadata channel
   - verify persistence through checkout initialization without purchase.
4. Build Shopify webhook adapter in Genesis (parallel to Woo):
   - webhook auth and signature verification
   - idempotent event processing
   - order/refund normalization to canonical commerce line model
   - ledger mapping parity with Woo adapter.
5. Execute non-purchase production certification matrix:
   - valid token, invalid token, expiry handling
   - session persistence behavior
   - metadata survival into Shopify order payload preview path.
6. Only after pass, run one controlled real order acceptance test under Daniel referral guardrails.

## Follow-up Implementation Status

Subsequent source implementation delivered the planned hybrid adapter surfaces:

- dedicated Shopify webhook route in Genesis source
- Shopify auth/idempotency/refund/cancel normalization path
- WordPress durable route + WordPress -> Shopify attribution handoff helpers
- production Shopify webhook secret created (not yet bound to live ECS task)

Current gate after implementation:

- `SHARE_TO_GROW_SHOPIFY_BRIDGE=BLOCKED_STOREFRONT_HANDOFF`
- reason: live production storefront deployment/activation and non-purchase handoff certification remain pending
- details: `docs/operations/share-to-grow-shopify-production-adapter.md`

## Final Status

`SHARE_TO_GROW_PRODUCTION_COMMERCE_ARCHITECTURE=PASS`

Next action:

"Implement the certified production attribution/commerce bridge for the actual order authority, then run non-purchase attribution certification before any real order."
