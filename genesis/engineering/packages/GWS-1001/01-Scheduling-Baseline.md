# 01 Scheduling Baseline

## Files Inspected

1. src/platform/workflow/services/TimeoutManager.ts
2. src/platform/workflow/services/WorkflowExecutor.ts
3. src/lib/gea/orchestration-runtime.ts
4. src/lib/gea/orchestration-models.ts
5. src/lib/gea/tool-execution-engine.ts
6. src/lib/glw/jobs.ts
7. src/lib/glw/n8n.ts
8. src/app/api/glw/jobs/callback/retry/route.ts
9. src/lib/gop/events-api.ts
10. src/app/api/gop/messaging/metrics/route.ts
11. src/app/api/gop/workflow/metrics/route.ts

## Existing Responsibilities

1. Workflow owns workflow-step timeout and retry behavior (TimeoutManager, WorkflowExecutor).
2. GEA runtime owns orchestration-level delayed start abstraction and retry counters.
3. GLW job runtime owns job timeout display/status semantics.
4. Tool execution engine owns per-tool timeout and retry loops.
5. Messaging owns transport and queue operational readiness metrics.
6. Mission Control surfaces messaging/workflow observability endpoints.

## Existing Authority Overlaps

1. Timeout and retry logic exists in workflow, tool runtime, and orchestration runtime.
2. Delayed start exists in orchestration runtime (scheduling bridge) without canonical platform scheduling service.
3. Multiple modules evaluate current time independently using Date.now/new Date.

## Existing Timer Semantics

1. Workflow step timeout uses setTimeout promise race and raises workflow_step_timeout.
2. Tool runtime timeout uses setTimeout in Promise.race with configurable timeoutMs.
3. GLW job timeout evaluates elapsed running duration against GLW_JOB_TIMEOUT_MS.

## Existing Retry Scheduling

1. Workflow retries are immediate loop retries constrained by maxAttempts.
2. Tool runtime retries loop up to retryLimit without canonical missed-run policy.
3. Orchestration runtime marks RETRYING states and retry counts at step level.

## Existing Workflow Timeout Relationships

1. Timeout can transition workflow to TIMED_OUT and trigger compensation path.
2. Timeout records are persisted through workflow persistence callbacks.
3. Restart recovery preserves timeout/retry records in workflow persistence snapshot.

## Migration Constraints

1. Scheduling cannot take workflow execution ownership.
2. Scheduling cannot replace messaging transport semantics.
3. Existing timeout/retry code paths must remain behaviorally compatible for this foundation.
4. Mission Control endpoints must remain observability-only.

## Compatibility Risks

1. Introducing scheduling dispatch topics without direct workflow mutation is mandatory.
2. Duplicate triggering risk exists during restart without claim idempotency.
3. Time-zone and DST handling can diverge if multiple ad hoc time evaluators remain.
4. Existing modules using local Date.now paths may continue to drift without injected clock migration.
