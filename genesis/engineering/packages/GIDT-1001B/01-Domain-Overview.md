# 01 Domain Overview

Inventory platform domain purpose:

- Canonically own physical stock state, placement, commitment, and movement history.

Canonical ownership anchors:

1. InventoryItem
2. InventoryBalance
3. Warehouse
4. StorageLocation
5. Bin
6. Reservation
7. Allocation
8. Transfer
9. InventoryMovement
10. InventoryLedgerEntry
11. InventorySnapshot
12. Lot
13. SerialNumber
14. ExpirationRecord
15. ReorderPolicy
16. SafetyStockPolicy
17. InventoryStatus
18. InventoryMetadata
19. InventoryRelationship

Boundary posture:

1. Product definitions are foreign-owned and referenced only.
2. Inventory is canonical for stock quantity/state/lifecycle.
3. Shared platform is consumed as infrastructure only.
4. Mission Control remains observational only.

Tenant model:

1. All canonical Inventory entities are tenant-scoped.
2. Cross-tenant access/mutation is prohibited.

Approval basis:

- Model defines internal identity, lifecycle, invariants, and consistency boundaries without introducing runtime implementation.