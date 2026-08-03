# GCI-P2-0001 Coverage Summary

## IBR Runtime Coverage
Command:
`npx jest tests/compiler/runtime/ibr --runInBand --coverage --collectCoverageFrom="src/compiler/runtime/ibr/**/*.ts"`

Jest output:
- Statements: 96.55%
- Branches: 85.89%
- Functions: 97.36%
- Lines: 97.60%

Per-file results:
- `src/compiler/runtime/ibr/IBRRuntimeFactory.ts`
  - Statements: 96.74%
  - Branches: 87.14%
  - Functions: 98.43%
  - Lines: 97.16%
- `src/compiler/runtime/ibr/IBRRuntimeRegistry.ts`
  - Statements: 94.44%
  - Branches: 75.00%
  - Functions: 90.00%
  - Lines: 100.00%
- `src/compiler/runtime/ibr/index.ts`
  - Statements: 100%
  - Branches: 100%
  - Functions: 100%
  - Lines: 100%

## Validation Status
Coverage meets implementation-validation requirements for the authorized IBR Runtime slice. Certification not started.