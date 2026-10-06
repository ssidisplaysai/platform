# STONER WordPress / WooCommerce Share-to-Grow Bridge v1

## Purpose

This bridge carries Genesis-issued attribution evidence from a STONER QR/link visit into the WooCommerce order that later produces a signed webhook for Genesis. WordPress and WooCommerce are transport and commerce sources. They are not economic authorities.

## Required flow

1. Genesis resolves the durable QR/link identity and issues a short-lived, signed attribution token.
2. STONERUSA receives the token on the landing request.
3. The integration verifies the token server-side before storing it in the WooCommerce session.
4. The verified session survives product browsing, cart, checkout and payment redirects.
5. During order creation, the integration copies only verified attribution fields to protected order metadata:
   - `_genesis_touch_id`
   - `_genesis_tracking_identity_id`
   - `_genesis_partner_id`
   - `_genesis_campaign_id`
6. WooCommerce sends its signed order webhook using the raw request body.
7. Genesis verifies the Woo signature, parses that same raw body and applies attribution/economic rules.
8. Genesis alone calculates DMP, beneficiary allocation, ledger entries and payout entitlements.

## WordPress implementation requirements

The WordPress plugin/hook layer must treat the attribution token as opaque. It must not decode and trust unsigned URL parameters. Verification must occur against a server-side secret or a Genesis verification endpoint before session state is accepted.

Use an HttpOnly, Secure, SameSite=Lax cookie when a cookie is required outside the Woo session. Do not expose the signing secret to browser JavaScript. Do not store DMP, percentages, beneficiary amounts or payout values in browser/session-controlled fields.

At checkout, write Genesis metadata as protected/private Woo order metadata. Customer form fields must never be allowed to populate or overwrite Genesis keys.

## Woo webhook requirements

Configure order-created/order-updated and refund/cancellation events for the Genesis endpoint. Genesis must receive the unmodified raw request body plus Woo delivery/topic/signature headers. The shared webhook secret belongs in server-side secret management, never source control.

## Cost authority

Woo provides authoritative transaction facts such as product/variation, quantity, subtotal, total, discounts, order status and refund facts. Genesis must not trust arbitrary customer metadata for COGS, inbound freight/duty, fulfillment cost or economic percentages. Production cost enrichment must come from a controlled catalog/cost resolver or another approved server-side source.

## Acceptance test

A creator QR/link for Jessica must produce a $60 test line with $37 DMP and persist:

- STONER: $18.50
- Jessica: $12.95
- Daniel: $5.55
- three Pending payout entitlements

Then replay the webhook and prove no duplicate economics. Tamper with attribution and prove rejection. Issue a partial/full refund and prove append-only compensating entries before production certification.

## Gate

This bridge does not authorize external money movement. Automated payouts remain separately gated.
