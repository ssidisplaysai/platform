# GBA-0006 Validation Matrix

## Completed
- Prisma client generation: PASS
- Prisma schema validation: PASS
- Finance migration deploy/status: PASS
- Focused finance test suites: PASS (5 suites, 9 tests)
- Full GBA regression: PASS (28 suites, 59 tests)
- Full GEA regression: PASS (16 suites, 37 tests)
- Full GOP regression: PASS (15 suites, 43 tests)
- Full GMP regression: PASS (24 suites, 95 tests)
- Open-handle diagnostics: PASS (83 suites, 234 tests)

## Exceptions
- `prisma migrate dev` failed in shadow DB due inherited prior migration dependency (`GeaMemoryCollection` missing in shadow context).
- Full Genesis regression remains inherited-fail outside Finance scope (51 failed, 92 passed, 143 total suites; 1 failed, 380 passed, 381 total tests).
- Full dependency scan includes inherited compiler cycle: `compiler/genome/pipeline-types.ts > compiler/genome/types.ts`.
- Additive migration was applied using `prisma migrate deploy` and confirmed by `prisma migrate status`.
