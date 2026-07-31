# 05 Concurrency and Idempotency

Concurrency controls:
- Same-instance command lock prevents overlapping mutations on a single workflow instance.
- Concurrent command attempts are rejected with workflow_concurrency_conflict.

Idempotency controls:
- Command records persist command keys tied to instance command operations.
- Duplicate command submission returns existing state and increments duplicate-command metrics.

Optimistic concurrency:
- Instance persistence update requires expected version.
- Stale version attempts are rejected with workflow_stale_instance_version.

Race handling note:
- Resume path executes in two stages: resume-state mutation under command lock, then execution call outside lock, preventing nested lock conflict.

Observed behavior under tests:
- Duplicate commands are safely deduplicated.
- Concurrent same-instance execution is rejected deterministically.
- Stale-version write attempts are explicitly failed.