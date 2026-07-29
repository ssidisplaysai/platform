# Genesis Quote Pricing Snapshot Model

## Line Snapshot Fields
- Product references: productId, sku, productRevision, catalogRevision.
- Commercial detail: quantity, unitPrice, discount, extendedPrice.
- Classification: taxClassification, siteReference.
- Point-in-time marker: snapshotTimestamp.

## Totals Computation
- subtotal = sum(quantity * unitPrice)
- discountTotal = sum(discount)
- grandTotal = subtotal - discountTotal + taxPlaceholder + freightPlaceholder + fees

## Boundaries
- Tax and freight are placeholders in this foundation.
- No external pricing engine invocation is included.
