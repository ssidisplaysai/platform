# GPC-0001A-03 Operational Dashboard Requirements

Program: GPC-0001  
Work package: GPC-0001A-03  
Date: 2026-07-29

## 1. Purpose

Define required production dashboard views for continuous operational readiness using existing repository-proven monitoring surfaces.

## 2. Existing Dashboard and Telemetry Surfaces

| Surface | Source | Current Scope | Evidence |
|---|---|---|---|
| GOP Runtime Command Center UI | src/components/gop/gop-operations-center.tsx | Live operations view (executions, queues, workers, retries, health, alerts, notifications) | src/components/gop/gop-operations-center.tsx:149, src/components/gop/gop-operations-center.tsx:151 |
| GOP operations snapshot API | /api/gop/operations | Structured runtime state snapshot | src/app/api/gop/operations/route.ts:2, src/lib/gop/operations-api.ts:52 |
| GOP operations stream API | /api/gop/operations/stream | Real-time snapshot updates + heartbeat events | src/app/api/gop/operations/stream/route.ts:1, src/lib/gop/operations-api.ts:79 |
| GOP metrics API | /api/gop/metrics | Derived event metrics payload | src/app/api/gop/metrics/route.ts:2, src/lib/gop/events-api.ts:121 |
| GLW dashboard API | /api/glw/dashboard | Page-generation metrics and recent jobs | src/app/api/glw/dashboard/route.ts:2, src/lib/glw/page-generation-api.ts:329 |

## 3. Required Dashboard Domains

| Dashboard Domain | Required Indicators | Status |
|---|---|---|
| System health | overall health status, updated timestamp, DB health indicator | Defined by operations center model |
| Service health | operations API availability, stream continuity | Defined by operations endpoints and SSE |
| API health | auth/authorization response correctness, callback endpoint integrity | Defined by route handlers and auth checks |
| Database health | persistence dependency readiness, DB-related failures | Partially defined in repo; platform telemetry external |
| Worker health | worker count, heartbeat freshness, health state, load/capacity | Defined in operations center + worker registry |
| Queue health | queue depth, retry depth, dead-letter depth, expired leases, p95 wait | Defined in queue manager metrics |
| Integration health | n8n request success/failure and timeout conditions | Partially defined in adapter code; external platform telemetry external |
| Incident status | active alerts, notifications, failed executions | Defined in operations center |
| Readiness status | running jobs, throughput/min, release gate compliance | Partially defined in operations center + governance docs |

Evidence:
- src/components/gop/gop-operations-center.tsx:40
- src/components/gop/gop-operations-center.tsx:45
- src/components/gop/gop-operations-center.tsx:158
- src/components/gop/gop-operations-center.tsx:159
- src/components/gop/gop-operations-center.tsx:160
- src/components/gop/gop-operations-center.tsx:164
- src/components/gop/gop-operations-center.tsx:197
- src/components/gop/gop-operations-center.tsx:228
- src/lib/gop/operations-api.ts:79
- src/lib/gop/operations-api.ts:87
- src/lib/gop/events-api.ts:121
- src/lib/glw/page-generation-api.ts:325
- src/lib/glw/page-generation-api.ts:329
- src/platform/gop/runtime/queue-manager.ts:553
- src/platform/gop/runtime/queue-manager.ts:554
- src/platform/gop/runtime/queue-manager.ts:558
- src/platform/gop/runtime/queue-manager.ts:559

## 4. Dashboard Data Retention and Logging Conditions

Repository evidence does not define:
1. Centralized log collection platform.
2. Log retention period policy.
3. Metrics retention period policy.
4. External uptime/SLO dashboard tooling.

Certification handling:
1. These requirements are explicitly deferred and tracked in A-03 external evidence register.
2. No external telemetry assumptions are made without owner-provided evidence.

## 5. Health Verification Requirements

Dashboard operational verification for certification:
1. Snapshot endpoint returns data for authenticated authorized operators.
2. SSE stream provides heartbeat and snapshot events.
3. Queue and worker indicators are visible and refreshed.
4. Alert and notification sections are populated when runtime emits entries.
5. GLW metrics endpoint and dashboard endpoint return operational metrics payload.
