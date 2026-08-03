# GCI-P2-0002 Coverage Summary

## Command
`npx jest tests/compiler/runtime/entity --coverage --collectCoverageFrom="src/compiler/runtime/entity/**/*.ts"`

## Aggregate Coverage
- Statements: 96.13%
- Branches: 91.50%
- Functions: 96.77%
- Lines: 96.87%

## File-Level Highlights
- `EntityRuntimeFactory.ts`: 96.22% statements, 92.85% branches, 98.00% functions, 96.45% lines
- `EntityRuntimeRegistry.ts`: 94.44% statements, 75.00% branches, 90.00% functions, 100.00% lines
- `index.ts`: 100.00% statements, 100.00% branches, 100.00% functions, 100.00% lines

## Coverage Assessment
Coverage is sufficient for implementation-validation scope and includes direct tests for deterministic behavior, identity state handling, lifecycle/version lineage, and architectural boundary compliance.
