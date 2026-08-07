# 10 Lot Serial Relationships

Relationship enforcement implemented:
- serial may reference lot.
- lot and serial must share tenant and inventory item scope.
- invalid lot association rejects deterministically.
- association updates are auditable through serial binding and registration actions.
