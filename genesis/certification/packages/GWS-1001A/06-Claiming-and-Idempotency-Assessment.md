# 06 Claiming and Idempotency Assessment

Evidence reviewed:
1. src/platform/scheduling/services/OccurrenceClaimService.ts
2. src/platform/scheduling/services/SchedulingEngine.ts
3. src/platform/scheduling/persistence/ScheduleOccurrenceStore.ts
4. src/platform/scheduling/persistence/ScheduleClaimStore.ts
5. tests/scheduling/scheduling-foundation.test.ts

Verified:
1. Occurrence identity is deterministic (instanceId:dueAt).
2. Claims store idempotency key and owner identity.
3. Duplicate claim with same key returns ALREADY_CLAIMED.
4. Competing claim with different key returns CONFLICT.
5. Expired claims are recoverable and do not permanently block schedules.
6. Engine increments duplicate/conflict metrics and avoids duplicate dispatch on already claimed occurrence.
7. Multi-node guarantee is not overstated; readiness label documents single-writer claim abstraction.

Conditions identified:
1. Claim operation is logical check-then-upsert and not atomic across concurrent processes in current file-store implementation.
2. No dedicated stress test demonstrates multi-process conflict behavior.

Finding:
- PASS with conditions.
