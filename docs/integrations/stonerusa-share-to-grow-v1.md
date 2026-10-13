# STONERUSA Share-to-Grow Commerce + Tracking Integration Contract v1

Status: implementation contract

## Purpose

Connect stonerusa.com commerce and public collaborator/creator links to the existing Genesis Partner & QR Identity Engine and Share-to-Grow economic pipeline without creating a second QR, attribution, or ledger authority.

## Existing Genesis authorities

- Partner / PartnerQRCode remain canonical partner and QR identities.
- Share-to-Grow owns deterministic line-level attribution, economic allocation, ledger, and payout accounting.
- STONERUSA is a commerce/event source. It does not calculate collaborator payouts.

## Public tracking contract

Human-facing examples:

- `https://stonerusa.com/daniel`
- `https://stonerusa.com/gym/{creator-slug}`

Durable QR target:

- `https://stonerusa.com/q/{public-slug}`

The QR encodes only the durable public redirect. Genesis resolves the canonical PartnerQRCode/tracking identity and versioned destination. Destination changes must not require QR reprinting.

A qualified redirect/touch must preserve at minimum:

- organization ID
- canonical partner ID
- canonical PartnerQRCode/tracking identity ID
- campaign ID when present
- touch ID
- occurred-at timestamp
- destination version
- first-party attribution token when the browser permits it

## Commerce event contract

STONERUSA sends an idempotent normalized source event for each order creation or adjustment.

Required order fields:

- channel
- external order ID
- organization ID
- currency
- conversion timestamp

Required line fields:

- external line ID
- product ID / SKU mapping
- quantity
- gross merchandise minor units
- allocated discount minor units
- refund/return minor units
- COGS minor units
- allocated inbound freight/duty minor units
- direct fulfillment/packaging minor units
- allocated payment-processing fee minor units

Taxes are excluded from DMP by default. Customer-paid shipping is excluded unless an explicit economic rule includes it.

## Idempotency

- order ingestion key: `{channel}:{externalOrderId}`
- line identity: `{channel}:{externalOrderId}:{externalLineId}`
- source event ID must be replay-safe
- webhook retries must not duplicate earnings or ledger entries

## Attribution evidence

Commerce ingestion should carry any available deterministic evidence:

- Genesis first-party attribution token
- creator/collaborator code
- canonical tracking identity
- campaign identity

Genesis then applies the active attribution policy. STONER GYM v1 uses last qualified collaborator/creator touch within 30 days unless an eligible deterministic source is present.

## Economic execution

For every normalized line:

1. calculate DMP
2. resolve attribution
3. resolve active versioned economic rule
4. allocate DMP exactly
5. post append-only ledger earnings idempotently
6. create payout entitlements in Pending state

STONER GYM reference economics:

- Daniel direct: 50% STONER / 50% Daniel
- Daniel-recruited creator: 50% STONER / 35% creator / 15% Daniel
- organic/unattributed: 100% STONER

These are configuration, not connector logic.

## Adjustments and refunds

Order changes are new source events. They must not mutate posted ledger history. Genesis records explicit adjustment/reversal entries and updates payout eligibility/accounting accordingly.

## Security

- authenticate inbound commerce events
- verify webhook signatures where supported
- enforce organization/tenant boundary
- never trust browser-supplied beneficiary percentages
- never accept payout calculations from STONERUSA
- secrets remain outside source control

## Initial integration boundary

The first live adapter should implement this contract for the commerce system actually backing stonerusa.com. Provider-specific webhook parsing belongs in an adapter layer and must terminate in the canonical Share-to-Grow commerce types.

No automated external payment execution is authorized by this contract.
