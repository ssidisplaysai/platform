# GPC-0001A-01 Operational Dependencies

Program: GPC-0001  
Work package: GPC-0001A-01  
Date: 2026-07-29

## 1. Dependency Register

| Dependency | Type | Required For | Failure Impact | Owner | Evidence |
|---|---|---|---|---|---|
| Node.js runtime (Node 20 in CI) | Runtime toolchain | Build/test consistency | Build validation failure | @genesis-build | .github/workflows/atlas-guardrails.yml:13 |
| Next.js runtime process | App runtime | UI/API availability | Service unavailable | @genesis-runtime | package.json:8 |
| PostgreSQL endpoint via DATABASE_URL | Data store | GLW and GOP persistence | API failures, job orchestration failure | @genesis-runtime | src/lib/glw/prisma.ts:10, src/platform/gop/runtime/prisma.ts:10 |
| Prisma adapters and client | Persistence adapter | DB connectivity | Runtime persistence failure | @genesis-runtime | src/lib/glw/prisma.ts:1, src/platform/gop/runtime/prisma.ts:1 |
| n8n webhook endpoint | External integration | GLW page generation workflow | Page generation job execution failure | @genesis-runtime | src/lib/glw/n8n.ts:181 |
| n8n webhook secret | Integration auth | Callback/webhook trust | Unauthorized or rejected callback flow | @genesis-security | src/lib/glw/n8n.ts:96, src/lib/glw/page-generation-api.ts:69 |
| GLW auth secrets | Access control | Operator session security | Unauthorized access or auth outage | @genesis-security | src/lib/glw/auth.ts:36, src/lib/glw/auth.ts:70 |
| GOP worker clients | Runtime orchestration | Dispatch/lease execution classes | Throughput degradation, queued work accumulation | @genesis-runtime | src/platform/gop/runtime/worker-registry.ts:13, src/platform/gop/runtime/queue-manager.ts:565 |
| Release approval governance | Operational gate | Production deployment authorization | Unapproved release risk | @genesis-engineering-lead | genesis/constitution/gpm-0001/Genesis-Release-Train.md:9 |

## 2. Service and Infrastructure Dependencies

Documented service dependencies:
1. GLW APIs depend on session auth and persistence.
2. Page generation APIs depend on n8n outbound webhook and callback path.
3. GOP orchestration surfaces depend on worker registration/heartbeat/lease patterns.

Documented infrastructure dependencies:
1. Database network connectivity to PostgreSQL.
2. Environment-variable secret injection in runtime environment.

Not documented in repository (open condition set):
1. DNS provider and records
2. SSL certificate authority and renewal path
3. Reverse proxy implementation and routing policy
4. Production compute platform rollout primitives

Evidence:
- INFRA_DESCRIPTOR_FILES=NONE (scan output, 2026-07-29)

## 3. Startup and Shutdown Dependency Ordering

Startup dependency order:
1. Secrets and environment availability
2. Database connectivity
3. Runtime process start
4. External integrations reachable
5. Worker protocol readiness

Shutdown dependency order:
1. Traffic gating
2. In-flight workload handling
3. Runtime process stop
4. Persistence disconnect verification

## 4. Dependency Risk Notes

1. Single shared DATABASE_URL for GLW and GOP increases blast radius if DB endpoint is degraded.
2. Missing repository-level DNS/SSL/proxy artifacts reduces auditability of edge dependencies.
3. External n8n integration availability directly impacts GLW page-generation job completion.
