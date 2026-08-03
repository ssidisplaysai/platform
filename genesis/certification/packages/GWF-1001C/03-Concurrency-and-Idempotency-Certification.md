# 03 Concurrency And Idempotency Certification

Condition under review: C2

## Direct Implementation Evidence

In WorkflowEngine.runCommand():

- Same-instance mutation lock via activeMutations set
- Duplicate command check through persistence.commandStore.get(commandKey)
- Duplicate command metric tracking and safe return of authoritative instance
- Expected-version check and stale rejection
- Persisted update with expectedVersion through instanceStore.update()
- Conflict handling with explicit workflow_concurrency_conflict and workflow_stale_instance_version

Command dedupe state is persisted through commandStore.append() in FileWorkflowCommandStore.

Resume flow uses non-nested mutation path:

- resume mutation inside runCommand
- execute invoked after runCommand completes

This avoids nested lock deadlock on same instance.

## Test Evidence

tests/workflow/workflow-platform-foundation.test.ts verifies:

- duplicate command idempotency
- concurrent same-instance rejection
- stale version rejection
- cancellation during active execution conflict rejection
- resume invalid-state rejection

## Guarantee Classification

- Process-local guarantee: same-instance lock is process memory (activeMutations)
- Persistence-backed guarantee: command dedupe records and versioned instance updates are persisted
- Multi-node guarantee: not claimed. Workflow readiness explicitly reports multiNodeReadiness = PERSISTENCE_COORDINATED_SINGLE_WRITER.

## Duplicate-Event Handling Hooks

- Explicit inbound duplicate-event consumer logic is not implemented in workflow core.
- Command-level idempotency is implemented for workflow command APIs.

## Classification

C2 status: CLOSED.

Reason: required same-instance conflict control, idempotent command handling, stale-write safety, and authoritative mutation path controls are implemented and covered by direct tests for the supported operating model.
