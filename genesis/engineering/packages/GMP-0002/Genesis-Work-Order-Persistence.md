# Genesis Work Order Persistence

## Mechanism
Work-order state persists through the shared foundation persistence utility using JSON envelope storage, schema checks, and optimistic concurrency.

## Persistence Contract
- Namespace: work-order-repository
- Stored entities:
  - Work-order records
  - Audit events
  - Published events
  - Organization sequence map
  - Sales-order linkage map

## Integrity Controls
- Expected revision on save to prevent lost updates
- Deep-clone snapshots to isolate mutation side effects
- Rollback to snapshot on failed save
- Reset function for deterministic tests

## Operational Notes
- Atomic write semantics are inherited from foundation persistence
- Windows-safe rename behavior is inherited from foundation persistence
