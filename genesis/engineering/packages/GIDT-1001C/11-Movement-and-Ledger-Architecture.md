# 11 Movement And Ledger Architecture

Movement execution sequence:

1. Validate command contract and authority.
2. Validate required references.
3. Verify expected versions for affected aggregates.
4. Verify idempotency key and payload match.
5. Load affected balances, locations, lot/serial state.
6. Evaluate invariants.
7. Create movement record.
8. Create append-only ledger entry or entries.
9. Apply balance and state updates atomically.
10. Persist deterministic canonical state and idempotency record.
11. Record audit evidence.
12. Update metrics.
13. Publish observation.

Atomicity model:

1. Movement, ledger append, balance updates, and idempotency record commit as one coordinated persistence unit.
2. Any persistence failure aborts mutation and prevents partial application.

Compensating behavior:

1. Reversal and correction operations create new compensating movement facts.
2. Prior ledger records remain immutable.
3. Reversal links to original movement by causation reference.

Deterministic correction handling:

1. Correction ordering uses stable deterministic ordering by movement timestamp, sequence, and deterministic tie-break rules.
2. Recovery replay re-applies identical correction outcomes.

Prohibited behavior:

1. Destructive ledger mutation.
2. Direct balance overwrite without movement fact.
3. Silent compensation without explicit audit evidence.

Failure classes in sequence:

1. InvalidCommand
2. InvalidReference
3. ExpectedVersionMismatch
4. DuplicateIdempotencyKey
5. InsufficientAvailability
6. InvalidLocation
7. InvalidLot
8. InvalidSerial
9. PersistenceFailure
10. ObservationPublicationFailure

Failure consequences:

1. Steps 1 through 6 failures reject before mutation.
2. Step 9 through 10 failures reject and roll back coordinated write.
3. Step 13 failure does not alter committed canonical state; it degrades observation health and emits retry signals.