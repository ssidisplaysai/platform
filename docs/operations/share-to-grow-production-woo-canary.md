# Share-to-Grow Production Woo Lifecycle Canary Certification

Date (UTC): 2026-10-13  
Branch: `infra/genesis-staging-runtime-v1`  
Phase status: `SHARE_TO_GROW_PRODUCTION_WOO_CANARY=PASS`

## Scope

Enabled only:

- host `share-to-grow.glwplatform.com`
- path `/api/share-to-grow/woocommerce/webhook`

Kept unchanged:

- health-only rule (`/api/health`)
- host catch-all 404 rule
- Page Factory default rule and routing
- STG service/task definition/IAM/secrets
- payouts (disabled)

## Listener Rule Mutation

- Rule ARN: `arn:aws:elasticloadbalancing:us-west-2:452630323448:listener-rule/app/Genesi-Runti-8hL31AGbz6rt/000f8789ed6774c4/b3b1e351dd74f9b7/7ce747ea588e30db`
- Priority: `9`
- Conditions:
  - `host-header = share-to-grow.glwplatform.com`
  - `path-pattern = /api/share-to-grow/woocommerce/webhook`
- Action:
  - forward to `arn:aws:elasticloadbalancing:us-west-2:452630323448:targetgroup/genesis-s2g-production/55f036c68e053f00`

## Route Certification

- `GET /api/health` => `200` with `{"status":"ok"}`
- `GET /` => `404` fixed response
- `GET /does-not-exist` => `404` fixed response
- unsigned Woo POST => `401 {"error":"MISSING_WOOCOMMERCE_WEBHOOK_SIGNATURE"}`
- unsigned Woo GET => `405`

Conclusion:

- Woo path reaches STG app (`YES`)
- other hostname paths remain blocked (`YES`)

## Source-Derived Woo Contract

Headers:

- `x-wc-webhook-signature` (HMAC SHA-256 base64 over raw body)
- `x-wc-webhook-topic`
- `x-wc-webhook-delivery-id`

Order payload essentials:

- `id`, `status`, `currency`, `total`, `date_paid_gmt`
- `meta_data` keys:
  - `_genesis_touch_id`
  - `_genesis_tracking_identity_id`
  - `_genesis_partner_id`
  - `_genesis_campaign_id`
- `line_items[]`:
  - `id`, `product_id`, `variation_id`, `quantity`, `subtotal`, `total`
  - cost metadata:
    - `_genesis_cogs`
    - `_genesis_inbound_freight_duty`
    - `_genesis_fulfillment_packaging`
    - `_genesis_payment_processing`

Refund payload essentials:

- `id`, `parent_id`, `amount`, `date_created_gmt`
- `line_items[]` with negative `total`
- `_refunded_item_id` meta for original line mapping

Cancellation path:

- `order.updated` with `status=cancelled`

## Canary IDs

- canary namespace: `s2g-prod-canary-20261013`
- orders:
  - `91013003` (auth ingress probe)
  - `91013011` (order, duplicate, partial refund, duplicate, cancellation, duplicate)
  - `91013012` (order, over-refund cap)
- receipt IDs:
  - `s2g-prod-canary-20261013-o3-d1`
  - `s2g-prod-canary-20261013-o1-d1`
  - `s2g-prod-canary-20261013-o1-r1`
  - `s2g-prod-canary-20261013-o1-c1`
  - `s2g-prod-canary-20261013-o2-d1`
  - `s2g-prod-canary-20261013-o2-r1`

## Event Sequence + Outcomes

1) `order.updated` (`o1-d1`)  
   - result: `processed`
   - processed line created
   - ledger earning created
   - pending entitlement created

2) replay `order.updated` same delivery/body (`o1-d1`)  
   - result: `replay`
   - no duplicate economics

3) `refund.created` (`o1-r1`, amount `20.00`)  
   - result: `partially_reversed`
   - refund summary:
     - customer refund `20.00`
     - economic reversal `20.00`
     - remaining net DMP `17.00`
     - brand loss `0.00`

4) replay `refund.created` same delivery/body (`o1-r1`)  
   - result: `replay`
   - no duplicate adjustment/reversal

5) cancellation via `order.updated status=cancelled` (`o1-c1`)  
   - result: `reversed`
   - remaining reversal applied once (`17.00`)

6) replay cancellation same delivery/body (`o1-c1`)  
   - result: `replay`
   - no duplicate reversal

7) `order.updated` (`o2-d1`)  
   - result: `processed`

8) `refund.created` (`o2-r1`, amount `50.00`)  
   - result: `reversed_with_brand_loss`
   - cap behavior:
     - customer refund `50.00`
     - economic reversal capped at `37.00`
     - remaining net DMP `0.00`
     - brand loss `13.00`

## Canonical State

Pre-phase baseline:

- `schema_version=1`
- `revision=1`
- SHA `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
- all counts `0`

Post-canary:

- `schema_version=1`
- `revision=7`
- `updated_at=2026-10-13 02:54:11.43932+00`
- SHA `6d856e874630854fcf9a05c59314aab004b9052dd3db474b20a076d64745181d`
- counts:
  - participants `0`
  - trackingIdentities `0`
  - ruleVersions `0`
  - ledgerEntries `6`
  - sourceEventReceipts `6`
  - processedCommerceLines `3`
  - payoutEntitlements `3`
  - commerceAdjustments `3`

## Invariant Validation

- schema valid: pass
- split bounds valid: pass
- negative amount violations: none
- referential integrity: pass
- duplicate receipts: `0`
- duplicate processed lines: `0`
- entitlement consistency: pass
- reversal cap valid: pass
- payout execution absent: pass
- canonical hash reproducible: pass

## Canary Isolation

- non-canary receipt IDs: none
- non-canary processed line keys: none
- non-canary adjustment order IDs: none
- no staging/Page Factory data contamination detected

## Payout Safety

- automated payouts: disabled
- external payout provider invocation: none
- external transfers: none
- entitlement states observed: `pending`, `reversed`

## Post-Canary Stability Window

- start: `2026-10-13T02:57:08.7034910Z`
- end: `2026-10-13T03:12:36.5030704Z`
- duration: `15.46m`
- 4 samples:
  - ECS `1/1/0`, rollout `COMPLETED`
  - target healthy
  - health `200`
  - unsigned Woo POST `401` (expected auth reject)
  - alarms in ALARM: `0`
  - persistence/db/secret/5xx error markers: `0`
  - no task restart
  - RDS `available`, `MultiAZ=true`, `PendingModifiedValues={}`

## Page Factory Boundary

No STG-caused changes to:

- PF ECS/tasks/ECR/IAM/secrets
- PF ALB default rule/target group
- PF DNS/DB grants/monitoring/source

`PAGE_FACTORY_DRIFT_RISK=NO`
