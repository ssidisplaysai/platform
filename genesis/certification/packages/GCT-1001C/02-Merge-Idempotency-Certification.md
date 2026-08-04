# 02 Merge Idempotency Certification

Certification result: C1 CLOSED

Verified capabilities:

- Durable idempotency records persisted in contact state.
- Restart persistence confirmed by tests.
- TTL support present and configurable via runtime option mergeIdempotencyTtlMs.
- Cleanup policy present at recovery load and explicit cleanup API.
- Recovery validation enforces idempotency record integrity and timestamp ordering.
- Duplicate merge request after key persistence is rejected.
- Audit visibility present via MERGE_IDEMPOTENCY_REJECTED event.
- Metrics present for record count, rejections, and cleanup operations.

Evidence references:

- src/platform/contact/contracts/index.ts
- src/platform/contact/persistence/FileContactStore.ts
- src/platform/contact/persistence/PersistenceCoordinator.ts
- src/platform/contact/services/ContactMergeService.ts
- src/platform/contact/runtime/index.ts
- tests/contact/gct-1001-contact-foundation.test.ts
- tests/contact/gct-1001-contact-hardening.test.ts
