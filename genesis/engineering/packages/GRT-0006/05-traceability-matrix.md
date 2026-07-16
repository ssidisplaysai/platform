# GRT-0006 Traceability Matrix

Requirement to implementation:
- deterministic schedule identity -> src/runtime/scheduling/RuntimeScheduleFactory.ts
- deterministic Runtime Plan identity -> src/runtime/scheduling/RuntimePlanFactory.ts
- immutable schedules -> src/runtime/scheduling/RuntimeSchedule.ts, src/runtime/scheduling/RuntimeScheduleFactory.ts
- immutable plans -> src/runtime/scheduling/RuntimePlan.ts, src/runtime/scheduling/RuntimePlanFactory.ts
- trigger ordering and evaluation -> src/runtime/scheduling/RuntimeTriggerRegistry.ts
- recurrence determinism -> src/runtime/scheduling/RuntimeTriggerRegistry.ts
- execution-slot evaluation -> src/runtime/scheduling/RuntimeTriggerRegistry.ts
- execution-window acceptance -> src/runtime/scheduling/RuntimeExecutionWindow.ts, src/runtime/scheduling/RuntimePlanner.ts
- expiration rejection -> src/runtime/scheduling/RuntimeExecutionWindow.ts, src/runtime/scheduling/RuntimePlanner.ts, src/runtime/scheduling/RuntimeSchedulingManager.ts
- retry derivation -> src/runtime/scheduling/RuntimeRetryPolicy.ts, src/runtime/scheduling/RuntimeSchedulingManager.ts
- planner behavior -> src/runtime/scheduling/RuntimePlanner.ts, src/runtime/scheduling/RuntimeSchedulingManager.ts
- plan publication and messaging integration -> src/runtime/scheduling/RuntimeSchedulingManager.ts
- evidence sequencing -> src/runtime/scheduling/RuntimeScheduleEvidence.ts
- diagnostics sequencing -> src/runtime/scheduling/RuntimeScheduleDiagnostics.ts
- telemetry updates and sorting -> src/runtime/scheduling/RuntimeScheduleTelemetry.ts, src/runtime/scheduling/RuntimeSchedulingManager.ts
- snapshot immutability -> src/runtime/scheduling/RuntimeScheduleSnapshotStore.ts, src/runtime/scheduling/RuntimeSchedulingManager.ts
- snapshot revisions -> src/runtime/scheduling/RuntimeScheduleSnapshotStore.ts
- per-execution-context isolation -> src/runtime/scheduling/RuntimeSchedulingManager.ts
- no direct target execution -> src/runtime/scheduling/RuntimeSchedulingManager.ts

Requirement to focused tests:
- deterministic schedule identity -> tests/runtime/scheduling/runtime-scheduling.test.ts (1-2)
- deterministic Runtime Plan identity -> tests/runtime/scheduling/runtime-scheduling.test.ts (10-11)
- immutable schedules -> tests/runtime/scheduling/runtime-scheduling.test.ts (8-9)
- immutable plans -> tests/runtime/scheduling/runtime-scheduling.test.ts (12-13)
- trigger ordering and recurrence determinism -> tests/runtime/scheduling/runtime-scheduling.test.ts (14-23, 31, 35)
- execution-slot evaluation -> tests/runtime/scheduling/runtime-scheduling.test.ts (14-23, 32-34)
- execution-window acceptance and expiration rejection -> tests/runtime/scheduling/runtime-scheduling.test.ts (24-28, 37-38, 58)
- retry derivation -> tests/runtime/scheduling/runtime-scheduling.test.ts (50-57)
- planner behavior -> tests/runtime/scheduling/runtime-scheduling.test.ts (32-42, 75-77)
- plan publication and messaging integration -> tests/runtime/scheduling/runtime-scheduling.test.ts (43-47, 77-78)
- evidence sequencing -> tests/runtime/scheduling/runtime-scheduling.test.ts (56, 58, 61)
- diagnostics sequencing -> tests/runtime/scheduling/runtime-scheduling.test.ts (45, 57, 62)
- telemetry updates -> tests/runtime/scheduling/runtime-scheduling.test.ts (46, 58-60)
- snapshot immutability and revisions -> tests/runtime/scheduling/runtime-scheduling.test.ts (63, 65-70)
- repeated-run determinism -> tests/runtime/scheduling/runtime-scheduling.test.ts (75-76)
- multi-runtime isolation -> tests/runtime/scheduling/runtime-scheduling.test.ts (73-74)
- no direct target execution -> tests/runtime/scheduling/runtime-scheduling.test.ts (48-49)
- frozen-milestone non-regression -> tests/runtime/scheduling/runtime-scheduling.test.ts (79-84)

Requirement to validation/governance/package:
- validation outputs -> 04-validation-report.md, validation.json
- GAR findings -> genesis/architecture/reviews/GAR-0025-GRT-0006-Runtime-Scheduler.md
- governance decision -> genesis/governance-decisions/GD-0017-Approve-GRT-0006.md
- package closure evidence -> CLOSURE-EVIDENCE.md, RELEASE-READINESS.md
