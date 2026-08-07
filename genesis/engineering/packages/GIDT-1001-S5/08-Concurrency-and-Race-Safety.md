# 08 Concurrency and Race Safety

Optimistic concurrency enforced for:
- Reservation mutations against expected reservation and balance versions.
- Allocation mutations against expected allocation and balance versions.
- Conversion against expected reservation and balance versions.

Race safety coverage includes:
- Competing reservations on same balance.
- Competing allocations on same balance.
- Duplicate concurrent retries under same idempotency key.

Conflict outcomes are deterministic via explicit failure classifications.
