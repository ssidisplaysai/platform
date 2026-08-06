# 11 Versioning And Concurrency

Versioning policy:

1. Every mutable aggregate has a monotonic AggregateVersion.
2. AggregateVersion increments exactly once per accepted state transition.
3. Version conflict results in fail-closed rejection.

Optimistic concurrency:

1. Mutation requests carry expected AggregateVersion.
2. If expected version mismatches current, mutation is rejected.
3. Rejected mutation emits conflict telemetry/event where appropriate.

Idempotency strategy:

1. Every externally initiated mutation includes IdempotencyKey.
2. Idempotency scope is tenant + aggregate + command type + key.
3. Replays return prior accepted outcome without reapplying effects.
4. Idempotency records preserve deterministic deduplication behavior.

Ordering semantics:

1. Within an aggregate stream, events are strictly version-ordered.
2. Across aggregates, total ordering is not assumed.
3. Consumers rely on aggregate-local ordering plus causal metadata.

Conflict classes:

1. VersionConflict
2. DuplicateIdempotencyKeyWithDifferentPayload
3. StaleReservationState
4. OverAllocationAttempt
5. ExpiredStockMutationAttempt

No-runtime note:

- This document defines semantic requirements only; implementation mechanics are deferred to subsequent engineering work.