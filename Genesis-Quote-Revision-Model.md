# Genesis Quote Revision Model

## Revision Record
Each revision stores:
- revisionNumber and parentRevision.
- author, timestamp, reason.
- changedFields.
- pricingDelta and lineDelta.
- approval status and commercial status snapshot.
- totals and line snapshots.

## Behavior
- Initial revision is created with quote creation.
- Explicit revision endpoint appends a new revision and increments aggregate revision.
- Revisions are immutable historical records.

## Concurrency
- Aggregate version is incremented for each mutation.
- API consumers can provide expectedVersion for optimistic concurrency.
