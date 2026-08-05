# 10 Failure and Recovery

Failure classes:

1. Configuration failure
- Missing/invalid runtime config.

2. Persistence failure
- Store unavailable, write failure, or state corruption.

3. Invariant failure
- Domain invariant breach during mutation.

4. Integration failure
- External reference validation or dependency unavailability.

5. Contract failure
- Invalid command/query payload or contract-version mismatch.

Fail-closed policy:

1. Invalid command/query requests are rejected deterministically.
2. Corrupt persisted state blocks startup until corrected.
3. Mandatory reference validation failures reject mutation.
4. Unknown provider conflicts reject registration.

Recovery strategy:

1. Persistence retry policy for transient failures.
2. Explicit recovery markers in audit records.
3. Deterministic replay from persisted canonical state.
4. Administrative repair path for corrupted state before restart.

Error taxonomy (conceptual):

1. PRODUCT_INVALID
2. PRODUCT_NOT_FOUND
3. VERSION_CONFLICT
4. LIFECYCLE_TRANSITION_INVALID
5. REFERENCE_INVALID
6. STATE_CORRUPT
7. PERSISTENCE_FAILURE
8. RECOVERY_FAILURE

Recovery guarantees:

1. No silent ownership drift.
2. No partial startup success.
3. No hidden mutation on failed commands.
