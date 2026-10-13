# STONER Share-to-Grow attribution bridge

Server-side WordPress attribution bridge for Genesis tokens with Woo + Shopify handoff support.

## What it does

1. Reads `?genesis_attribution=<token>` from incoming requests.
2. Verifies token signature and payload validity (`issuedAt`/`expiresAt` + organization scope).
3. Persists attribution for 30 days:
   - Woo session key: `genesis_share_to_grow_attribution`
   - first-party cookie: `genesis_share_to_grow_attribution` (`Secure`, `HttpOnly`, `SameSite=Lax`)
4. Handles durable collaborator route:
   - `/q/<public-slug>` (for example `/q/daniel-coffeen`)
   - generates short-lived signed token server-side
   - redirects to Shopify destination with `genesis_attribution`
5. Writes canonical Genesis metadata on Woo order creation when Woo checkout is active:
   - `_genesis_touch_id`
   - `_genesis_tracking_identity_id`
   - `_genesis_partner_id`
   - `_genesis_campaign_id` (optional)

## Token contract

Token query key: `genesis_attribution`  
Token shape: `<base64url-payload>.<base64url-signature>`

Signature:

- HMAC SHA-256 over the encoded payload
- base64url digest

Required payload fields:

- `organizationId`
- `touchId`
- `trackingIdentityId`
- `canonicalPartnerId`
- `issuedAt`
- `expiresAt`
- optional `campaignId`

## Secret model

The signing secret must be server-side only. Configure one of:

- `GENESIS_S2G_ATTRIBUTION_SIGNING_SECRET` constant in `wp-config.php` (preferred)
- `GENESIS_S2G_ATTRIBUTION_SIGNING_SECRET` environment variable

Optional organization override:

- `GENESIS_S2G_EXPECTED_ORGANIZATION` (defaults to `stoner`)

Optional route destination override:

- `GENESIS_S2G_SHOPIFY_DESTINATION_URL`

Optional public slug map override:

- `GENESIS_S2G_PUBLIC_SLUG_MAP` associative array:
  - key = public slug
  - value = `trackingIdentityId`, `canonicalPartnerId`, optional `campaignId`

Never expose the secret in HTML, JS, logs, QR payloads, Git, or browser storage.

## Install

Copy directory to:

`wp-content/plugins/stoner-share-to-grow/`

Activate plugin in WordPress admin.

## Tests

Run dependency-free PHP tests:

`php integrations/wordpress/stoner-share-to-grow/tests/run.php`
