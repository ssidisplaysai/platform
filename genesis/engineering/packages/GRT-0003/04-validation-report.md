# GRT-0003 Validation Report

Focused validation:
- tests/runtime/services/runtime-services.test.ts: PASS (50 passed, 0 failed, 0 skipped)

Determinism repetitions:
- Run 1: PASS (50 passed, 0 failed)
- Run 2: PASS (50 passed, 0 failed)
- Run 3: PASS (50 passed, 0 failed)

Required matrix executed:
- npm run test:jest: FAIL (1 failed, 371 passed, 16 suites total)
  - Failure location: src/core/compilers/__tests__/GenesisCompiler.test.ts:707
  - Failure type: timing threshold assertion (`elapsed >= 10`) observed below threshold (9.51ms-9.77ms).
- npm run test:node: PASS (804 passed, 0 failed)
- npm run test:compiler: PASS (20 passed, 0 failed)
- npm test: PASS (aggregate run passed)
- npm run test:all -- --smoke: PASS

Additional validation:
- Source-only GRT-0003 TypeScript validation: PASS
- Touched-scope ESLint validation: PASS
- Touched-scope diagnostics: PASS
- Frozen-path diff verification for GRT-0001 and GRT-0002: PASS (unchanged)

Interpretation:
- Matrix jest failure is external to GRT-0003 touched scope and does not indicate runtime-services regression.
