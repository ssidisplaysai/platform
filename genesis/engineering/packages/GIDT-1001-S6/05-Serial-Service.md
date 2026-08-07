# 05 Serial Service

SerialNumberService responsibilities implemented:
- Register serial with tenant and inventory item validation.
- Enforce serial-code uniqueness.
- Enforce inventory item and lot-association compatibility.
- Bind serial to balance/location through approved command path.
- Require movement reference when active serial binding changes.
- Quarantine serial.
- Release serial from quarantine when expiration policy permits.
- Retire serial.
- Deterministic get/list behavior.
- Audit evidence and idempotency handling.
