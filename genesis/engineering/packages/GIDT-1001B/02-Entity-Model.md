# 02 Entity Model

Entity template rules:

1. Canonical owner: Inventory Platform.
2. Identity: immutable canonical entity ID plus tenant boundary.
3. Required fields: domain-minimum fields needed for validity.
4. Optional fields: supplemental metadata or references.
5. Immutable fields: identity, tenant, origin references.
6. Mutable fields: lifecycle state, quantities, permitted metadata.
7. Prohibited ownership: Product definition, Commerce order state, Manufacturing execution, Finance accounting.

Primary entity catalog:

1. InventoryItem
- Purpose: stock-tracked item shell linked to Product reference.
- Identity: InventoryItemId, TenantId.
- Required: ProductReference, InventoryStatus, UnitOfMeasure.
- Mutable: status, metadata, reorder policy linkage.

2. InventoryBalance
- Purpose: source-of-truth quantity state at location/bin/lot/serial scope.
- Identity: InventoryBalanceId, TenantId.
- Required: InventoryItemId, OnHand, Available, Reserved, Allocated, location scope.
- Mutable: quantity fields through authorized movement/application.

3. Warehouse
- Purpose: top-level stock containment boundary.
- Identity: WarehouseId, WarehouseCode, TenantId.
- Required: code, status.
- Mutable: status, capacity metadata.

4. StorageLocation
- Purpose: warehouse sub-container for stock placement.
- Identity: StorageLocationId, LocationCode, TenantId.
- Required: WarehouseId, type, status.
- Mutable: status, capacity metadata.

5. Bin
- Purpose: fine-grain location container.
- Identity: BinId, BinCode, TenantId.
- Required: StorageLocationId, status.
- Mutable: status, capacity metadata.

6. InventoryMovement
- Purpose: atomic stock state transition instruction/result.
- Identity: MovementId, TenantId.
- Required: movement type, source/destination context, quantity, reason, timestamp, idempotency key.
- Mutable: lifecycle processing state only.

7. InventoryAdjustment
- Purpose: explicit correction movement with reason.
- Identity: AdjustmentId, TenantId.
- Required: quantity delta, reason code, actor reference.
- Mutable: none after application except audit annotations.

8. InventoryTransaction
- Purpose: correlation envelope for one or more related movements.
- Identity: TransactionId, TenantId.
- Required: correlation identifier, initiating reference.
- Mutable: processing state.

9. InventoryLedgerEntry
- Purpose: append-only immutable movement fact.
- Identity: LedgerEntryId, TenantId.
- Required: movement reference, quantity facts, timestamp.
- Mutable: none.

10. InventorySnapshot
- Purpose: point-in-time materialized quantity state.
- Identity: SnapshotId, TenantId.
- Required: captured-at time, scope, quantity values.
- Mutable: none.

11. Reservation
- Purpose: intent hold on reservable quantity.
- Identity: ReservationId, TenantId.
- Required: item scope, quantity, reason, expires-at policy.
- Mutable: state transitions, remaining quantity.

12. Allocation
- Purpose: committed stock assignment to execution context.
- Identity: AllocationId, TenantId.
- Required: reservation/work context, quantity.
- Mutable: state transitions, remaining quantity.

13. Transfer
- Purpose: managed cross-location/warehouse stock move.
- Identity: TransferId, TenantId.
- Required: source, destination, quantity.
- Mutable: lifecycle state.

14. ReceivingRecord
- Purpose: inbound receipt registration.
- Identity: ReceivingRecordId, TenantId.
- Required: source reference, quantity, product reference.
- Mutable: processing state.

15. PutAwayRecord
- Purpose: received-stock placement fact.
- Identity: PutAwayRecordId, TenantId.
- Required: receiving reference, destination location/bin.
- Mutable: processing state.

16. PickingRecord
- Purpose: pick execution stock fact.
- Identity: PickingRecordId, TenantId.
- Required: source location/bin, quantity, commitment reference.
- Mutable: processing state.

17. PackingState
- Purpose: packed stock commitment state.
- Identity: PackingStateId, TenantId.
- Required: pick reference, packed quantity.
- Mutable: status transitions.

18. Lot
- Purpose: batch tracking identity and quantity scope.
- Identity: LotId, LotCode, TenantId.
- Required: product reference, lot code.
- Mutable: status, expiration state.

19. SerialNumber
- Purpose: unit-level unique traceability identity.
- Identity: SerialNumberId, SerialCode, TenantId.
- Required: product reference, serial code.
- Mutable: status, current-location reference.

20. ExpirationRecord
- Purpose: date-state governance for lot/serial stock.
- Identity: ExpirationRecordId, TenantId.
- Required: manufacture date optional, best-before optional, expiration date optional by policy.
- Mutable: expiration status, quarantine flags.

21. ReorderPolicy
- Purpose: replenishment threshold policy.
- Identity: ReorderPolicyId, TenantId.
- Required: reorder point, review strategy.
- Mutable: thresholds, effective range.

22. SafetyStockPolicy
- Purpose: minimum operational stock threshold policy.
- Identity: SafetyStockPolicyId, TenantId.
- Required: safety quantity, effective range.
- Mutable: quantity and applicability scope.

23. InventoryStatus
- Purpose: normalized status code assignment.
- Identity: InventoryStatusId, TenantId.
- Required: status code.
- Mutable: permitted transition state.

24. InventoryMetadata
- Purpose: bounded supplemental key-value metadata.
- Identity: InventoryMetadataId, TenantId.
- Required: owner-entity reference.
- Mutable: permitted metadata keys.

25. InventoryRelationship
- Purpose: typed relation between inventory entities.
- Identity: InventoryRelationshipId, TenantId.
- Required: source, target, relationship type.
- Mutable: relation status.

26. ProductReference
- Purpose: foreign reference to Product canonical identity.
- Owner: Product platform (foreign).
- Inventory role: reference only.

27. OrganizationReference
- Purpose: foreign organization scope reference.
- Owner: Organization platform (foreign).
- Inventory role: reference only.

28. DocumentReference
- Purpose: foreign document linkage reference.
- Owner: Document platform (foreign).
- Inventory role: reference only.

29. KnowledgeReference
- Purpose: foreign knowledge semantics reference.
- Owner: Knowledge platform (foreign).
- Inventory role: reference only.

30. AssetReference
- Purpose: foreign asset linkage reference.
- Owner: Asset platform (foreign).
- Inventory role: reference only.