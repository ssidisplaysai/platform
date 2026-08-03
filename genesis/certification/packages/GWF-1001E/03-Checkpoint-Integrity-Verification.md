# 03 Checkpoint Integrity Verification

Checkpoint metadata verification against required model:

Verified in contracts and CheckpointService:
- instanceId
- workflowVersion
- workflowInstanceVersion
- executionSequence
- executionPositionStepId
- completedStepIds
- transitionVersion
- recoveryVersion
- state

Integrity controls verified:
- Checkpoint callback rejects replay-position conflict where executionPositionStepId is already in completedStepIds.
- Checkpoint callback rejects invalid sequence/version bounds.
- Recovery chooses latest checkpoint by max executionSequence.
- Recovery rejects pointer mismatch between instance.lastCheckpointId and selected checkpoint.

Result:
- Checkpoint model now provides unique recovery coordinates and prevents replay ambiguity.
