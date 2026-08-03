# 05 Observability Certification

Condition under review: C4

## Direct Implementation Evidence

Workflow metrics authority is implemented in src/platform/workflow/services/WorkflowMetricsService.ts with:

- registeredWorkflowDefinitions
- activeWorkflowInstances
- pausedInstances
- completedInstances
- failedInstances
- cancelledInstances
- timedOutInstances
- compensatingInstances
- retryCount
- checkpointCount
- recoveryCount
- concurrencyConflictCount
- duplicateCommandCount
- lifecyclePublishFailureCount
- averageExecutionDurationMs
- averageStepDurationMs
- oldestActiveWorkflowAgeMs
- oldestPendingRetryAgeMs

Gauge semantics are explicit through refreshStateGauges(instances, retries), which recalculates active-state values from current persisted instance state.

Lifecycle publish failure visibility:

- metrics trackLifecyclePublishFailure() in WorkflowEngine.publishLifecycleEvent()
- audit record emitted on publish failure via writeAudit(... "Workflow lifecycle event publish failed" ...)

Health degradation includes operational warning channels in WorkflowHealthService:

- concurrency conflicts
- lifecycle publish failures
- audit persistence failures
- context persistence failures

## Mission Control Consumption Evidence

- src/app/api/gop/workflow/health/route.ts consumes workflow health/readiness
- src/app/api/gop/workflow/metrics/route.ts consumes workflow metrics/health/readiness
- src/lib/gop/events-api.ts aggregates workflow metrics alongside authentication, authorization, and messaging without transferring workflow ownership
- tests/gop/mission-control-workflow.test.ts validates payload compatibility

## Classification

C4 status: CLOSED.

Reason: active-state gauge semantics and lifecycle publish-failure visibility are implemented in metrics and audit channels and are consumed by Mission Control as integration telemetry.
