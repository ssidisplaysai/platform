# 12 Concurrency and Idempotency

Optimistic concurrency implemented for:
- lot metadata and lifecycle mutations.
- serial binding and lifecycle mutations.
- expiration record updates.

Tenant-scoped idempotency implemented for:
- lot registration and lifecycle transitions.
- serial registration and lifecycle transitions.
- expiration evaluation commands.

Rules enforced:
- same key and same payload replays prior result.
- conflicting payload for same key rejects deterministically.
- no duplicate entity creation or duplicate transition on retries.
