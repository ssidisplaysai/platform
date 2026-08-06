# 07 Persistence Strategy

Selected implementation-ready persistence approach:

- Multiple bounded state files coordinated by PersistenceCoordinator, plus append-only ledger files and recomputable snapshots.

Rationale:

1. Preserves explicit aggregate boundaries.
2. Limits corruption blast radius.
3. Enables deterministic replay and recovery.
4. Scales growth concerns better than monolithic single-state file.

State partitions by tenant:

1. inventory-items.state.json
2. balances.state.json
3. warehouses.state.json
4. locations-bins.state.json
5. reservations.state.json
6. allocations.state.json
7. lots.state.json
8. serials.state.json
9. policies.state.json
10. idempotency.state.json
11. references.state.json
12. runtime-metadata.state.json
13. projections-snapshots.state.json
14. movement-ledger.log.jsonl

Core persisted fields:

1. schemaVersion
2. tenantId partition key
3. aggregateId
4. aggregateVersion
5. concurrencyToken
6. updatedAt
7. idempotency records and payload hash
8. rejection counters
9. audit linkage identifiers
10. recovery markers and replay checkpoints

Ledger persistence:

1. Append-only JSONL records.
2. Every movement produces one or more immutable ledger entries.
3. Ledger entries include event type, quantity deltas, source/destination scope, causation, correlation.

Snapshot strategy:

1. Canonical truth remains aggregate state plus ledger.
2. Projections and analytic summaries are derived and recomputable.
3. Snapshot checkpoints include ledger offset and projection version.

Deterministic persistence behavior:

1. Deterministic key ordering on serialization boundaries.
2. Deterministic replay order by ledger sequence and tie-break by stable deterministic comparator.

Migration philosophy:

1. Semver schema version in runtime metadata.
2. Minor-compatible upgrades may apply deterministic transformation.
3. Major-incompatible versions require explicit migration tool phase before runtime start.

Unsupported version behavior:

- Fail closed at startup before command acceptance.

Recovery metadata:

1. lastSuccessfulCheckpoint
2. lastReplayLedgerOffset
3. pendingRecoveryActions
4. corruptionFlags
5. recoveryAttemptCount

No implementation note:

- This defines runtime persistence shape and rules only. No persistence code is produced here.