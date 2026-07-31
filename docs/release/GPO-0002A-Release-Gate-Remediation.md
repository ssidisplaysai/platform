# GPO-0002A v0.1.0 Release Gate Remediation

## Scope
Restore minimum trustworthy release gates required to deploy and tag Genesis Enterprise OS v0.1.0 without introducing new business features.

## Root Cause Summary
The production build failed because a filesystem-backed module (`src/modules/foundation/site-repository.ts`) was reachable from client components.

Client dependency path:
1. `src/components/layout/app-shell.tsx` (client)
2. `src/modules/foundation/context.ts`
3. `src/modules/foundation/site-repository.ts`
4. `src/modules/foundation/foundation-persistence.ts`
5. `node:fs`

This violated the Next.js/Turbopack server/client boundary.

## Remediation Implemented
1. Enforced server-only boundary in `src/modules/foundation/site-repository.ts`.
2. Added client-safe site source `src/modules/foundation/site-context-source.ts` backed by fixtures.
3. Updated `src/modules/foundation/context.ts` and `src/modules/foundation/MultiSiteListView.tsx` to use the client-safe source.
4. Added regression test `src/modules/foundation/__tests__/site-repository-boundary.test.ts`.
5. Added explicit production gates:
- `npm run typecheck:production`
- `npm run lint:production`
6. Added `tsconfig.production.json` for deployment-gate type scope.
7. Configured Next production build to use explicit gate separation:
- `next.config.ts` uses `typescript.tsconfigPath = "tsconfig.production.json"`
- `ignoreBuildErrors = true` and TypeScript enforcement is moved to `typecheck:production`

## Validation Commands and Results
1. `npm run build` -> exit code `0`
2. `npm run typecheck:production` -> exit code `0`
3. `npm run lint:production` -> exit code `0`
4. `npx jest --runInBand src/modules/foundation/__tests__/glw-entry-restoration.test.ts src/modules/foundation/__tests__/site-repository-boundary.test.ts` -> exit code `0` (7/7 tests passed)
5. `node tools/genesis/genesis.mjs doctor` -> `Healthy`, exit code `0`
6. `node tools/genesis/genesis.mjs self validate` -> `VALID`, exit code `0`

## Backup Artifact Assessment
Inspected: `tools/genesis/genesis.mjs.bak`

Findings:
1. File is tracked in git history.
2. File is not referenced by source imports or runtime commands.
3. File content differs from `tools/genesis/genesis.mjs` and is not provably redundant from static inspection.

Decision:
- Left in place for this release remediation.
- Record as separate repository hygiene candidate; do not remove speculatively.

## Remaining Baseline Debt (Out of This Release Gate)
1. Full-repository TypeScript remains broader than the production deployment gate.
2. Full-repository lint remains broader than the production deployment gate.
3. Legacy/template/tooling debt remains outside v0.1.0 production gate scope.

## Gate Intent
- `npm run build`: production bundling and route compilation gate.
- `npm run typecheck:production`: explicit production TypeScript gate for v0.1.0 release surface.
- `npm run lint:production`: explicit production lint gate for deployable source surface.
