# 03 Aggregates

Aggregate modeling principles:

1. Aggregate root enforces local invariants and consistency boundary.
2. Cross-aggregate mutation is prohibited; cross-aggregate references are by ID only.
3. Aggregate transactional boundaries are explicit and fail closed on version conflicts.

Aggregate set:

1. InventoryItemAggregate
- Root: InventoryItem
- Contains: InventoryMetadata, InventoryRelationship (item-scoped)
- Boundary: item identity/status and ProductReference validity
- Prohibited direct mutation: external Product fields

2. InventoryBalanceAggregate
- Root: InventoryBalance
- Contains: quantity value objects, status markers
- Boundary: quantity consistency and location scope
- Prohibited direct mutation: bypassing movement/transaction rules

3. WarehouseAggregate
- Root: Warehouse
- Contains: StorageLocation roots by reference, warehouse metadata
- Boundary: warehouse-level operational state
- Prohibited direct mutation: direct cross-warehouse reassignment without transfer model

4. StorageLocationAggregate
- Root: StorageLocation
- Contains: Bin entities (where enabled)
- Boundary: location/bin containment and location status
- Prohibited direct mutation: recursive containment creation

5. ReservationAggregate
- Root: Reservation
- Contains: reservation lines/allocable fragments
- Boundary: reservable quantity commitments and expiration behavior
- Prohibited direct mutation: allocation without reservation state eligibility

6. AllocationAggregate
- Root: Allocation
- Contains: allocation lines
- Boundary: committed quantity lifecycle
- Prohibited direct mutation: commitment beyond allocatable quantity

7. InventoryMovementAggregate
- Root: InventoryMovement
- Contains: movement context, idempotency and correlation metadata
- Boundary: one movement application unit
- Prohibited direct mutation: source-of-truth quantity rewrite without movement application

8. InventoryLedgerAggregate
- Root: logical ledger stream (append-only)
- Contains: InventoryLedgerEntry entities
- Boundary: immutable history guarantees
- Prohibited direct mutation: destructive history rewrite

9. LotAggregate
- Root: Lot
- Contains: lot expiration and quarantine state
- Boundary: lot identity and lot-state transitions
- Prohibited direct mutation: lot identity reassignment

10. SerialNumberAggregate
- Root: SerialNumber
- Contains: serial status and current-location assignment
- Boundary: single-active-location uniqueness
- Prohibited direct mutation: duplicate concurrent active assignments

11. ReorderPolicyAggregate
- Root: ReorderPolicy
- Contains: SafetyStockPolicy linkage and thresholds
- Boundary: policy consistency and effective date ranges
- Prohibited direct mutation: invalid threshold ranges

Independence constraints:

1. InventoryBalance may not exist without valid InventoryItem reference.
2. Bin may not exist without valid StorageLocation.
3. StorageLocation may not exist without valid Warehouse.
4. Allocation may not exist independently from a valid reservation or explicit allocation authority reference.
5. LedgerEntry may not exist without associated movement fact.