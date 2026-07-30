# Genesis Quote Domain Model

## Aggregate
- Root: QuoteRecord.
- Identity: documentId, quoteNumber.
- Bounded ownership: organizationId and optional siteReference.

## Core Substructures
- Commercial terms: payment and freight references plus exchange rate.
- Line snapshots: immutable product and catalog references, unit pricing, discount, extended totals.
- Totals: subtotal, discount, tax placeholder, freight placeholder, fees, grand total.
- Revision history: revision metadata and snapshot set.
- Approval history: status progression with actor and timestamp.
- Conversion contract: request-only contract to downstream order domain.

## Invariants
- Quote line quantity must be positive.
- Unit price and discount must be non-negative.
- Discount cannot exceed line value.
- Expiration date cannot be earlier than effective date.
- Lifecycle transitions must satisfy state machine constraints.
