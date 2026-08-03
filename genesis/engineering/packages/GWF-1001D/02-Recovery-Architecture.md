# 02 Recovery Architecture

Recovery strategy implemented:

1. Rich checkpoint metadata
- Workflow version
- Workflow instance version
- Step that produced checkpoint
- Execution position step id (next unfinished step)
- Completed step set snapshot
- Current state
- Transition version
- Execution sequence
- Recovery version

2. Deterministic recovery mapping
- Recovery loads latest checkpoint by highest executionSequence for each instance.
- Recovered instance context, completed step set, current step position, and transition/execution versions are sourced from checkpoint.

3. Ambiguity rejection
- Missing checkpoint for RUNNING/PAUSED instances is marked ambiguous.
- Checkpoint pointer mismatch (instance.lastCheckpointId vs latest checkpoint) is ambiguous.
- Replay-position conflict (execution position included in completed step set) is ambiguous.
- Execution history and checkpoint completed-step sequence mismatch is ambiguous.

4. Safe running-state restart behavior
- RUNNING instances recover to PAUSED with explicit failureReason workflow_recovered_from_running_state.
- Recovery version increments in memory after running-state restart mapping.

5. Resume behavior
- Resume requires non-ambiguous checkpoint with executionPositionStepId.
- Resume reconstructs context and committed-step set from checkpoint, then executes from unfinished position.
