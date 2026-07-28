# 09 Validation Command Matrix

## Commands Executed
| Command | Exit | Result | Evidence |
|---|---:|---|---|
| npm ci --dry-run | 0 | PASS | evidence/npm-ci-dry-run.log |
| npm run lint | 1 | FAIL | evidence/npm-run-lint.log |
| npm test -- --runInBand | 1 | FAIL | evidence/npm-test-runInBand.log |
| npm run build | 1 | FAIL | evidence/npm-run-build.log |
| npm run typecheck:gbg-0003d | 0 | PASS | evidence/typecheck-gbg-0003d.log |
| npm run typecheck:gbg-0003f | 0 | PASS | evidence/typecheck-gbg-0003f.log |
| npm run typecheck:gbg-0003g | 1 | FAIL | evidence/typecheck-gbg-0003g.log |
| npm run typecheck:gbg-0003h | 0 | PASS | evidence/typecheck-gbg-0003h.log |

## Key Failure Signals
- Lint reports 456 problems (135 errors, 321 warnings).
- Test run reports 54 failed suites, 24 passed suites, 78 total; 1 failed test out of 325.
- Build fails at type checking with Registry operation type mismatch.
- gbg-0003g typecheck fails on missing ParseRecord.correlationId property.

## Outcome
Validation baseline is non-green for full-repository commit/push gating.