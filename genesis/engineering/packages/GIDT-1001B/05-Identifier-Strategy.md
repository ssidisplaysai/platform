# 05 Identifier Strategy

Identifier principles:

1. Every canonical Inventory entity has a globally unique immutable ID.
2. TenantId is mandatory in every canonical identity tuple.
3. Business-readable codes supplement but do not replace canonical IDs.
4. Foreign references keep original foreign IDs unchanged.

Canonical ID table:

1. InventoryItemId
2. InventoryBalanceId
3. WarehouseId
4. StorageLocationId
5. BinId
6. ReservationId
7. AllocationId
8. TransferId
9. MovementId
10. LedgerEntryId
11. SnapshotId
12. LotId
13. SerialNumberId
14. ExpirationRecordId
15. ReorderPolicyId
16. SafetyStockPolicyId
17. InventoryMetadataId
18. InventoryRelationshipId

Business code table:

1. WarehouseCode
2. LocationCode
3. BinCode
4. LotCode
5. SerialCode

Correlation and idempotency:

1. CorrelationId traces multi-step workflows.
2. IdempotencyKey deduplicates command/event replay impact.
3. CommandId and EventId are distinct values with independent uniqueness scopes.

No-ownership-transfer rule:

- ProductIdentifier, VariantIdentifier, and all foreign IDs remain external-owned references only.