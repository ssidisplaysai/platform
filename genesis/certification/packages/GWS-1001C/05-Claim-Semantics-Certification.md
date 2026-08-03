# 05 Claim Semantics Certification

Implementation evidence reviewed:
1. src/platform/scheduling/services/OccurrenceClaimService.ts
2. src/platform/scheduling/persistence/ScheduleClaimStore.ts
3. src/platform/scheduling/persistence/ScheduleOccurrenceStore.ts
4. src/platform/scheduling/persistence/PersistenceCoordinator.ts
5. src/platform/scheduling/persistence/FileStores.ts

Verification findings:
1. Claim ownership is explicit through owner field and actor ownership flow.
2. Claim creation has an atomic abstraction (claimAtomic) with file-backed write lock semantics.
3. Duplicate claims are rejected by occurrenceId/logicalRunKey conflict evaluation.
4. Claim conflicts are visible through claim conflict outcomes and metrics.
5. Claim expiration is supported through expiresAt and recovery logic.
6. Stale claims are recoverable via recoverExpiredClaims and EXPIRED transitions.
7. Idempotency keys are stable and include deterministic logical keys.
8. Duplicate dispatch prevention is enforced within documented guarantees using claims plus logical-run duplicate checks.
9. Guarantee scope is accurately represented as single-writer claim-store abstraction.
10. Multi-node guarantees are not overstated as distributed atomic consensus.

Capability scope assessment:
1. Process-local: yes.
2. File-backed single-writer: yes.
3. Multi-process capable: limited, file lock queue in-process only, not cross-process guaranteed.
4. Multi-node capable: no direct evidence for strong multi-node atomicity.

Direct test evidence reviewed:
1. supports atomic claim semantics with deterministic ownership and conflict rejection
2. prevents duplicate occurrence dispatch using claim idempotency

Condition status:
- C4: CLOSED.
