# GBA-0002A - Validation Matrix

| # | Category | Command | Result | Notes |
|---|---|---|---|---|
| 1 | Prisma Migrate Deploy | `npx prisma migrate deploy --schema prisma/schema.prisma` | PASS | Applied `20260728002000_gba_operations_agent_v1` |
| 2 | Prisma Migration Status | `npx prisma migrate status --schema prisma/schema.prisma` | PASS | Database schema up to date |
| 3 | Prisma Generate | `npx prisma generate --schema prisma/schema.prisma` | PASS | Prisma Client v7.9.0 generated |
| 4 | Prisma Validate | `npx prisma validate --schema prisma/schema.prisma` | PASS | Schema valid |
| 5 | Focused GBA-0002 Tests | `npm test -- tests/gba/gba-operations-runtime.test.ts tests/gba/gba-operations-api.test.ts tests/gba/gba-operations-route-forwarding.test.ts tests/gba/gba-operations-workspace.test.tsx tests/gba/gba-operations-authorization.test.ts` | PASS | 5 suites, 11 tests |
| 6 | Full GBA Regression | `npm test -- tests/gba` | PASS | 10 suites, 21 tests |
| 7 | Full GEA Regression | `npm test -- tests/gea` | PASS | 16 suites, 37 tests |
| 8 | Full GOP Regression | `npm test -- tests/gop` | PASS | 15 suites, 43 tests |
| 9 | Full GMP Regression | `npm test -- tests/gmp` | PASS | 24 suites, 95 tests; known worker-exit warning observed |
| 10 | Full Genesis Regression | `npm test -- tests/gea tests/gba tests/gop tests/gmp` | PASS | 65 suites, 196 tests; known worker-exit warning observed |
| 11 | Open Handle Diagnostics | `npm test -- tests/gea tests/gba tests/gop tests/gmp --detectOpenHandles` | PASS | 65 suites, 196 tests |
| 12 | Architecture Circular Check | `npx madge --circular --extensions ts,tsx --ts-config tsconfig.json src/lib/gba src/lib/gea src/lib/gmp src/platform/gop src/app/api/gba src/app/api/gea src/app/api/gmp src/app/api/gop` | PASS | No circular dependency found |
| 13 | Security Validation | `npm test -- tests/gop/authorization-resolver.test.ts tests/gmp/gmp-publishing-authorization-matrix.test.ts tests/gba/gba-operations-authorization.test.ts tests/gea/gea-planning-permission.test.ts` | PASS | 4 suites, 9 tests |
| 14 | Replay Validation Subset | `npm test -- tests/gea/gea-tool-execution.test.ts tests/gea/gea-orchestration-runtime.test.ts tests/gmp/gmp-recommendation-services.test.ts tests/gba/gba-operations-runtime.test.ts` | PASS | 4 suites, 14 tests |
| 15 | Deterministic EKO Replay Suite | `npm test -- tests/deterministic-eko.test.ts` | FAIL (Known Exception) | 1 suite, 1 failed test outside GBA-0002 runtime path |
| 16 | ESLint Cross-Package | `npx eslint src/lib/gba src/lib/gea src/lib/gmp src/platform/gop src/app/api/gba src/app/api/gea src/app/api/gmp src/app/api/gop tests/gba tests/gea tests/gmp tests/gop` | PASS WITH WARNING | 0 errors, 1 inherited warning in src/lib/gmp/page-graph-service.ts |
| 17 | TypeScript Full Repository | `npx tsc --noEmit --pretty false` | FAIL (Known Exception) | Pre-existing template placeholder debt in tools/genesis/templates/entity |
| 18 | Documentation Presence Check | PowerShell `Test-Path` list for required docs | PASS | `ALL_REQUIRED_DOCS_PRESENT` |
| 19 | Operations Performance Benchmark | `npx tsx .tmp-gba-0002a-perf.ts` | PASS | Benchmark metrics captured in report |

## Finding Classification
- Blocker: None
- Major: TypeScript template placeholder debt; deterministic-eko suite failure
- Minor: One inherited ESLint warning
- Observation: Intermittent non-detectOpenHandles worker exit warning
