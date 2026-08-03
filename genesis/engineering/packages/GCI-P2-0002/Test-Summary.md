# GCI-P2-0002 Test Summary

## Executed Commands
1. `npx jest tests/compiler/runtime/replay tests/compiler/runtime/ibr tests/compiler/runtime/entity`
2. `npx jest tests/compiler/runtime/entity --coverage --collectCoverageFrom="src/compiler/runtime/entity/**/*.ts"`
3. `npx tsc --noEmit`

## Results
- Runtime regression command:
  - 8 suites passed
  - 32 tests passed
  - 0 failures
- Entity coverage command:
  - 3 suites passed
  - 13 tests passed
  - 0 failures
- TypeScript diagnostics command:
  - global compile reports existing template-token parse errors in `tools/genesis/templates/entity/*.template.ts`
  - no Entity Runtime test failures or type contract failures surfaced in runtime-targeted execution

## Entity Runtime Test Domains Covered
- Deterministic reproducibility and ordering
- Immutability and provenance/lineage integrity
- Alias normalization and duplicate/near-duplicate handling
- Unresolved and conflicted identity handling
- Version lineage, supersedence, and retirement
- Registry registration/retrieval/list/delete determinism
- Validator failure behavior
- Architecture boundary guardrails
