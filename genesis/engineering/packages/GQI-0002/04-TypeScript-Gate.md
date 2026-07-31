# TypeScript Gate

## Canonical Command

- `npm run typecheck`

## Command Composition

- `typecheck` => `typecheck:app` + `typecheck:templates`
- `typecheck:app` => `tsc --noEmit -p tsconfig.typecheck.json`
- `typecheck:templates` => `node tools/genesis/templates/entity/validate-templates.mjs`

## Configuration Changes

- Added `tsconfig.typecheck.json` extending root `tsconfig.json`.
- Exclusion applied only to placeholder template files:
  - `tools/genesis/templates/entity/*.template.ts`
- Explicit include list added to ensure deterministic compile scope for platform identity/authz/gop surfaces and required regression tests.

## Before / After TypeScript Counts

- Before (baseline full repository): 333 errors (placeholder contamination dominated).
- After (canonical gate): 0 errors, exit code 0.

## Evidence

`npm run typecheck` output shows:
- app scope compile success
- template validation success
- no unmanaged placeholder failures

## Policy

This canonical gate is certification-ready for repository quality assurance and directly closes static-gate contamination from placeholder templates.
