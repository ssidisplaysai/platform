# GPC-0001A-02 RTO/RPO Matrix

Program: GPC-0001  
Work package: GPC-0001A-02  
Date: 2026-07-29

## 1. Method

RTO/RPO values are certified only when objective evidence exists.
If evidence is missing, values are explicitly Deferred and certification impact is documented.

## 2. Component Matrix

| Critical Component (A-01) | Owner | RTO | RPO | Evidence Source | Certification Status | Missing Evidence |
|---|---|---|---|---|---|---|
| Web/API runtime (Next.js) | @genesis-runtime | Deferred | Deferred | package.json:8 | Deferred | Production restore timing records and accepted objective target |
| GLW session auth | @genesis-security | Deferred | Deferred | src/lib/glw/auth.ts:36 | Deferred | Secret recovery execution evidence and recovery-time measurements |
| GLW job APIs | @genesis-runtime | Deferred | Deferred | src/app/api/glw/jobs/page/route.ts:4 | Deferred | End-to-end restore timing plus acceptable data-loss objective |
| GOP operations/metrics APIs | @genesis-runtime | Deferred | Deferred | src/app/api/gop/operations/route.ts:4 | Deferred | Operational recovery timing benchmarks under production conditions |
| GOP worker protocol APIs | @genesis-runtime | Deferred | Deferred | src/app/api/gop/workers/protocol/register/route.ts:4 | Deferred | Worker fleet re-registration timing and queue recovery evidence |
| PostgreSQL persistence | @genesis-runtime | Deferred | Deferred | src/lib/glw/prisma.ts:10; src/platform/gop/runtime/prisma.ts:10 | Deferred | External backup platform policy, retention policy, restore benchmarks, PITR capability evidence |
| n8n webhook integration | @genesis-runtime | Deferred | Deferred | src/lib/glw/n8n.ts:181 | Deferred | External n8n configuration backup and restore timing evidence |
| CI guardrail workflow | @genesis-build | Deferred | Deferred | .github/workflows/atlas-guardrails.yml:1 | Deferred | CI platform retention and recovery evidence |
| Release approvals governance | @genesis-engineering-lead | Deferred | Deferred | genesis/constitution/gpm-0001/Genesis-Release-Train.md:9 | Deferred | Governance artifact backup/restore and continuity evidence |

## 3. Coverage Result

Coverage requirement from this package:
1. Every critical component has an explicit RTO/RPO record.

Result:
1. Coverage complete (all critical components listed).
2. Numeric/objective values are not certifiable from repository-only evidence and are therefore Deferred.

## 4. Required Evidence To Certify Targets

Minimum required evidence set for each Deferred row:
1. Approved target value source (policy/ops authority).
2. Verification method used to measure RTO/RPO attainment.
3. Most recent verification date.
4. Owner sign-off.
5. Exceptions and risk acceptance if target not met.
