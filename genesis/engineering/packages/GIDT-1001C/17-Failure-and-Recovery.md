# 17 Failure And Recovery

Failure classes:

1. InvalidCommand
2. InvalidQuantity
3. InvalidReference
4. ConcurrencyConflict
5. DuplicateIdempotencyKey
6. DuplicateMovement
7. InsufficientAvailability
8. ReservationConflict
9. AllocationConflict
10. InvalidLocation
11. InvalidLot
12. InvalidSerial
13. ExpiredStock
14. CorruptPersistedState
15. UnsupportedSchemaVersion
16. PersistenceFailure
17. RecoveryFailure
18. ObservationPublicationFailure

Failure disposition matrix:

1. Reject before mutation
- InvalidCommand, InvalidQuantity, InvalidReference, ConcurrencyConflict, DuplicateIdempotencyKey, DuplicateMovement, InsufficientAvailability, ReservationConflict, AllocationConflict, InvalidLocation, InvalidLot, InvalidSerial, ExpiredStock.

2. Require rollback or abort coordinated write
- PersistenceFailure during mutation transaction.

3. Require compensating movement
- Post-commit business correction scenarios only, never destructive rollback of immutable ledger facts.

4. Block startup
- CorruptPersistedState (unrecoverable), UnsupportedSchemaVersion, RecoveryFailure, critical invariant failure.

5. Degrade health and continue operation where safe
- ObservationPublicationFailure, non-critical projection failure, optional reference validator downtime under approved policy.

6. Increment metrics
- All failures increment typed counters.

7. Emit audit evidence
- All command-path failures and all startup gate failures.

Recovery architecture:

1. Validate schema and load canonical partitions.
2. Validate aggregate indexes, lot/serial uniqueness, and containment relationships.
3. Replay ledger from last successful checkpoint.
4. Rebuild projections deterministically.
5. Re-run critical invariants.
6. Publish recovery summary observation.

Recovery fail-closed rules:

1. Unsupported schema blocks startup.
2. Canonical corruption without deterministic repair path blocks startup.
3. Cross-partition version divergence without resolution plan blocks startup.

No partial mutation guarantee:

- Coordinated persistence ensures command failure does not leave partially applied movement, ledger, or balance state.