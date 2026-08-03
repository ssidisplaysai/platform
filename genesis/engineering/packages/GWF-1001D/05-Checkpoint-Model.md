# 05 Checkpoint Model

Checkpoint fields now include:

- instanceId
- workflowVersion
- workflowInstanceVersion
- stepId
- executionPositionStepId
- completedStepIds
- state
- context
- transitionVersion
- executionSequence
- recoveryVersion
- createdAt

Integrity invariants:

- executionPositionStepId must not be in completedStepIds.
- executionSequence must be positive.
- Latest checkpoint is selected by max executionSequence during recovery.
- instance.lastCheckpointId, when present, must match selected checkpoint id.

Recovery implications:

- executionPositionStepId is authoritative resume position for unfinished work.
- completedStepIds proves committed work and blocks replay.
- context snapshot restores deterministic variable state at checkpoint boundary.
