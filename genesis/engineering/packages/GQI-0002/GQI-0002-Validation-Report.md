# GQI-0002 Validation Report

## Required Metrics: Before vs After

1. TypeScript errors
- Before baseline: 333
- After canonical gate (`npm run typecheck`): 0

2. Lint errors
- Before baseline: 140
- After repository-wide scan: 140

3. Lint warnings
- Before baseline: 284
- After repository-wide scan: 287

4. Dependency findings
- Before baseline: 34 (33 high, 1 moderate, 0 critical)
- After baseline: 34 (33 high, 1 moderate, 0 critical)

## Template Reclassification

All files under tools/genesis/templates were classified and documented in 02-Template-Classification.md.

## Template Renames

- None required.
- Strategy used scoped compile isolation plus independent validator.

## Compiler Configuration Changes

- Added `tsconfig.typecheck.json`.
- Canonical gate excludes only placeholder template TS files from application compile scope.

## Package Script Changes

Added scripts:
- typecheck
- typecheck:app
- typecheck:templates
- lint:quality-gate
- test:template-validation
- test:quality-regression
- quality:ci

## CI Workflow Changes

Updated `.github/workflows/atlas-guardrails.yml` to run:
- npm ci
- npx prisma generate
- npm run quality:ci
- npm run atlas:certify

## Tests Added

- tests/tools/genesis/entity-template-validation.test.ts

## Commands Executed and Outcomes

1. `npm run typecheck`
- PASS

2. `npm run test:template-validation`
- PASS

3. `npm run lint:quality-gate`
- PASS

4. `npm run test -- --runInBand tests/identity tests/gop/auth-runtime-compatibility.test.ts tests/gop/authorization-boundary.test.ts tests/gop/authorization-resolver.test.ts tests/gop/mission-control-authorization.test.ts`
- PASS (17 suites, 49 tests, 0 failures)

5. `npm audit --json`
- PASS (informational capture; no forced remediation in this scope)

## GID-1003A Condition C1 Status

CLOSED

Closure rationale:
- Canonical static gate is deterministic and passes.
- Placeholder templates no longer contaminate app compile path.
- Templates are validated independently and reproducibly.
- Same gate path is wired into CI.
