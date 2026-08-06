# 07 Query Surface

Implemented deterministic read-only queries:

1. GetInventoryItem
2. ListInventoryItems
3. GetWarehouse
4. ListWarehouses
5. GetStorageLocation
6. ListStorageLocations
7. ListLocationsByWarehouse
8. GetBin
9. ListBins
10. ListBinsByLocation
11. GetInventoryBalance
12. ListInventoryBalances
13. ListBalancesByInventoryItem
14. ListBalancesByWarehouse
15. ListBalancesByLocation
16. GetAvailability

Query guarantees:

1. tenant isolation preserved
2. deterministic ordering
3. no mutation of canonical runtime state
4. no analytics ownership expansion