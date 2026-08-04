# 01 C1 Root Cause

Condition C1:

- Merge idempotency keys were process-local only.

Root cause:

- ContactMergeService used an in-memory map for idempotency.
- No durable persistence meant restart lost key history.
- Replay of the same idempotency key after restart could re-run merge behavior.

Risk produced:

- Duplicate merge request handling was not restart-safe.
- Operational replay behavior could diverge across process boundaries.

Resolution strategy:

- Persist idempotency keys in Contact durable state.
- Apply TTL-based retention and startup cleanup.
- Validate idempotency record integrity during recovery.
- Reject duplicate merge requests when a valid key is already present.
- Emit audit event and metrics for idempotency rejections and cleanup.
