# 02 Certification Condition Resolution

C1 DST repeated-hour handling:
- Status: RESOLVED (engineering)
- Implementation: explicit local-run classification for DST ambiguity and deterministic duplicate prevention policy (first local timestamp wins).
- Evidence: scheduling DST tests and OCCURRENCE_SKIPPED audit entries.

C2 Persistence recovery hardening:
- Status: RESOLVED (engineering)
- Implementation: strict JSON/state validation, corrupt/partial classification, invalid-record counters, safe degraded recovery path.
- Evidence: corrupt/partial recovery tests and CORRUPT_STATE_DETECTED or RECOVERY_FAILED visibility.

C3 Transport/audit failure hardening:
- Status: RESOLVED (engineering)
- Implementation: dispatch retry policy with timeout and classification; retry exhaustion audit; audit-store failure metric and audit visibility.
- Evidence: transient retry, timeout exhaustion, permanent failure, and audit failure tests.

C4 Claim semantics hardening:
- Status: RESOLVED (engineering)
- Implementation: atomic claim abstraction with logical run-key conflict checks and deterministic ownership/expiry behavior.
- Evidence: concurrent claim conflict test and runtime readiness guarantee statement retained as single-writer scope.
