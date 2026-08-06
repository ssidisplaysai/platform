# 04 Command And Query Surface

Command architecture contract:

- Authority: actor role and tenant scope.
- Required identifiers: aggregate IDs, product/location IDs, lot/serial IDs as applicable.
- Expected version: mandatory for mutable aggregate transitions.
- Idempotency key: mandatory for all external mutation commands.
- Validation sequence: shape, authority, tenant, references, invariants, concurrency.
- Atomicity boundary: single aggregate plus any explicitly coordinated balance updates.
- Audit evidence: command intent, actor, precondition outcome, result.
- Emitted conceptual events: immutable domain events.
- Fail-closed behavior: reject on any invalid precondition.

Command set:

1. RegisterInventoryItem
2. CreateWarehouse
3. CreateStorageLocation
4. CreateBin
5. ReceiveStock
6. PutAwayStock
7. AdjustInventory
8. ReserveInventory
9. ReleaseReservation
10. AllocateInventory
11. ReleaseAllocation
12. TransferInventory
13. PickInventory
14. MarkPacked
15. ShipInventoryMovement
16. ReturnInventory
17. QuarantineInventory
18. ReleaseFromQuarantine
19. ExpireInventory
20. RegisterLot
21. RegisterSerial
22. SetReorderPolicy
23. CreateInventorySnapshot

Command validation sequence template:

1. Validate command contract shape.
2. Validate tenant and authority.
3. Validate foreign references based on command type.
4. Verify expected versions on mutable targets.
5. Verify idempotency key and payload compatibility.
6. Load required aggregates and balance scopes.
7. Evaluate domain invariants.
8. Apply mutation facts within atomic boundary.
9. Persist canonical updates and ledger append.
10. Record audit, metrics, and observations.

Read-only query set:

1. GetInventoryItem
2. GetInventoryBalance
3. GetAvailability
4. GetWarehouse
5. GetLocation
6. GetBin
7. GetReservation
8. GetAllocation
9. GetMovement
10. GetLedgerHistory
11. GetLot
12. GetSerial
13. GetExpirationStatus
14. GetReorderStatus
15. ListInventoryByProduct
16. ListInventoryByWarehouse
17. ListInventoryByLocation
18. ListAvailableInventory
19. ListReservedInventory
20. ListAllocatedInventory
21. ListInTransitInventory

Query rules:

1. Queries are read-only.
2. Queries never mutate canonical state.
3. Projections are recomputable from canonical facts.
4. Analytics ownership remains outside Inventory where enterprise analytics platforms exist.