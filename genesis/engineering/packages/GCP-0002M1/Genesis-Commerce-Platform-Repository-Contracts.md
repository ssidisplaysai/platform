# Genesis Commerce Platform Repository Contracts

## Contract Goals
1. Preserve existing repository function signatures for API and module compatibility.
2. Add durable persistence without changing domain behavior.
3. Keep deterministic fixture reset for bounded tests.

## Shared Persistence Contract
1. loadPersistedState(namespace, seedFactory)
- Returns state + revision token.

2. savePersistedState(namespace, state, expectedRevision)
- Commits durable state only when expected revision matches persisted revision.
- Throws conflict on stale write attempt.

3. resetPersistedState(namespace, seedFactory)
- Resets state to deterministic fixture baseline.

## Repository-Level Expectations
1. Read operations
- Return projections from in-memory working state loaded from durable snapshot.

2. Write operations
- Execute domain validation first.
- Apply mutation to in-memory state.
- Persist with expected revision token.
- Return validation and entity payloads consistent with pre-R1B contracts.

3. Test reset operations
- Repository reset functions must restore deterministic fixture baseline and reset revision to 0.

## Inventory Transaction Contract
Inventory write operations are multi-step and must:
1. Capture full state snapshot before mutation.
2. On any error, restore snapshot.
3. Persist only on successful completion of all steps.

## Compatibility
No public API route response contract changes were introduced in R1B.
