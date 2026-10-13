# Genesis Share-to-Grow WooCommerce bridge

WooCommerce's webhook UI offers no `refund.created` (or `order.cancelled`) topic. This plugin makes the real refund lifecycle observable by Genesis without synthetic payloads.

- **Cancellation** needs no bridge: a normal `order.updated` webhook with `status = cancelled` is treated by Genesis as the cancellation signal.
- **Refunds** are sent by this bridge. `order.updated.refunds[]` only lists refund ids and aggregate totals; it does not carry the original order line per refund line, so line-level economics cannot be derived from it for multi-line orders. Genesis therefore never infers refund lines from `order.updated`.

## Hook

`woocommerce_refund_created( $refund_id, $args )` (fired by `wc_create_refund()` after the refund and its line items are saved, before `woocommerce_order_refunded`).

## Payload (matches the Genesis refund parser)

```json
{"id":9001,"parent_id":812,"date_created_gmt":"2026-10-07T02:00:00Z","amount":"25.50",
 "line_items":[{"id":101,"quantity":-1,"total":"-5.50","meta_data":[{"key":"_refunded_item_id","value":"3"}]}]}
```

`_refunded_item_id` is the original order line the refund line belongs to (set by WooCommerce). A refund line without it is never sent (fail closed). Only product line items are sent; tax and shipping are out of scope for refund policy v1. Refunds entered as a bare amount with no line items carry no merchandise lines and are recorded by Genesis as `ignored_no_economics`; refund against the order lines in WooCommerce.

## Request

`POST` to `https://staging.glwplatform.com/api/share-to-grow/woocommerce/webhook` with:

- `X-WC-Webhook-Topic: refund.created`
- `X-WC-Webhook-Signature: base64(HMAC-SHA256(body, secret))` (WooCommerce's own scheme)
- `X-WC-Webhook-Delivery-ID: woo-refund-<orderId>-<refundId>` (stable; Genesis additionally dedupes on `refund:<orderId>:<refundId>`)

## Secret reuse

No new secret. At delivery time the bridge looks up the active WooCommerce webhook named `Genesis Share-to-Grow Staging`, topic `order.updated`, with the target delivery URL, and reads its secret through `WC_Webhook::get_secret()` in memory. The secret is not stored, logged or in source. If that webhook is missing, paused or mismatched, delivery fails closed and is retried within the bounded schedule.

## Environment gate

The bridge only runs when `home_url()`'s host is `staging.stonerusa.com`. Override only deliberately in `wp-config.php`:

```php
define( 'GENESIS_S2G_ALLOWED_HOSTS', 'staging.stonerusa.com' );
define( 'GENESIS_S2G_TARGET_URL', 'https://staging.glwplatform.com/api/share-to-grow/woocommerce/webhook' );
```

The plugin registers no REST route, admin endpoint, AJAX action, credentials or payout logic.

## Delivery, failure and recovery

Delivery runs in Action Scheduler (group `genesis-share-to-grow`), not in the refund request. Timeout 10 s, no redirects. A Genesis 2xx marks the refund (`_genesis_s2g_refund_delivered`). Anything else is logged to WooCommerce logs (source `genesis-share-to-grow`: order id, refund id, attempt, HTTP status or transport error code; never the secret or body) and retried at +60 s, +5 min, +15 min, +1 h (5 attempts total). After that `_genesis_s2g_refund_delivery_failed` is set on the refund with the reason, and an error is logged.

Recovery: fix the cause, then re-run one delivery, e.g. `wp eval 'do_action( "genesis_s2g_deliver_refund", ORDER_ID, REFUND_ID, 1 );'`. Re-sending is safe: the delivery id and Genesis refund identity are deterministic, so Genesis performs no second reversal.

## Install (staging only, not yet deployed)

Copy this directory to `wp-content/plugins/genesis-share-to-grow/` on the staging site and activate it. Do not install on production without a separate approval.

## Tests

`php integrations/wordpress/genesis-share-to-grow/tests/run.php` (dependency-free, stubs WooCommerce/WordPress). The Jest suite `woocommerce-refund-bridge-contract.test.ts` runs it when `php` is on PATH, feeds the golden two-line refund fixture through the Genesis parser, and checks the HMAC vector against Node.
