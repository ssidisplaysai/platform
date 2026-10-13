# STONER WordPress / WooCommerce → Genesis Handoff Contract v1

## Authority boundary
WooCommerce owns storefront, cart, checkout and commerce source records. Genesis remains authoritative for tracking identity, attribution, DMP allocation, collaborator/creator economics, ledger and payout accounting.

WooCommerce MUST NOT calculate or persist authoritative Share-to-Grow percentages or payout values.

## Attribution handoff
A visitor enters through a Genesis-controlled durable tracking URL such as `/q/{public-slug}`. Genesis resolves the canonical Partner/PartnerQRCode identity, records the qualified touch, and returns/sets correlation evidence for the STONER storefront.

WordPress persists correlation evidence through session → cart → checkout and writes these protected order metadata keys:

- `_genesis_touch_id`
- `_genesis_tracking_identity_id`
- `_genesis_partner_id`
- `_genesis_campaign_id` when applicable

Public slugs are presentation identifiers. Production economic attribution uses canonical Genesis Partner IDs.

## WooCommerce events required
The integration must emit replay-safe source events for:
- order created/paid
- material order update
- cancellation
- full refund
- partial refund

Each event retains Woo order ID, Woo line-item ID, event identity, event timestamp and organization/tenant identity. Webhook authenticity must be verified before normalization.

## Money contract
Provider decimal strings are converted exactly once at the adapter boundary into integer ISO-currency minor units. Genesis receives per line:
- gross merchandise
- allocated discount
- refund/return
- COGS
- allocated inbound freight/duty
- direct fulfillment/packaging
- allocated payment-processing cost

Taxes are excluded from DMP by default. Customer-paid shipping is excluded unless an explicit versioned rule states otherwise.

## Idempotency
Order key: `woocommerce:{orderId}`

Line key: `woocommerce:{orderId}:{lineItemId}`

A webhook/source-event idempotency key is additionally required so retries cannot create duplicate economic effects.

## Security
Webhook secrets belong in Genesis/WordPress secret storage, never Git. The server must verify WooCommerce webhook signatures. Browser-provided partner IDs are evidence only and must be reconciled against a valid Genesis tracking identity/touch. Economic rules are resolved only by Genesis.

## Developer acceptance
The WordPress implementation is complete only when a controlled order preserves Genesis attribution metadata into the Woo order and the resulting signed event can be normalized by Genesis without provider-specific economic logic.
