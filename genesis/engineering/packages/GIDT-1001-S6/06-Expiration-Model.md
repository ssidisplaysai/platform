# 06 Expiration Model

ExpirationRecord model tracks:
- expirationRecordId, tenantId, inventoryItemId.
- lotId or serialNumberId target.
- manufactureDate, bestBeforeDate, expirationDate.
- state (VALID, NEAR_EXPIRY, EXPIRED, QUARANTINED, RETIRED).
- evaluatedAt and version.
- commandMetadata and auditMetadata.

Date-ordering invariants are enforced deterministically.
