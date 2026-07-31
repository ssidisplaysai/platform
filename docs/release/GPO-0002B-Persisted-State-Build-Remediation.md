# GPO-0002B Persisted-State Build Remediation

## Original Error
- Command: `npm run build`
- Result: FAILED
- Exit code: `1`
- Failure phase: Next.js page-data collection
- Affected route: `/api/routings/[routingId]`
- Affected module: `src/modules/foundation/routing-repository.ts`
- Exception type: `FoundationPersistenceSerializationError`
- Message:
  - `Failed to parse persisted state at C:\Users\rober\Documents\Stoner Platform\platform\platform-v010-release\.gcp-foundation-data\routing-repository.json: EPERM: operation not permitted, open 'C:\Users\rober\Documents\Stoner Platform\platform\platform-v010-release\.gcp-foundation-data\routing-repository.json'`
- Filesystem operation attempted: read/open through `readFileSync`
- Failure path: inside `.gcp-foundation-data`

## Root Cause
The build imported state-backed foundation repositories during page-data collection. Those repositories execute `loadStateFromPersistence()` at module import time. `loadPersistedState()` treated a missing state file as a write-on-read initialization event, creating the state directory and JSON seed files during import.

Under Next.js production build page-data collection, multiple workers imported repository modules concurrently. On Windows, the first clean build could race between creating/replacing seed files and reading them, surfacing an `EPERM` open/read failure on `.gcp-foundation-data/routing-repository.json`.

A second build then succeeded only because the first failed build had already left repository-local persisted state behind.

## Persisted-State Execution Path
1. Route evaluation during build reached `/api/routings/[routingId]`
2. Route imported `src/modules/foundation/routing-repository.ts`
3. Repository executed `loadStateFromPersistence()` at module import time
4. `loadStateFromPersistence()` called `loadPersistedState()` from `src/modules/foundation/foundation-persistence.ts`
5. Missing state triggered directory/file creation in `.gcp-foundation-data`
6. Concurrent page-data workers attempted to open/read the same path during initialization
7. Build failed during page-data collection

## Architectural Correction
1. `loadPersistedState()` no longer creates directories or writes seed files when state is missing.
2. Missing persisted state now yields deterministic in-memory seed state with revision `0`.
3. Directory/file creation is deferred to write/reset paths only:
- `savePersistedState()`
- `resetPersistedState()`
4. This preserves runtime behavior for actual mutations while making build/import behavior deterministic and side-effect-free.

## Persisted-State Lifecycle
- Location: `.gcp-foundation-data/`
- Classification: runtime-generated durable application state
- Build-time contract: must not be required and must not be created during production build import/page-data collection
- Version control policy: must not be tracked
- Worktree policy: must not remain as unexplained untracked residue after build validation

## Generated Artifact Disposition
1. Added `.gcp-foundation-data/` to `.gitignore`.
2. Removed the locally generated copy after preserving failure evidence.
3. Confirmed repeated production builds no longer recreate it.

## Regression Coverage Added
- `src/modules/foundation/__tests__/foundation-persistence-build-contract.test.ts`

Covered behaviors:
1. Missing persisted state returns deterministic seed without creating artifacts.
2. First save after missing state initializes directory and file safely.
3. Malformed persisted state throws explicit `FoundationPersistenceSerializationError`.
4. Repository import does not create persisted-state artifacts when state is missing.

Existing related protections retained:
1. GLW route restoration tests
2. Site repository boundary tests

## Clean Build Results
### First Clean Build
- Command: `npm run build`
- Result: PASS
- Exit code: `0`
- `/glw`: compiled
- `/glw/pages`: compiled
- `.gcp-foundation-data` created: no

### Second Clean Build
- Command: `npm run build`
- Result: PASS
- Exit code: `0`
- `/glw`: compiled
- `/glw/pages`: compiled
- `.gcp-foundation-data` created: no

## Release-Gate Results
1. `npm run build` -> PASS, exit `0`
2. `npm run typecheck:production` -> PASS, exit `0`
3. `npm run lint:production` -> PASS, exit `0`
4. `npx jest --runInBand src/modules/foundation/__tests__/glw-entry-restoration.test.ts src/modules/foundation/__tests__/site-repository-boundary.test.ts src/modules/foundation/__tests__/foundation-persistence-build-contract.test.ts` -> PASS, exit `0` (11/11 tests)
5. `node tools/genesis/genesis.mjs doctor` -> Healthy, exit `0`
6. `node tools/genesis/genesis.mjs self validate` -> VALID, exit `0`

## Remaining Non-Release Debt
1. Broad full-repository TypeScript debt remains outside the production release gate.
2. Broad full-repository lint debt remains outside the production release gate.
3. `tools/genesis/genesis.mjs.bak` remains a separate hygiene candidate and was not changed here.
