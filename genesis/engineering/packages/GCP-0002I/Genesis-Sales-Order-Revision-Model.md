# Genesis Sales Order Revision Model

## Revision Principles
- Controlled revisions only
- Durable revision history
- Deterministic revision numbering

## Revision Record Structure
Each revision stores:
- `revisionNumber`
- `parentRevision`
- `author`
- `timestamp`
- `reason`
- `changedFields`
- `previousStatus`
- `nextStatus`
- `previousTotals`
- `nextTotals`

## Revision Creation Rules
- `reason` is mandatory
- `expectedVersion` supports optimistic concurrency
- Validation failures prevent mutation

## Published Event
Each successful revision publishes `OrderRevised` for downstream consumers.
