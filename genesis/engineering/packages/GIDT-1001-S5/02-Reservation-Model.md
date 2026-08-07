# 02 Reservation Model

Reservation contract now includes:
- reservationId, tenantId, inventoryItemId, inventoryBalanceId
- requestedQuantity, reservedQuantity, remainingQuantity
- status, optional warehouse/location scope
- externalRequestReference
- idempotencyKey
- version, createdAt, updatedAt, optional expiresAt
- commandMetadata and auditMetadata

Reservation statuses used:
- PENDING, ACTIVE, PARTIALLY_RELEASED, RELEASED, EXPIRED, CANCELLED, FULFILLED
