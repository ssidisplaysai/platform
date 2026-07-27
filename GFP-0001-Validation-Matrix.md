# GFP-0001 - Validation Matrix

| # | Category | Command | Result | Notes |
|---|---|---|---|---|
| 1 | Prisma Migrate Deploy | `npx prisma migrate deploy --schema prisma/schema.prisma` | PASS | Applied pending additive GEA/GBA migrations |
| 2 | Prisma Migration Status | `npx prisma migrate status --schema prisma/schema.prisma` | PASS | Database schema up to date |
| 3 | Prisma Generate | `npx prisma generate --schema prisma/schema.prisma` | PASS | Prisma Client v7.9.0 generated |
| 4 | Prisma Validate | `npx prisma validate --schema prisma/schema.prisma` | PASS | Schema valid |
| 5 | GEA Regression | `npm test -- tests/gea` | PASS | 16 suites, 37 tests |
| 6 | GBA Regression | `npm test -- tests/gba` | PASS | 5 suites, 10 tests |
| 7 | GOP Regression | `npm test -- tests/gop` | PASS | 15 suites, 43 tests |
| 8 | GMP Regression | `npm test -- tests/gmp` | PASS | 24 suites, 95 tests |
| 9 | Full Genesis Regression | `npm test -- tests/gea tests/gba tests/gop tests/gmp` | PASS | 60 suites, 185 tests |
| 10 | Open Handle Diagnostics | `npm test -- tests/gea tests/gba tests/gop tests/gmp --detectOpenHandles` | PASS | 60 suites, 185 tests |
| 11 | Architecture Circular Check | `npx madge --circular --extensions ts,tsx --ts-config tsconfig.json src/lib/gba src/lib/gea src/lib/gmp src/platform/gop src/app/api/gba src/app/api/gea src/app/api/gmp src/app/api/gop` | PASS | No circular dependencies |
| 12 | ESLint | `npx eslint src/lib/gba src/lib/gea src/lib/gmp src/platform/gop src/app/api/gba src/app/api/gea src/app/api/gmp src/app/api/gop tests/gba tests/gea tests/gmp tests/gop` | PASS WITH WARNING | 0 errors, 1 warning (`groupBy` unused) |
| 13 | TypeScript | `npx tsc --noEmit --pretty false` | FAIL (Known Exception) | Pre-existing template placeholder debt in tools/genesis/templates/entity |
| 14 | Security Validation | `npm test -- tests/gop/authorization-resolver.test.ts tests/gmp/gmp-publishing-authorization-matrix.test.ts tests/gba/gba-executive-authorization.test.ts tests/gea/gea-planning-permission.test.ts` | PASS | 4 suites, 9 tests |
| 15 | Replay Validation | `npm test -- tests/deterministic-eko.test.ts tests/gea/gea-tool-execution.test.ts tests/gea/gea-orchestration-runtime.test.ts tests/gmp/gmp-recommendation-services.test.ts tests/gba/gba-executive-runtime.test.ts` | PASS | 5 suites, 32 tests |
| 16 | Compiler Determinism | `npx tsx --test tests/compiler/core/compiler-core-determinism.test.ts` | PASS | 1 test |
| 17 | Runtime Interoperability | `npm test -- tests/gop/execution-durability.test.ts tests/gop/runtime-fabric.test.ts tests/gea/gea-orchestration-api.test.ts tests/gba/gba-executive-api.test.ts` | PASS | 4 suites, 16 tests |
| 18 | Performance Benchmark | `npx tsx scripts/gop-v1-cert-benchmark.mts` | PASS | Benchmark JSON captured |
| 19 | Compiler Performance (Jest Attempt) | `npm test -- tests/compiler/discovery/performance-validation.test.ts` | FAIL (Non-Blocking) | File is a Node test, not a Jest suite |
| 20 | Compiler Performance (Correct Runner) | `npx tsx --test tests/compiler/discovery/performance-validation.test.ts` | PASS | Deterministic ingestion performance check |

## Finding Classification
- Blocker: None
- Major: TypeScript global template placeholder debt (known inherited exception)
- Minor: One ESLint warning
- Observation: Worker warning in some non-detect Jest runs
