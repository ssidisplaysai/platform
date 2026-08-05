# 05 Test Report

Environment metadata:

1. OS: Windows
2. Node: v24.18.0
3. npm: 11.16.0
4. Jest: 30.4.1
5. Timestamp: 2026-08-05T10:12:13.8074731-07:00

Focused assurance runs:

1. npm test -- --runInBand tests/knowledge/gkn-1001-knowledge-foundation.test.ts
- PASS
- Suites: 1 passed, 1 total
- Tests: 5 passed, 5 total
- Failures: 0
- Skips: 0
- Warnings: none reported

2. npm test -- --runInBand tests/gop/mission-control-knowledge.test.ts
- PASS
- Suites: 1 passed, 1 total
- Tests: 5 passed, 5 total
- Failures: 0
- Skips: 0
- Warnings: none reported

Required validation runs:

1. npm run typecheck
- PASS

2. npm run test:template-validation
- PASS
- Suites: 1 passed, 1 total
- Tests: 1 passed, 1 total

3. npm run quality:ci
- PASS

4. npm run test:quality-regression
- PASS
- Suites: 17 passed, 17 total
- Tests: 49 passed, 49 total

5. npm test -- --runInBand tests/knowledge tests/gop
- PASS
- Suites: 34 passed, 34 total
- Tests: 131 passed, 131 total

Result:

- All required validation passed.
