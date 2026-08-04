# 06 Test Report

C1-specific test evidence:

- Updated foundation merge behavior test to assert duplicate idempotency key rejection.
- Expanded hardening matrix with tests for:
  - idempotency persistence across restart
  - duplicate merge rejection after restart
  - TTL cleanup behavior via expired persisted record
  - deterministic lookup behavior on cleaned/expired key
  - MERGE_IDEMPOTENCY_REJECTED audit evidence
  - merge idempotency metrics updates

C2-specific test evidence:

- Expanded mission-control contact tests for:
  - authorized request path
  - unauthorized request (missing session)
  - deny-by-default for session without permission
  - authorization denied metrics visibility in 403 payload
  - invalid action denial behavior via authorization helper

Stability adjustment:

- operations-api test updated with GLW_ADMIN_PASSWORD env to satisfy authentication initialization in runInBand suite context.

Result:

- Focused C1/C2 suites passed.
- Full required validation command matrix passed.
