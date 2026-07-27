# GEA-0001 Agent Runtime

## Runtime Service
The runtime is implemented in src/lib/gea/agent-runtime.ts via createAgentRuntimeService.

## Lifecycle
1. registerAgent: persists agent definition and active versions.
2. createPlan: resolves enabled capabilities, builds context checksum, stores memory references, writes immutable plan.
3. executePlan: creates QUEUED execution, writes queue audit, and begins run loop.
4. runExecution internal loop:
   - validates immutable plan
   - evaluates permission per task
   - authorizes tool usage against capability scope
   - executes tool invocation and records action outputs
   - records audit event per transition
5. pauseExecution, resumeExecution, cancelExecution: operator controls with audit entries.
6. replayExecution: computes deterministic checksum from execution plus action outputs and persists replay evidence.
7. approveTask / rejectTask: approval gate controls with state transitions and audit evidence.

## State Model
Execution states used by runtime:
1. QUEUED
2. RUNNING
3. WAITING_APPROVAL
4. PAUSED
5. COMPLETED
6. FAILED
7. CANCELLED

## Determinism and Safety
1. Plan dependency checksum and immutability checks prevent silent mutation.
2. Permission checks are performed for every task.
3. Tool use is denied when capability mapping is missing or disabled.
4. Replay checksum allows deterministic verification of prior output structure.
