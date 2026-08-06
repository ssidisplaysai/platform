# 01 Slice Scope

Implemented in this slice:

1. InventoryItemService
2. WarehouseService
3. StorageLocationService
4. BinService
5. InventoryBalanceService foundation
6. InventoryFoundationQueryService
7. bounded Product reference validator registry and local Inventory-owned validators
8. runtime service registration hook for Slice 3
9. audit evidence emission for accepted and rejected operations
10. expected-version enforcement for mutable entity operations

Explicitly not implemented:

1. persistence
2. movement execution
3. ledger entries
4. reservation
5. allocation
6. transfer
7. receiving and put-away execution
8. picking and packing
9. lot, serial, expiration, reorder policy
10. HTTP APIs
11. Mission Control routes
12. live foreign integrations
13. Slice 4 work