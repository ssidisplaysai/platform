# 02 Restart Recovery Verification

Verification focus:
- Recovered RUNNING instances must resume only unfinished work and never replay committed work.

Implementation observations:
- WorkflowEngine.recover restores latest checkpoint state into in-memory instance projection.
- recoveryAmbiguityReason enforces fail-closed validation before recovery can proceed.
- WorkflowEngine.resume validates ambiguity again and reconstructs authoritative resume state from checkpoint.

Recovery state restoration verified:
- Checkpoint: restored
- Execution history: restored
- Context: restored
- Variables: restored
- Retry state: restored via retry store recovery snapshot
- Timeout state: restored via timeout store recovery snapshot
- Compensation state: restored via compensation store recovery snapshot

Behavioral outcome:
- Uncertain or inconsistent recovery state fails closed as FAILED with explicit reason.
- Non-ambiguous recovery state is deterministic and points to unfinished step.
