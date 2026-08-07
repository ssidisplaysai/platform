# 10 Query Surface

Implemented read-only queries:

1. GetInventoryMovement
2. ListInventoryMovements
3. ListMovementsByInventoryItem
4. ListMovementsByBalance
5. GetLedgerEntry
6. ListLedgerEntries
7. ListLedgerByInventoryItem
8. ListLedgerByBalance
9. ListLedgerByMovement
10. VerifyLedgerIntegrity

Query guarantees:

1. read only
2. tenant isolated
3. deterministic ordering
4. no mutation side effects
5. no Finance accounting ownership
6. no analytics ownership migration