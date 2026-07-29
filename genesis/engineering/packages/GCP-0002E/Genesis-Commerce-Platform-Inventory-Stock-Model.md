# Genesis Commerce Platform Inventory Stock Model

## Stock Contract
Inventory stock records include:
1. stockId, organizationId, productId, and locationId.
2. unitOfMeasure.
3. onHandQuantity.
4. reservedQuantity.
5. allocatedQuantity.
6. damagedQuantity.
7. holdQuantity.
8. incomingQuantity.
9. availableQuantity (derived).
10. stockStatus and reorder metadata.
11. createdAt and updatedAt.

## Availability Formula
Available quantity is deterministically derived as:
1. availableQuantity = onHandQuantity - reservedQuantity - allocatedQuantity - damagedQuantity - holdQuantity.
2. incomingQuantity is tracked but does not directly increase available quantity.
3. Negative derived available quantity is bounded by validation rules and movement constraints.

## Status and Reorder Foundations
1. Stock status is derived from lifecycle-aware policy and available quantity.
2. Reorder recommendation is derived from configured thresholds and actionable lifecycle state.
3. Derived outputs are deterministic for identical inputs.
