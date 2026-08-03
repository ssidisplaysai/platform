# 02 Durability And Recovery Certification

Condition under review: C1

## Direct Implementation Evidence

Durable persistence stores are implemented in src/platform/workflow/persistence/FileStores.ts and coordinated by src/platform/workflow/persistence/PersistenceCoordinator.ts.

Persisted domains verified in code:

- Workflow definitions
- Workflow instances
- Workflow state
- Workflow context
- Workflow variables
- Checkpoints
- Execution history
- Retry state
- Timeout state
- Compensation state
- Audit records
- Metrics
- Command/idempotency records

Recovery snapshot loading is implemented in WorkflowEngine.recover() using persistence.loadRecoverySnapshot() and restores:

- definitions via WorkflowRegistry.restore()
- checkpoints via CheckpointService.restore()
- execution history via ExecutionHistory.restore()
- audits via WorkflowAuditWriter.restore()
- instances and metrics hydration

## Restart Recovery Behaviors Verified

From implementation and tests:

- Paused workflows: recovered and retained
- Active workflows: recovered as PAUSED with explicit failureReason workflow_recovered_from_running_state
- Pending retries and timeouts: loaded from retry/timeout stores
- Checkpoint restoration and execution-history continuity: supported by restore/listAll flows
- Partial recovery failure visibility: invalid checkpoint records increment contextPersistenceFailureCount

## Determinism And Re-Execution Assessment

Observed behavior:

- WorkflowEngine.resume() sets currentStepId to latest checkpoint step before executing.
- Checkpoints are written for step completion and pause/wait paths.
- For instances recovered from RUNNING to PAUSED, the latest checkpoint can represent a previously completed step.

Independent finding:

- Direct evidence does not conclusively prove that previously completed steps cannot be re-executed after restart and resume in all recovered-running scenarios.
- No dedicated regression test in tests/workflow/workflow-platform-foundation.test.ts asserts non-reexecution of last completed step after RUNNING-state crash recovery.

## Classification

C1 status: OPEN.

Reason: durability and recovery persistence are materially implemented, but final non-reexecution guarantee after restart is not fully demonstrated by direct implementation behavior plus test evidence.
