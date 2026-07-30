# Genesis Commerce Event Catalog

## Catalog Governance
1. All events are immutable.
2. All events are versioned.
3. All events include correlation and causation metadata.
4. All events include deterministic idempotency keys.

## Quote Event Family
- QuoteCreated
- QuoteApproved
- QuoteRejected
- QuoteRevised
- QuoteCancelled

## Sales Order Event Family
- OrderCreated
- OrderApproved
- OrderReleased
- OrderCancelled
- OrderClosed
- OrderRevised

## Future Reserved Cross-Domain Events
- InvoiceCreated
- ShipmentCreated
- PurchaseOrderCreated
- ManufacturingJobCreated

## Lifecycle Expectations
1. Quote and Order events represent immutable business facts.
2. Future reserved events are contract placeholders for downstream domain publication boundaries.
3. Event family expansion is additive under minor version changes when backward compatible.

## Event Naming Standard
Use UpperCamelCase semantic names with aggregate-centric prefixes:
1. Quote*
2. Order*
3. Invoice*
4. Shipment*
5. PurchaseOrder*
6. ManufacturingJob*
