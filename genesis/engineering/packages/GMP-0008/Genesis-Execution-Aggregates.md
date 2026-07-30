# Genesis Execution Aggregates

## Authoritative Aggregates
- Execution Session
- Execution Activity
- Execution Checkpoint
- Execution Timeline
- Execution Snapshot
- Execution Recovery Record

## Aggregate Rules
- Each aggregate has immutable identity.
- Each aggregate preserves upstream planning lineage.
- Each aggregate is versioned and auditable.
- Each aggregate supports deterministic transitions.

## Ownership Statement
Aggregates represent execution state only. They do not re-own planning authority.
