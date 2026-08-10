# 21 Test Report

Focused Slice 10 command:
- npx jest --runInBand tests/manufacturing/gmdt-1001-s10-persistence-recovery.test.ts

Result:
- PASS
- Suites: 1 passed
- Tests: 5 passed

Coverage demonstrated:
- first-run READY
- restart durability for work order/routing/operation/product baseline/trace
- idempotency and stale-version preservation after restart
- corrupt manifest/schema/tenant mismatch rejection
- durable-write rollback behavior
- deterministic tenant partition ordering and isolation
