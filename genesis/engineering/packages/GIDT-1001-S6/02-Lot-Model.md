# 02 Lot Model

Lot contract includes:
- lotId, tenantId, inventoryItemId.
- productReferenceId and optional productVariantReferenceId context.
- lotCode, status.
- manufactureDate, bestBeforeDate, expirationDate.
- quantityTrackingMode and trackedQuantity.
- optional warehouse/location/balance scope.
- version, createdAt, commandMetadata, auditMetadata.

Lot identity remains Inventory-owned and product linkage remains indirect through Inventory Item ownership.
