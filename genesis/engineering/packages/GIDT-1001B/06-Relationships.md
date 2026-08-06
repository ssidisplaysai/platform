# 06 Relationships

Canonical relationships:

1. InventoryItem 1:N InventoryBalance
2. Warehouse 1:N StorageLocation
3. StorageLocation 1:N Bin
4. InventoryItem 1:N Reservation
5. Reservation 1:N Allocation
6. InventoryMovement 1:N InventoryLedgerEntry
7. InventoryItem 1:N Lot
8. InventoryItem 1:N SerialNumber
9. Lot 1:N ExpirationRecord
10. InventoryItem 0..N ReorderPolicy
11. ReorderPolicy 0..N SafetyStockPolicy

Reference-only relationships:

1. InventoryItem N:1 ProductReference
2. InventoryItem N:1 OrganizationReference
3. Reservation N:1 DocumentReference (optional)
4. Allocation N:1 AssetReference (optional)
5. InventoryMetadata N:1 KnowledgeReference (optional)

Constraint rules:

1. All parent entities must exist before child creation.
2. Relationship cardinality violations are invalid states.
3. Circular hard ownership is prohibited.
4. Cross-aggregate linkages are ID-based only.
5. Deletion semantics default to logical archival unless policy explicitly permits hard deletion.