# 01 C1 Root Cause

Blocking finding from GWF-1001C:
- Restart re-execution ambiguity for recovered RUNNING workflow instances.

Root cause:
- Recovery state restoration relied on checkpoint.stepId in resume path.
- Checkpoint step identity did not explicitly model post-commit execution position.
- Recovered RUNNING instances were converted to PAUSED, but execution resumption semantics could not unambiguously prove next unfinished step in all crash/interrupted-write scenarios.
- Recovery consistency checks across checkpoint, instance pointer, and execution history were insufficient to reject partial or ambiguous persistence combinations.

Failure mode:
- A restart could position execution at an already committed step when metadata was incomplete or inconsistent.
- Exactly-once completion was not provable from direct persisted state alone.

Remediation objective:
- Encode deterministic post-commit execution position in checkpoint metadata.
- Validate checkpoint/history consistency during recovery and reject ambiguity.
- Ensure resume executes only checkpoint-identified unfinished work.
