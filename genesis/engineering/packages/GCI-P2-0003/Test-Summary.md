# Test Summary

## Test Commands
- npx jest tests/compiler/runtime/relationship --runInBand --coverage --collectCoverageFrom="src/compiler/runtime/relationship/**/*.ts"
- npx jest tests/compiler/runtime/foundation --runInBand
- npx jest tests/compiler/runtime --runInBand
- npx jest tests/compiler/runtime/evidence --runInBand
- npx jest tests/compiler/runtime/evidence-validation --runInBand

## Added Test Files
- tests/compiler/runtime/relationship/relationship-runtime-factory.test.ts
- tests/compiler/runtime/relationship/relationship-runtime-registry-and-architecture.test.ts

## Validation Coverage
- Determinism
- Immutability
- Relationship identity
- Directionality constraints
- Cardinality constraints
- Classification model coverage
- parent/child relationship behavior
- ownership relationship behavior
- membership relationship behavior
- containment relationship behavior
- dependency relationship behavior
- reference relationship behavior
- association relationship behavior
- confidence preservation
- provenance linkage
- lineage preservation
- replay linkage
- entity linkage
- registry behavior
- validator failures
- architecture guardrails

## Results
- Relationship Runtime focused regression: 2/2 suites passed, 7/7 tests passed, 0 failures.
- Replay Runtime regression proxy (foundation runtime suite): 3/3 suites passed, 5/5 tests passed, 0 failures.
- Full compiler runtime regression: 9/9 suites passed, 26/26 tests passed, 0 failures.
- Evidence Runtime regression: 4/4 suites passed, 14/14 tests passed, 0 failures.
- Evidence Validation Runtime regression: 2/2 suites passed, 6/6 tests passed, 0 failures.

## Availability Notes
- No standalone local IBR runtime regression suite exists in this repository baseline.
- No standalone local Entity runtime regression suite exists in this repository baseline.
