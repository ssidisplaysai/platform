# GPC-0001A-05 Capacity Planning

Program: GPC-0001  
Work package: GPC-0001A-05  
Date: 2026-07-29

## 1. Purpose

Document current capacity assumptions and planning model based on repository-visible runtime behavior, without creating new infrastructure sizing claims.

## 2. Capacity Assumptions (Current Model)

| Domain | Current Assumption | Evidence Basis | Status |
|---|---|---|---|
| Runtime deployment unit | Single Next.js runtime process hosts GLW and Genesis API surfaces | A-01 topology baseline | Assumed in baseline |
| Persistence | GLW and GOP share DATABASE_URL boundary | Prisma clients in GLW and GOP runtime | Assumed in baseline |
| Metrics query window | GOP metrics endpoint reads capped event sample size | handleGetGopMetrics limit constraints | Implemented |
| Worker execution capacity | Worker assignment constrained by currentWorkload/maxCapacity | worker-registry scheduling filter and load ordering | Implemented |
| Queue lease utilization | Queue metrics compute lease utilization and latency percentiles | queue-manager metrics function | Implemented |

Evidence:
- genesis/audits/GPC-0001/work-packages/GPC-0001A-01/01-Production-Deployment-Topology.md:14
- src/lib/glw/prisma.ts:13
- src/platform/gop/runtime/prisma.ts:13
- src/lib/gop/events-api.ts:103
- src/platform/gop/runtime/worker-registry.ts:189
- src/platform/gop/runtime/worker-registry.ts:202
- src/platform/gop/runtime/queue-manager.ts:556
- src/platform/gop/runtime/queue-manager.ts:558
- src/platform/gop/runtime/queue-manager.ts:559

## 3. Capacity Planning Method

1. Establish baseline using current in-repo signals:
   - throughput/min,
   - queue depth and p95 wait,
   - worker load ratio,
   - average job duration,
   - failed/retry/dead-letter trends.
2. Define scale decision thresholds in operations authority records when external telemetry is available.
3. Validate capacity impact during controlled load, stress, and soak exercises.
4. Feed results into release-go/no-go criteria in A-04 process.

Evidence:
- src/components/gop/gop-operations-center.tsx:160
- src/components/gop/gop-operations-center.tsx:164
- src/components/gop/gop-operations-center.tsx:215
- src/lib/glw/page-generation-api.ts:325
- src/lib/glw/page-generation-api.ts:329
- src/platform/gop/runtime/queue-manager.ts:553

## 4. Database Performance Considerations

Repository-visible considerations:
1. Event metrics are derived from ordered queries on GopJobEvent with bounded limit.
2. Job durations are computed from startedAt/completedAt fields.
3. DB dependency failures are explicit runtime blockers.

Evidence:
- src/lib/gop/events-api.ts:112
- src/lib/gop/events-api.ts:114
- src/lib/glw/page-generation-api.ts:321
- src/lib/glw/prisma.ts:13
- src/platform/gop/runtime/prisma.ts:13

Certification condition:
1. DB engine-level performance analytics, index-health evidence, and managed DB tuning evidence are external and must remain in the Production Evidence Register.

## 5. Resource Utilization Expectations

Repository-level expected indicators:
1. Worker utilization represented by currentWorkload/maxCapacity.
2. Queue pressure represented by depth, retry, dead-letter, and latency percentiles.
3. Throughput represented by throughput/min snapshot field.

Evidence:
- src/platform/gop/runtime/worker-registry.ts:202
- src/platform/gop/runtime/queue-manager.ts:550
- src/platform/gop/runtime/queue-manager.ts:553
- src/platform/gop/runtime/queue-manager.ts:556
- src/components/gop/gop-operations-center.tsx:160

## 6. Capacity Planning Risks

1. No repository-defined hard capacity thresholds for compute, memory, or DB IOPS.
2. No repository-contained load generator or soak telemetry history.
3. External host/network scaling controls are not represented in repository.
