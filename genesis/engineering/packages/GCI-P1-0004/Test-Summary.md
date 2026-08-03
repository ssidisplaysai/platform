# Test Summary

## Suite
- tests/compiler/runtime/manifest/manifest-runtime-factory.test.ts
- tests/compiler/runtime/manifest/manifest-runtime-registry-and-architecture.test.ts

## Command
npx jest tests/compiler/runtime/manifest --runInBand --coverage --collectCoverageFrom="src/compiler/runtime/manifest/**/*.ts"

## Results
- Test Suites: 2 passed, 2 total
- Tests: 9 passed, 9 total
- Snapshots: 0 total
- Runtime: 2.545 s

## Coverage Table
- Statements: 95.29%
- Branches: 84.21%
- Functions: 95.00%
- Lines: 97.36%

## Uncovered Lines
- src/compiler/runtime/manifest/ManifestRuntimeFactory.ts: 189, 208
- src/compiler/runtime/manifest/ManifestRuntimeRegistry.ts: 20-21

## Scope Notes
- Deterministic manifest identity and digest generation
- Immutability preservation
- Version lineage
- Supersedence behavior
- Replay linkage
- Certification linkage
- Duplicate registration overwrite behavior
- Registry ordering
- Architecture guardrails
- Validator failure path handling