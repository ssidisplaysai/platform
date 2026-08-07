# 13 Test Report

Environment:

1. OS: Windows
2. Node: v24.18.0
3. npm: 11.16.0
4. Jest: 30.4.1
5. Timestamp: 2026-08-06T17:05:59.0970474-07:00

Focused Slice 4 file:

1. npx jest --runInBand tests/inventory/gidt-1001-s4-movement-ledger.test.ts: PASS
2. Suites: 1 passed
3. Tests: 7 passed
4. Failures: 0
5. Skips: 0
6. Warnings: 0

Inventory suite:

1. npm test -- --runInBand tests/inventory: PASS
2. Suites: 4 passed
3. Tests: 35 passed
4. Failures: 0
5. Skips: 0
6. Warnings: 0

Required evidence covered:

1. successful increase adjustment
2. successful decrease adjustment
3. successful two-balance internal movement
4. invalid quantity rejection
5. insufficient quantity rejection
6. prohibited self-movement rejection
7. source and destination stale-version rejection
8. no partial mutation on failure
9. deterministic movement listing
10. duplicate accepted command replay behavior
11. conflicting idempotency reuse rejection
12. ledger append-only behavior and integrity verification
13. atomic source and destination balance updates
14. deterministic version increments
15. accepted, rejected, replay, and insufficient-stock audit evidence
16. runtime registration without reservation, allocation, or persistence services