# 14 Validation Report

Environment:

1. OS: Windows
2. Node: v24.18.0
3. npm: 11.16.0
4. Jest: 30.4.1
5. Timestamp: 2026-08-06T17:05:59.0970474-07:00

Command results:

1. npm run typecheck: PASS
2. npm run test:template-validation: PASS, 1 suite, 1 test, 0 failures, 0 skips, 0 warnings
3. npm run quality:ci: PASS
4. npm run test:quality-regression: PASS, 17 suites, 49 tests, 0 failures, 0 skips, 0 warnings
5. npm test -- --runInBand tests/inventory: PASS, 4 suites, 35 tests, 0 failures, 0 skips, 0 warnings
6. npm test -- --runInBand tests/shared: PASS, 1 suite, 30 tests, 0 failures, 0 skips, 0 warnings
7. npm test -- --runInBand tests/knowledge: PASS, 3 suites, 44 tests, 0 failures, 0 skips, 0 warnings
8. npm test -- --runInBand tests/product: PASS, 1 suite, 15 tests, 0 failures, 0 skips, 0 warnings
9. npx jest --runInBand tests/inventory/gidt-1001-s4-movement-ledger.test.ts: PASS, 1 suite, 7 tests, 0 failures, 0 skips, 0 warnings

Notes:

1. Prisma client generation executed through npm pretypecheck and pretest hooks.
2. No validation command failed.