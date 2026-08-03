# GCI-P2-0001 Test Summary

## Replay Regression
Command:
`npx jest tests/compiler/runtime/replay --runInBand`

Result:
- Suites passed: 2
- Tests passed: 9
- Failures: 0

## IBR Validation
Command:
`npx jest tests/compiler/runtime/ibr --runInBand --coverage --collectCoverageFrom="src/compiler/runtime/ibr/**/*.ts"`

Result:
- Suites passed: 3
- Tests passed: 10
- Failures: 0

## Validation Coverage Areas
- Deterministic observation identity
- Deterministic normalization
- Immutable observations
- Replay linkage
- Manifest linkage
- Evidence linkage
- Certification linkage
- Version lineage
- Registry overwrite, ordering, retrieval, and deletion
- Architecture boundaries

## Status
Implementation validation completed successfully. Certification not started.