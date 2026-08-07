# 04 Allocation Model

Allocation contract now includes:
- allocationId, tenantId, inventoryItemId, inventoryBalanceId
- optional reservationId
- allocatedQuantity, remainingQuantity
- status
- bound warehouse/location/bin scope
- externalRequestReference
- idempotencyKey
- version, createdAt, updatedAt
- commandMetadata and auditMetadata

Allocation statuses used:
- PENDING, ACTIVE, PARTIALLY_RELEASED, RELEASED, CANCELLED, FULFILLED
