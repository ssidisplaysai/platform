# 17 Idempotency and Concurrency

Patterns applied:
- Tenant-scoped idempotency keys per command family
- Stable payload fingerprinting for replay conflict detection
- Expected-version optimistic concurrency checks
- Deterministic sort orders for all list query outputs
