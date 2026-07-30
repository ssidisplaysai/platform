# Genesis Commerce Platform Transaction Model

## Model
The foundation transaction model is repository-local snapshot transaction control with optimistic commit tokens.

## Transaction Flow
1. Begin
- Capture pre-mutation snapshot of repository state.

2. Mutate
- Apply validated domain transitions.

3. Commit
- Persist state through savePersistedState with expected revision token.

4. Rollback
- On failure at any stage, restore snapshot and return validation failure.

## Optimistic Concurrency
1. Each persisted namespace has a numeric revision token.
2. Commits must present expectedRevision.
3. Mismatch raises FoundationPersistenceConflictError.

## Inventory Transactional Cases
1. Movement creation:
- Validates scope and state.
- Mutates source/destination stock.
- Appends movement.
- Persists atomically.

2. Reservation create/release/fulfill:
- Snapshot before mutation.
- Stock and reservation updates must succeed as a unit.
- Persist only after complete success.

3. Movement reversal:
- Reversal attempt snapshots full state.
- Any failure restores full pre-reversal state.

## Error Normalization
1. Domain validation/state errors remain validation issues in response payload.
2. Persistence conflicts and write failures are surfaced via repository error handling and rollback.
