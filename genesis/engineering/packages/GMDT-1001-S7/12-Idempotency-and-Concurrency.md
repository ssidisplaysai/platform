# 12 Idempotency and Concurrency

Controls:
- Tenant-scoped command-family idempotency keys.
- Stable payload fingerprints for replay acceptance and conflict rejection.
- Expected-version checks for work-order and operation mutation.
- No silent last-write-wins behavior.