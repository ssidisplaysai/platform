# GPC-0001A-03 Monitoring Strategy

Program: GPC-0001  
Work package: GPC-0001A-03  
Date: 2026-07-29

## 1. Purpose

Define the production monitoring model for GLW and Genesis runtime services using the certified topology and DR baselines from A-01 and A-02, without architecture redesign or runtime feature changes.

Baseline authorities:
- genesis/audits/GPC-0001/work-packages/GPC-0001A-01/01-Production-Deployment-Topology.md:11
- genesis/audits/GPC-0001/work-packages/GPC-0001A-01/04-Operational-Dependencies.md:7
- genesis/audits/GPC-0001/work-packages/GPC-0001A-02/06-External-Evidence-Register.md:11

## 2. Monitoring Model (As-Is)

Primary monitoring surfaces represented in repository evidence:
1. GOP operations snapshot endpoint for runtime state visibility.
2. GOP operations SSE stream for near-real-time monitoring updates.
3. GOP metrics endpoint derived from event-store persistence.
4. GLW dashboard metrics for page-generation health and throughput.
5. Worker heartbeat and lease lifecycle signals for queue/fabric health.
6. Dead-letter and retry lifecycle controls for operational recovery visibility.

Evidence:
- src/app/api/gop/operations/route.ts:2
- src/app/api/gop/operations/stream/route.ts:1
- src/app/api/gop/metrics/route.ts:2
- src/app/api/glw/dashboard/route.ts:2
- src/lib/gop/operations-api.ts:52
- src/lib/gop/events-api.ts:121
- src/lib/glw/page-generation-api.ts:329

## 3. Critical Component Monitoring Coverage

| Component (A-01) | Monitoring Owner | Health Signal(s) | Alert Trigger Basis | Evidence Status |
|---|---|---|---|---|
| Web/API runtime (Next.js) | @genesis-runtime | Operations snapshot availability; SSE stream continuity | Endpoint auth failures, stream poll errors, endpoint unavailability | In-repo signal coverage |
| GLW session auth | @genesis-security | Unauthorized/forbidden response rates on protected routes | Elevated 401/403 patterns on protected operator endpoints | In-repo signal coverage |
| GLW job APIs | @genesis-runtime | Dashboard metrics: total, active, complete, failed, avgDurationMs | Failed job growth, callback auth failures, retry conflict growth | In-repo signal coverage |
| GOP operations/metrics APIs | @genesis-runtime | Metrics endpoint sampleSize and derived metrics; snapshot generation cadence | Snapshot generation failure, metrics endpoint auth/permission errors | In-repo signal coverage |
| GOP worker protocol APIs | @genesis-runtime | Worker heartbeats, lease renewals, lease release outcomes | Worker auth failures, lease renewal failures, stale workers | In-repo signal coverage |
| PostgreSQL persistence | @genesis-runtime | DB dependency health as reported in operations health model; DB-required runtime startup checks | DATABASE_URL missing, persistence access failures | Partial (external DB platform telemetry required) |
| n8n webhook integration | @genesis-runtime + @genesis-security | n8n adapter status parsing and callback auth validation outcomes | Webhook timeout/failure, callback signature rejection, failed status responses | Partial (external n8n platform telemetry required) |
| Queue/fabric state | @genesis-runtime | Queue depth, retry depth, dead-letter depth, expired leases, queue wait p95, lease utilization | Retry/dead-letter spikes, lease expiration growth, queue latency degradation | In-repo signal coverage |
| CI guardrail workflow | @genesis-build | Build/test gate execution in guardrails workflow | Guardrail failure preventing certified release | In-repo signal coverage |
| Release approvals governance | @genesis-engineering-lead | Release approval and production release gate stages | Missing approval or unresolved blocker before production release | In-repo process coverage |

Evidence:
- src/lib/gop/operations-api.ts:12
- src/lib/gop/operations-api.ts:79
- src/lib/gop/operations-api.ts:87
- src/lib/gop/operations-api.ts:108
- src/lib/gop/events-api.ts:18
- src/lib/gop/events-api.ts:91
- src/lib/gop/events-api.ts:113
- src/lib/gop/events-api.ts:121
- src/lib/gop/workers-api.ts:29
- src/lib/gop/workers-api.ts:176
- src/lib/gop/workers-api.ts:201
- src/lib/glw/page-generation-api.ts:54
- src/lib/glw/page-generation-api.ts:69
- src/lib/glw/page-generation-api.ts:201
- src/lib/glw/page-generation-api.ts:325
- src/lib/glw/page-generation-api.ts:329
- src/platform/gop/runtime/queue-manager.ts:553
- src/platform/gop/runtime/queue-manager.ts:554
- src/platform/gop/runtime/queue-manager.ts:558
- src/platform/gop/runtime/queue-manager.ts:559
- src/platform/gop/runtime/worker-registry.ts:20
- src/platform/gop/runtime/worker-registry.ts:150
- src/platform/gop/runtime/prisma.ts:13
- src/lib/glw/prisma.ts:13
- src/lib/glw/n8n.ts:96
- src/lib/glw/n8n.ts:161
- .github/workflows/atlas-guardrails.yml:1
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:32
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:35

## 4. Required Monitoring Domains and Coverage Status

| Domain | Coverage | Implementation Source |
|---|---|---|
| System health monitoring | Implemented (repo-level) | Operations snapshot and health model in operations center |
| Service health monitoring | Implemented (repo-level) | Operations snapshot endpoint + stream |
| API health monitoring | Implemented (repo-level) | GLW/GOP protected API response behavior |
| Database health monitoring | Partial | Runtime DB dependency checks in Prisma clients; platform telemetry external |
| Background worker monitoring | Implemented (repo-level) | Worker registry heartbeat/health + worker protocol APIs |
| Scheduled job monitoring | Implemented (repo-level) | Queue/fabric metrics and execution class handling |
| Authentication monitoring | Implemented (repo-level) | 401 conditions + credential/session controls |
| Authorization monitoring | Implemented (repo-level) | 403 conditions + resolver decisions |
| Integration monitoring | Partial | n8n transport status and callback auth checks; external service telemetry external |
| Storage monitoring | Partial | DB dependency checks in code; storage platform telemetry external |
| Queue monitoring | Implemented (repo-level) | Queue depth, retry, dead-letter, expired lease metrics |
| Infrastructure dependency monitoring | Deferred to external evidence | DNS/SSL/proxy/hosting monitoring not represented in repo |
| Log collection | Deferred to external evidence | No central logging stack defined in repository |
| Log retention | Deferred to external evidence | No retention policy artifacts in repository |
| Metrics collection | Implemented (repo-level) | GOP metrics endpoint and operations center metrics cards |

## 5. Health Verification Approach

Repository-verifiable health checks:
1. Operations snapshot endpoint returns authenticated snapshot payload.
2. Operations stream emits heartbeat and snapshot events.
3. GOP metrics endpoint returns derived metrics payload with sample size.
4. GLW dashboard endpoint returns aggregate job metrics.
5. Worker protocol endpoints enforce signed token and worker identity checks.
6. Dead-letter retry path supports operational recovery loop.

Evidence:
- src/app/api/gop/operations/route.ts:5
- src/lib/gop/operations-api.ts:79
- src/lib/gop/operations-api.ts:84
- src/app/api/gop/metrics/route.ts:5
- src/lib/gop/events-api.ts:121
- src/app/api/glw/dashboard/route.ts:5
- src/lib/gop/workers-api.ts:45
- src/lib/gop/workers-api.ts:151
- src/app/api/gop/dead-letters/[id]/retry/route.ts:2

## 6. Service Availability and Readiness Indicators

Repository-defined indicators:
1. Queue depth and queue latency behavior.
2. Worker count, health state, and heartbeat freshness.
3. Failed execution and retry/dead-letter levels.
4. Throughput per minute and running job count.
5. API authorization-state correctness (401/403 boundaries).

Evidence:
- src/components/gop/gop-operations-center.tsx:158
- src/components/gop/gop-operations-center.tsx:159
- src/components/gop/gop-operations-center.tsx:160
- src/components/gop/gop-operations-center.tsx:164
- src/components/gop/gop-operations-center.tsx:197
- src/components/gop/gop-operations-center.tsx:228
- src/platform/gop/runtime/queue-manager.ts:553
- src/platform/gop/runtime/queue-manager.ts:554
- src/platform/gop/runtime/queue-manager.ts:558
- src/platform/gop/runtime/queue-manager.ts:559

## 7. External Evidence Conditions

The following monitoring controls are external to repository evidence and must be tracked in the A-03 external evidence register:
1. Uptime monitoring tooling and alert routing platform.
2. Centralized log aggregation and retention policy.
3. Cloud/host/database provider telemetry dashboards and alarms.
4. DNS/SSL/reverse-proxy synthetic checks and edge monitoring.

Certification condition: A-03 can be approved at documentation level with conditions, but cannot be unconditionally certified until external monitoring evidence is verified.
