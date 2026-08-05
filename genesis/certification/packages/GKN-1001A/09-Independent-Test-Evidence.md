# 09 Independent Test Evidence

Evidence metadata:

1. OS: Microsoft Windows 11 Pro (10.0.26200)
2. Node: v24.18.0
3. npm: 11.16.0
4. Jest: 30.4.1
5. Timestamp: 2026-08-05T09:28:18.5568121-07:00

Command evidence:

1. npm run typecheck
- Result: FAIL
- Suites: N/A
- Tests: N/A
- Failures: TypeScript compilation failures
- Skips: N/A
- Warnings: N/A
- Failure files:
  - src/lib/glw/job-repository.ts
  - src/lib/glw/jobs.ts
  - src/lib/glw/prisma.ts
  - src/platform/gop/persistence/prisma-event-store.ts
  - src/platform/gop/runtime/prisma.ts

2. npm run test:template-validation
- Result: PASS
- Suites: 1 total, 1 passed
- Tests: 1 total, 1 passed
- Failures: 0
- Skips: 0
- Warnings: none reported

3. npm run quality:ci
- Result: FAIL
- Cause: Early failure at typecheck stage with same inherited TypeScript baseline exceptions.
- Suites/Tests: Not fully executed due upstream typecheck failure.

4. npm run test:quality-regression
- Result: PASS
- Suites: 17 total, 17 passed
- Tests: 49 total, 49 passed
- Failures: 0
- Skips: 0
- Warnings: none reported

5. npm test -- --runInBand tests/knowledge tests/gop
- Result: FAIL
- Suites: 34 total, 27 passed, 7 failed
- Tests: 104 passed, 0 test assertion failures in executed tests
- Failures: 7 suite setup failures
- Skips: 0 reported
- Warnings: none reported
- Failure mode: Cannot find module .prisma/client/default from @prisma/client/default.js in GOP Prisma execution repository import path.

Knowledge-focused interpretation:

- Knowledge-specific targeted suites passed.
- Broad GOP suite failures are inherited Prisma runtime baseline/dependency issues outside Knowledge module ownership.
