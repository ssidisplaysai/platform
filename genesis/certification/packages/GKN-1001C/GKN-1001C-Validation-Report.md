# GKN-1001C Validation Report

Environment:

1. OS: Windows
2. Node: v24.18.0
3. npm: 11.16.0
4. Jest: 30.4.1
5. Timestamp: 2026-08-05T10:20:26.0895903-07:00

Command results:

1. npm run typecheck
- PASS

2. npm run test:template-validation
- PASS
- Suites: 1/1 passed
- Tests: 1/1 passed
- Failures: 0
- Skips: 0
- Warnings: none reported

3. npm run quality:ci
- PASS

4. npm run test:quality-regression
- PASS
- Suites: 17/17 passed
- Tests: 49/49 passed
- Failures: 0
- Skips: 0
- Warnings: none reported

5. npm test -- --runInBand tests/knowledge tests/gop
- PASS
- Suites: 34/34 passed
- Tests: 131/131 passed
- Failures: 0
- Skips: 0
- Warnings: none reported

6. npm test -- --runInBand tests/gop/mission-control-knowledge.test.ts
- PASS
- Suites: 1/1 passed
- Tests: 5/5 passed
- Failures: 0
- Skips: 0
- Warnings: none reported
