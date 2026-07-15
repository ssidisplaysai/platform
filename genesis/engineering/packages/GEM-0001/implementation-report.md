# GEM-0001 Implementation Report

## 1. Audit Summary

Audited:
- Root `package.json` scripts
- `jest.config.js`
- test authoring patterns under `tests/` and `src/`
- CI workflow locations under `.github/workflows` and common alternatives

Findings:
- Repository `test` script previously ran `jest` only.
- Test inventory is mixed-runner:
  - Jest-authored suites
  - node:test-authored suites
- GCC-1002 compiler-core suites are node:test suites and already pass with `tsx`.
- No repository CI workflow file currently invokes tests.

## 2. Chosen Strategy (Lowest Risk)

Chosen approach:
- Keep both runners.
- Add deterministic suite classification by file content (`node:test` import detection).
- Route non-node:test suites to Jest.
- Route node:test suites to `tsx --test`.
- Run GCC-1002 compiler-core as explicit dedicated step.
- Make `npm test` delegate to aggregate `test:all`.

Why this is lowest risk:
- No mass test rewrites.
- No Foundation or architecture changes.
- No GCC-1002 runtime changes.
- Preserves Jest behavior for Jest suites and node:test behavior for node:test suites.

## 3. Changes Implemented

Scripts added/updated in root `package.json`:
- `test` -> `npm run test:all`
- `test:watch` -> `npm run test:jest -- --watch`
- `test:jest`
- `test:node`
- `test:compiler`
- `test:all`
- smoke verification scripts:
  - `test:jest:smoke`
  - `test:node:smoke`
  - `test:compiler:smoke`

New tooling files:
- `scripts/test-suite-classifier.mjs`
- `scripts/run-jest-suites.mjs`
- `scripts/run-node-suites.mjs`
- `scripts/run-all-tests.mjs`

Compatibility test adjustment:
- `src/core/runtime/MetadataRuntime.test.ts` converted from standalone script-style execution to `node:test` style to ensure authoritative discovery and avoid false Jest empty-suite failures.

Dependency update:
- Added dev dependency `tsx` and refreshed `package-lock.json`.

GCC-1002 documentation impact:
- Updated `genesis/engineering/packages/GCC-1002/RELEASE-READINESS.md` to record that tooling limitation is resolved by GEM-0001.

## 4. Non-Changes

- No Foundation artifacts changed.
- No GCC-1001 artifacts changed.
- No GCC-1002 runtime source changes.
- No CI workflow file changed (none present in repository workflows scope).
