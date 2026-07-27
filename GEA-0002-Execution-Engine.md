# GEA-0002 Execution Engine

## Components
1. ToolExecutionService behavior is implemented by ExecutionCoordinator in src/lib/gea/tool-execution-engine.ts.
2. ToolExecutor contract is provided with a default runtime executor.
3. ExecutionValidator validates input contract requirements.
4. FailureHandler standardizes failures and timeout errors.

## Execution Flow
1. Resolve tool and active version from registry.
2. Enforce workspace isolation and authorization checks.
3. Validate input contract requirements.
4. Record immutable lineage and queued timeline entry.
5. Execute synchronously or asynchronously under timeout and retry constraints.
6. Persist completion/failure with duration and full timeline.
7. Compute and persist derived health snapshot.

## Supported Controls
1. Timeout
2. Retry
3. Cancellation
4. Replay recording

## Recorded Execution Material
1. Invocation identity and scope
2. Authorization decision
3. Input/output
4. Warnings and errors
5. Duration
6. Timeline events
7. Immutable lineage hash
