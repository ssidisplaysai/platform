# Share-to-Grow Payment State and Financial Integrity

Date: 2026-10-13  
Branch: `fix/s2g-woo-payment-state-integrity`

## Root Cause

Genesis previously evaluated WooCommerce economic eligibility using webhook payload fields (`status`, `date_paid_gmt`, `total`) after signature verification.

That allowed a signed but stale or inconsistent webhook body to drive a `processed` financial outcome without independently verifying the current WooCommerce order state through an authenticated server-to-server authority path.

## Correction Summary

### 1. Authoritative Woo order verification (fail-closed)

For `order.created` and `order.updated` financial processing:

1. Verify webhook HMAC signature (unchanged).
2. Parse webhook order identity (`orderId`).
3. Fetch authoritative order state from WooCommerce REST API (`/wp-json/wc/v3/orders/{id}`) using server-to-server credentials.
4. Compare webhook-vs-authoritative invariants:
   - order id
   - status
   - total
   - currency
5. If verification is unavailable or mismatched, fail closed (no economics persisted).
6. Evaluate eligibility from authoritative order state, not from webhook-paid claims.

### 2. Idempotency and append-only preservation

No changes to core durability guarantees:

- source receipt idempotency remains keyed by `sourceEventId`
- payload-hash collision defense remains enforced
- canonical order-line idempotency remains enforced through durable processed-line commits
- ledger remains append-only (earnings/reversals only)

### 3. Cost completeness validation with a single valid accounting source

Fulfillment and payment processing now require one valid source per category:

- either line-level values for all lines
- or order-level actual values

Both sources simultaneously still fail closed as double-count prevention.

This preserves single-source accounting while preventing silent zero-cost processing caused by missing metadata.

### 4. Secure read-only operator audit evidence

The staging audit response now includes:

- repository revision
- persisted source receipts (filtered to evidence context)
- persisted processed lines
- persisted ledger entries
- persisted payout entitlements
- persisted commerce adjustments

Access controls are unchanged: staging-only + ALB Cognito identity header.

## Existing Processed Record with Later Unpaid/Inconsistent Woo State

Policy (no destructive rewrite):

1. Never delete or rewrite existing ledger/processed records.
2. Treat subsequent inconsistent state as a reconciliation incident.
3. Record and investigate via read-only audit evidence.
4. If correction is approved, apply append-only compensating adjustments/reversals through the controlled adjustment path.
5. Preserve full provenance between original entries and compensating records.

Automatic destructive rollback is explicitly disallowed.

## Required Runtime Configuration

Authoritative Woo verification requires:

- `GENESIS_WOOCOMMERCE_API_BASE_URL`
- `GENESIS_WOOCOMMERCE_API_CONSUMER_KEY`
- `GENESIS_WOOCOMMERCE_API_CONSUMER_SECRET`

When unavailable, order financial processing fails closed with `WOOCOMMERCE_ORDER_VERIFICATION_UNAVAILABLE`.

### Staging secret wiring

Staging runtime configuration expects these Secrets Manager entries:

- `genesis/staging/woocommerce-api-consumer-key`
- `genesis/staging/woocommerce-api-consumer-secret`

Both values must come from a WooCommerce REST API key pair scoped to staging and granted **Read** permission only. These credentials are supplied to ECS through task-definition secret references (never plaintext environment values).

## Validation

- targeted Woo integrity tests (new + existing): pass
- Share-to-Grow production regression suite: pass
- Share-to-Grow production typecheck: pass
