# 05 Validation Report

Environment:

1. OS: Windows
2. Node: v24.18.0
3. npm: 11.16.0
4. Prisma Client: v7.9.0 generated during validation

Required command results:

1. npm run typecheck
- PASS
- typecheck:app PASS
- typecheck:templates PASS

2. npm run test:template-validation
- PASS
- Suites: 1 passed, 1 total
- Tests: 1 passed, 1 total

3. npm run quality:ci
- PASS
- typecheck PASS
- lint:quality-gate PASS
- test:template-validation PASS
- test:quality-regression PASS

4. npm run test:quality-regression
- PASS
- Suites: 17 passed, 17 total
- Tests: 49 passed, 49 total

5. npm test -- --runInBand tests/gop
- PASS
- Suites: 31 passed, 31 total
- Tests: 87 passed, 87 total

Summary:

- C01 and C02 validation failures no longer reproduce.
- Shared baseline validation is restored.
