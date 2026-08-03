# 04 Execution History Model

Execution history properties:

- Append-only write path via ExecutionHistory.append and persistence executionHistoryStore.append.
- No mutation-in-place behavior in execution history service or file store.
- Recovery restores previously persisted execution records through ExecutionHistory.restore.

Exactly-once support role:

- Recovery ambiguity checks compare successful execution record step order with checkpoint completed-step snapshots.
- If checkpoint completed-step evidence exceeds or conflicts with execution-history successful sequence, recovery is rejected as ambiguous.

System event evidence channels:

- Step execution and completion are represented in execution history records.
- Recovery, resume, cancellation, compensation, timeout, retry, and publish-failure visibility are represented in workflow audit records and related persistence/metrics channels.
