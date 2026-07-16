# GRT-0006 API Documentation

## RuntimeSchedule API

File: src/runtime/scheduling/RuntimeSchedule.ts
- snapshot(): RuntimeScheduleRecord

Purpose:
- Canonical immutable runtime schedule abstraction.

## RuntimeScheduleFactory API

File: src/runtime/scheduling/RuntimeScheduleFactory.ts
- identityFor(descriptor): string
- create(descriptor): RuntimeSchedule

Purpose:
- Deterministic schedule identity and canonical immutable schedule materialization.

## RuntimePlan API

File: src/runtime/scheduling/RuntimePlan.ts
- snapshot(): RuntimePlanRecord

Purpose:
- Canonical immutable runtime plan abstraction.

## RuntimePlanFactory API

File: src/runtime/scheduling/RuntimePlanFactory.ts
- identityFor(recordWithoutPlanId): string
- create(runtimeInstanceId, runtimeId, schedule, slot, plannedSequence, attempt, correlationId, causationId?): RuntimePlan

Purpose:
- Deterministic plan identity and canonical immutable plan materialization.

## RuntimeTriggerRegistry API

File: src/runtime/scheduling/RuntimeTriggerRegistry.ts
- evaluate(schedule, context): RuntimeExecutionSlot | undefined

Purpose:
- Deterministic trigger evaluation and execution-slot derivation.

## RuntimeExecutionWindow API

File: src/runtime/scheduling/RuntimeExecutionWindow.ts
- canExecute(sequence, policy): boolean
- isExpired(sequence, slot, expirationPolicy): boolean

Purpose:
- Deterministic execution-window and expiration gating.

## RuntimeRetryPolicyEvaluator API

File: src/runtime/scheduling/RuntimeRetryPolicy.ts
- derive(schedule, currentSequence, slot, previous?): RuntimeRetryState

Purpose:
- Deterministic retry derivation across supported policy types.

## RuntimePlanner API

File: src/runtime/scheduling/RuntimePlanner.ts
- planIfDue(runtimeInstanceId, runtimeId, schedule, plannedSequence, attempt, context, causationId?): RuntimePlanRecord | undefined

Purpose:
- Deterministic due-plan generation with trigger/window/expiration enforcement.

## RuntimeScheduleEvidence API

File: src/runtime/scheduling/RuntimeScheduleEvidence.ts
- append(runtimeInstanceId, type, details, scheduleId?, planId?)
- all()

Purpose:
- Append-only evidence ledger for scheduler operations.

## RuntimeScheduleDiagnostics API

File: src/runtime/scheduling/RuntimeScheduleDiagnostics.ts
- log(runtimeInstanceId, level, code, message, details?, scheduleId?, planId?)
- all()

Purpose:
- Monotonic diagnostics stream for scheduler outcomes.

## RuntimeScheduleTelemetry API

File: src/runtime/scheduling/RuntimeScheduleTelemetry.ts
- increment(counter, amount?)
- snapshot(metrics)

Purpose:
- Sorted deterministic counter and metrics snapshots.

## RuntimeScheduleSnapshotStore API

File: src/runtime/scheduling/RuntimeScheduleSnapshotStore.ts
- save(snapshot)
- loadLatest(runtimeInstanceId)
- history(runtimeInstanceId)

Purpose:
- Immutable revisioned scheduler snapshot persistence.

## RuntimeSchedulingManager API

File: src/runtime/scheduling/RuntimeSchedulingManager.ts
- constructor(runtimeInstanceId, runtimeId)
- static fromExecutionContext(context)
- registerSchedule(descriptor)
- generatePlan(scheduleId, context)
- planIfDue(scheduleId, context)
- generateDuePlans(context)
- publishPlan(planId, messaging)
- deriveRetryState(scheduleId, currentSequence)
- snapshot()
- persistSnapshot()
- restoreLatestSnapshot()
- snapshotHistory()
- listSchedules()
- listPlans()
- retryStates()

Purpose:
- Context-local scheduler orchestration with deterministic planning and messaging publication bridge.
