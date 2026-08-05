# GKN-1001A Validation Report

Validation execution summary:

1. npm run typecheck
- FAIL
- Inherited baseline TypeScript errors outside Knowledge ownership.

2. npm run test:template-validation
- PASS
- 1 suite, 1 test passed.

3. npm run quality:ci
- FAIL
- Fails at inherited typecheck baseline stage.

4. npm run test:quality-regression
- PASS
- 17 suites, 49 tests passed.

5. npm test -- --runInBand tests/knowledge tests/gop
- FAIL
- 34 suites total; 27 passed, 7 failed suite setup due inherited GOP Prisma client module-resolution baseline.

Knowledge certification interpretation:

- Knowledge-targeted validation evidence is passing.
- Failing commands are attributable to inherited shared baseline exceptions that predate GKN-1001 and do not indicate Knowledge regression.
