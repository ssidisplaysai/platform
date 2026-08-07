# 06 Reservation to Allocation Conversion

Conversion implementation enforces:
- Reservation exists and is mutable.
- Reservation tenant, item, and balance scope match.
- Quantity is positive and does not exceed reservation remaining quantity.
- Reservation expected version and balance expected version must match.

Atomic conversion behavior:
- Reserved commitment decreases.
- Allocated commitment increases by same quantity.
- Reservation remaining/reserved quantities and status update.
- Allocation record created exactly once.
- Idempotency record created.
- Any failure rejects without partial mutation.
