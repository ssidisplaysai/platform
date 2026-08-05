# 09 Independent Validation Evidence

Environment:

1. Timestamp: 2026-08-05T15:37:05.5222159-07:00
2. OS: Microsoft Windows NT 10.0.26200.0
3. Node: v24.18.0
4. npm: 11.16.0
5. Jest: 30.4.1

Baseline and state evidence:

1. Branch: feature/gkn-1001-knowledge-foundation.
2. HEAD: 59ef1d1e9175a600002ce7298c09521c77e04760.
3. Ancestor proof: bf831775d00a8f1fe5d7a620e6389c8b78c3ff8c -> 59ef1d1e9175a600002ce7298c09521c77e04760 (true).
4. Untracked at validation start: data/, genesis/engineering/validation/GPDT-1001V/.

Executed commands and outcomes:

1. npm run typecheck
- Passed.
- Includes Prisma generate, app typecheck, and template validation.

2. npm run quality:ci
- Passed.
- Includes typecheck, lint quality gate, template validation test, and quality regression test.

3. npm run test:quality-regression
- Passed.
- Suites: 17 passed, 0 failed.
- Tests: 49 passed, 0 failed.

4. npm run test:template-validation
- Passed.
- Suites: 1 passed, 0 failed.
- Tests: 1 passed, 0 failed.

5. npx jest --runInBand tests/product/gpdt-1001-product-foundation-runtime.test.ts
- Passed.
- Suites: 1 passed, 0 failed.
- Tests: 10 passed, 0 failed.

Command naming variance note:

1. npm run validate:templates is not defined in this repository and returns Missing script.
2. Equivalent governed evidence is captured by:
- npm run typecheck (includes typecheck:templates)
- npm run test:template-validation
- npm run quality:ci

Execution errors:

- No failing required validation command after mapping to repository script set.