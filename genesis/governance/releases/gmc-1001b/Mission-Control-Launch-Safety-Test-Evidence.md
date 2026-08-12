# Mission Control Launch Safety Test Evidence (GMC-1001B)

Date: 2026-07-30

## Test Execution
Command: npm test -- tests/gmc
Result: PASS

- Test Suites: 8 passed, 8 total
- Tests: 19 passed, 19 total

Command: npm test -- tests/ear tests/ehc
Result: PASS

- Test Suites: 15 passed, 15 total
- Tests: 20 passed, 20 total

## Added/Expanded Safety Evidence
1. Resolver-level negative coverage in tests/gmc/launcher.test.ts:
   - Missing metadata blocked
   - Protocol-relative path blocked
   - Unsafe schemes blocked
   - Non-loopback http blocked
   - URL credentials blocked
   - Backslash/control-char internal path blocked
2. Workspace/service-level enforcement in tests/gmc/workspace.test.ts:
   - BLOCKED_INACTIVE
   - BLOCKED_UNAVAILABLE
   - BLOCKED_INCOMPATIBLE
   - BLOCKED_INVALID_TARGET
   - BLOCKED_MISSING_METADATA
   - ALLOWED pathway retains safe target
3. Metadata behavior verification:
   - Blocked metadata does not include safeLaunchTarget
   - Allowed metadata includes safeLaunchTarget

## Evidence Interpretation
The remediation enforces launch policy centrally and demonstrates fail-closed behavior across resolver, service, API, and UI consumption paths.
