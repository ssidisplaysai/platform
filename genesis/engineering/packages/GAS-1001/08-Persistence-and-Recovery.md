# 08 Persistence and Recovery

Persistence model:

- File-backed durable state at data/assets/asset-state.v1.json
- Atomic lock-guarded read/write operations

State segments:

- asset registry
- metadata
- versions
- checksums
- relationships
- collections
- retention
- audit
- metrics

Recovery model:

- Schema guard: 1.0.0
- Fail-closed validation on corrupt state
- Recovery count tracked in metrics
