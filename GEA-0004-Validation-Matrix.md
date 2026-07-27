# GEA-0004 Validation Matrix

## Focused GEA-0004 Validation
- get_errors on orchestration runtime/API/repository/models/routes/workspace/tests: pass.
- Focused Jest suite: pass.
  - Command: npm test -- tests/gea/gea-orchestration-runtime.test.ts tests/gea/gea-orchestration-api.test.ts tests/gea/gea-orchestration-route-forwarding.test.ts tests/gea/gea-orchestration-workspace.test.tsx
  - Result: 4 suites passed, 9 tests passed.
- Focused ESLint on GEA-0004 surfaces: pass.

## Regression Validation
- Command: npm test -- tests/gea tests/gop tests/gmp
- Result: 55 suites passed, 175 tests passed.
- Note: Jest reported one worker forced exit warning indicating possible test teardown leak outside GEA-0004 scope.

## Persistence Validation
- Command: npx prisma validate
  - Result: schema valid.
- Command: npx prisma generate
  - Result: Prisma client generated.
- Command: npx prisma migrate status
  - Result: GEA migrations pending (expected, not applied in this implementation pass), including GEA-0004 migration.

## Repository-Wide Checks
- Command: npm run lint
  - Result: fails due to pre-existing non-GEA lint errors in tools/genesis modules.
- Command: npx tsc --noEmit
  - Result: fails due to pre-existing template placeholder compile errors in tools/genesis/templates.

## Endpoint and Workspace Coverage
- Orchestration list/detail/start/pause/resume/cancel/replay.
- Workflow list/detail.
- Timeline, approvals, health.
- Protected orchestration workspace render.
- Route forwarding coverage across orchestration/workflow API surface.
