# 03 Merge Idempotency Hardening

Implemented changes:

- Added durable merge idempotency record contract in Contact persisted state.
- Added idempotency metrics fields:
  - mergeIdempotencyRecords
  - mergeIdempotencyRejections
  - mergeIdempotencyExpiredCleanups
- Added persisted state normalization for merge idempotency records.
- Added recovery validation for idempotency record shape and timestamps.
- Added startup cleanup policy for expired idempotency records.
- Added coordinator APIs:
  - recordMergeIdempotency
  - findMergeIdempotencyRecord
  - incrementMergeIdempotencyRejectionCount
  - cleanupExpiredMergeIdempotencyRecords
- Updated ContactMergeService to:
  - read persisted idempotency key before merge
  - reject duplicate merge key requests
  - persist key with configurable TTL
  - emit MERGE_IDEMPOTENCY_REJECTED audit event on duplicate request
  - refresh runtime metrics after idempotency mutations
- Added runtime option mergeIdempotencyTtlMs (default 86400000 ms).

Result:

- Restart-safe idempotency behavior.
- Deterministic lookup and duplicate-key scope conflict handling.
- TTL cleanup policy integrated into recovery and explicit cleanup path.
- Audit and metrics evidence available for condition closure.
