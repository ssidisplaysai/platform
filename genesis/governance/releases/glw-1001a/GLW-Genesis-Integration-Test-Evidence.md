# GLW Genesis Integration Test Evidence

Work Order: GLW-1001A
Date: 2026-07-30

## Environment
- Operating System: Windows
- Node.js: v24.18.0
- npm: 11.16.0
- Test Runner (Jest): 30.4.1
- PowerShell: 5.1.26100.8875
- Evidence Timestamp: 2026-07-30 13:36:05 -07:00

## Independent Re-Run Commands and Results

1. Command
- npm test -- tests/glw/genesis-platform-integration.test.ts

Result
- Status: PASS
- Test Suites: 1 passed, 1 total
- Tests: 8 passed, 8 total
- Failures: 0
- Skipped: 0
- Warnings: none in Jest output

2. Command
- npm test -- tests/glw

Result
- Status: PASS
- Test Suites: 2 passed, 2 total
- Tests: 30 passed, 30 total
- Failures: 0
- Skipped: 0
- Warnings: none in Jest output

3. Command
- npm test -- tests/gmc

Result
- Status: PASS
- Test Suites: 8 passed, 8 total
- Tests: 19 passed, 19 total
- Failures: 0
- Skipped: 0
- Warnings: none in Jest output

4. Command
- npm test -- tests/ear tests/ehc

Result
- Status: PASS
- Test Suites: 15 passed, 15 total
- Tests: 20 passed, 20 total
- Failures: 0
- Skipped: 0
- Warnings: none in Jest output

## Test Evidence Interpretation
All mandated certification test commands passed independently during GLW-1001A. No failing GLW-specific integration behavior was observed.
