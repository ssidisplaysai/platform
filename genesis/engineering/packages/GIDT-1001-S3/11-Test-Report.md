# 11 Test Report

Environment:

1. OS: Windows
2. Node: v24.18.0
3. npm: 11.16.0
4. Jest: 30.4.1
5. Timestamp: 2026-08-06T16:37:16.5093018-07:00

Focused Slice 3 file:

1. npx jest --runInBand tests/inventory/gidt-1001-s3-foundation.test.ts: PASS
2. Suites: 1 passed
3. Tests: 10 passed
4. Failures: 0
5. Skips: 0
6. Warnings: 0

Inventory suite:

1. npm test -- --runInBand tests/inventory: PASS
2. Suites: 3 passed
3. Tests: 28 passed
4. Failures: 0
5. Skips: 0
6. Warnings: 0

Required evidence covered:

1. Inventory Item registration, invalid reference, duplicate identity, duplicate Product mapping, immutable identity, lifecycle transition, tenant isolation, deterministic listing
2. Warehouse registration, duplicate code, lifecycle behavior, stale-version rejection
3. Location parent validation, invalid parent rejection, duplicate code, recursive containment rejection, deterministic listing
4. Bin parent validation, duplicate code rejection, deterministic listing
5. Balance zero initialization, duplicate key rejection, invalid reference rejection, tenant mismatch rejection, deterministic availability, read-only query behavior
6. Runtime registration, deterministic startup, duplicate service rejection, no persistence created, no movement, reservation, or allocation services registered
7. Audit accepted and rejected evidence stability