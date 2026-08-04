# 09 GCT-1001A Condition Closure Matrix

Condition matrix:

- C1
- Title: Merge idempotency keys are process-local
- Closure status: CLOSED
- Evidence:
  - durable idempotency persisted in Contact state
  - restart persistence verified in tests
  - TTL and cleanup behavior verified
  - recovery validation present
  - duplicate post-restart merge rejection verified
  - audit and metrics evidence present

- C2
- Title: Contact observability routes lack explicit authorization
- Closure status: CLOSED
- Evidence:
  - resolver-backed authorization helper introduced
  - explicit action IDs for health and metrics routes
  - deny-by-default behavior verified
  - denied metrics surfaced
  - route tests cover authorized/unauthorized/invalid action paths

Blocking condition check:

- No remaining blocking conditions.
