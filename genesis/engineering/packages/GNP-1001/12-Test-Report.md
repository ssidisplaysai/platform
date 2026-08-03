# 12 Test Report

Executed validation:
1. `npm run typecheck` -> PASS
2. `npm run test:template-validation` -> PASS
3. `npm run quality:ci` -> PASS
4. `npm run test:quality-regression` -> PASS
5. `npm test -- --runInBand tests/notifications tests/gop/mission-control-notifications.test.ts tests/gop/mission-control-scheduling.test.ts tests/gop/mission-control-workflow.test.ts tests/gop/mission-control-messaging.test.ts tests/gop/mission-control-authorization.test.ts` -> PASS

Observed counts:
1. `npm run test:quality-regression` => 17 suites, 49 tests, 0 failures, 0 skips.
2. notification/missions scoped test run => 6 suites, 12 tests, 0 failures, 0 skips.

Known test environment note:
1. Jest setup in this workspace depends on Prisma client generation; a temporary local `DATABASE_URL` was used to generate the client before validation.
