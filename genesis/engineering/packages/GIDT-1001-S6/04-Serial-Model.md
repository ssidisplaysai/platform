# 04 Serial Model

Serial contract includes:
- serialNumberId, tenantId, inventoryItemId.
- serialCode and status.
- optional inventoryBalanceId and storageLocationId binding.
- optional lotId association.
- version, createdAt, commandMetadata, auditMetadata.
- optional lastMovementReferenceId for state-linked reassignment evidence.

Serial identity is unique within tenant and inventory item scope.
