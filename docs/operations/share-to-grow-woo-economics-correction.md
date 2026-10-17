# Genesis Share-to-Grow Woo Economics Correction (Staging)

Date: 2026-10-13  
Workstream: `S2G-WOO-ECONOMICS-CORRECTION`  
Branch: `fix/s2g-woo-unit-costs-staging`

## Scope

- Investigate why staging mis-attributed Daniel referral order `#665` to the organic rule.
- Correct collaborator allocation root cause in source (no ledger override).
- Extend and validate canonical financial waterfall inputs for WooCommerce.
- Preserve existing financial history and define reconciliation approach.

## Root Cause Findings

### Attribution defect (order #665)

Root cause is a canonical partner identity mismatch in staging runtime lineage:

- Daniel direct rule expects canonical partner identity support.
- Historical/founding id is `"daniel"` while canonical id is `"daniel-coffeen"`.
- If runtime only recognizes `"daniel"` (or lacks canonical compatibility change), the resolver falls through to organic.

Evidence in source/tests:

- Resolver compatibility for both ids is in [stoner-gym.ts](C:/Users/rober/Documents/Genesis V2/platform/src/modules/share-to-grow/reference/stoner-gym.ts).
- Canonical-id direct allocation is verified by [woocommerce-processor.test.ts](C:/Users/rober/Documents/Genesis V2/platform/src/modules/share-to-grow/__tests__/woocommerce-processor.test.ts).

### Waterfall accounting defect risk

Root cause was insufficiently distinct accounting dimensions at adapter boundaries:

- No explicit customer-paid shipping revenue input into DMP.
- No explicit outbound label cost channel.
- Order-level Woo actual cost metadata could be omitted or double counted against per-line values.
- Estimate-vs-actual label behavior needed strict gating.

## Code Corrections

### Canonical commerce model updates

- Added `customerShippingRevenueMinor` and `outbound_shipping_label` across canonical normalization in [commerce.ts](C:/Users/rober/Documents/Genesis V2/platform/src/modules/share-to-grow/commerce.ts).
- DMP now includes customer shipping revenue and deducts outbound label as a separate cost component.

### Adapter boundary updates

- Added shipping-revenue and outbound-label fields to Woo and Shopify money totals in:
  - [woocommerce.ts](C:/Users/rober/Documents/Genesis V2/platform/src/modules/share-to-grow/adapters/woocommerce.ts)
  - [shopify.ts](C:/Users/rober/Documents/Genesis V2/platform/src/modules/share-to-grow/adapters/shopify.ts)

### Woo payload parsing + safeguards

- Added order-level cost metadata support and allocation logic in [woocommerce-payloads.ts](C:/Users/rober/Documents/Genesis V2/platform/src/modules/share-to-grow/adapters/woocommerce-payloads.ts):
  - `_genesis_customer_shipping_revenue`
  - `_genesis_outbound_shipping_label_actual`
  - `_genesis_outbound_shipping_label_estimate`
  - `_genesis_order_fulfillment_packaging_actual`
  - `_genesis_payment_processing_fee_actual`
- Added weighted minor-unit allocation helper for multi-line orders.
- Fail-closed protections:
  - `DOUBLE_COUNT_WOOCOMMERCE_FULFILLMENT_PACKAGING`
  - `DOUBLE_COUNT_WOOCOMMERCE_PAYMENT_PROCESSING`
- Outbound shipping estimate is used only when explicitly enabled with `allowEstimatedOutboundShippingLabel`.

## Regression Coverage Added/Validated

- Customer-paid shipping revenue and outbound label normalization:
  - [commerce.test.ts](C:/Users/rober/Documents/Genesis V2/platform/src/modules/share-to-grow/__tests__/commerce.test.ts)
- Multi-line order-level cost allocation + estimate fallback + double-count fail-closed:
  - [woocommerce-payloads.test.ts](C:/Users/rober/Documents/Genesis V2/platform/src/modules/share-to-grow/__tests__/woocommerce-payloads.test.ts)
- Canonical Daniel direct selection on two-unit order #665 style input with one canonical line posting:
  - [woocommerce-processor.test.ts](C:/Users/rober/Documents/Genesis V2/platform/src/modules/share-to-grow/__tests__/woocommerce-processor.test.ts)

## Validation Results

Executed:

- `npm test -- --runInBand src/modules/share-to-grow/__tests__/commerce.test.ts src/modules/share-to-grow/__tests__/woocommerce-payloads.test.ts src/modules/share-to-grow/__tests__/woocommerce-processor.test.ts`
  - Result: pass after test-structure correction and expectation alignment.
- `npm run test:share-to-grow:production`
  - Result: **30 passed**, **0 failed** test suites; **172 passed**, **1 skipped**, **0 failed** tests.
- `npm run typecheck:share-to-grow:production`
  - Result: pass.

## Staging Runtime Investigation Status (Blocked: AWS Session Expired)

Attempted command:

- `aws sts get-caller-identity --output json`

Result:

- `Your session has expired. Please reauthenticate using 'aws login'.`

Because of this blocker, the following evidence is pending and must be collected after reauthentication:

1. Exact staging task revision + running image digest.
2. ECR digest -> image labels/metadata -> Git commit correlation.
3. Deployed runtime commit vs this branch comparison.
4. Confirmation whether staging runtime predates canonical Daniel compatibility commit.

## Historical Data Preservation

Order `#665` remains historical defect evidence.

- No ledger row deletion/overwrite/replay was performed.
- Reconciliation should be an append-only adjustment:
  - create corrective ledger entries referencing original posting ids,
  - record reason code `ATTRIBUTION_RULE_MISMATCH_DANIEL_CANONICAL_ID`,
  - preserve immutable audit trail linking original and correction entries.

## Deployment/Verification Plan (After Approval)

1. Reauthenticate AWS and capture staging runtime evidence (task def, image digest, commit mapping).
2. Build and publish candidate image from this branch.
3. Update staging service task definition only (no production changes).
4. Verify on staging:
   - direct Daniel referral -> `stoner-gym-daniel-direct-v1` (50/50),
   - organic/no-partner order -> `stoner-gym-organic-v1`,
   - recruited creator order -> creator split,
   - replay/refund flows remain idempotent and single-posting.
5. Produce post-deploy evidence log and request explicit production approval separately.
