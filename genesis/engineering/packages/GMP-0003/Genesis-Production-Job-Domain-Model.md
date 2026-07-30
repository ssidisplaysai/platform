# Genesis Production Job Domain Model

## Aggregate Root
`ProductionJob` is the authoritative execution unit with these major concerns:
- Identity and numbering.
- Organization/site ownership.
- Lifecycle state.
- Revision and version governance.
- Immutable manufacturing lineage.
- Audit/event traceability.

## Key Value Objects
- `ProductionJobLineage`: upstream work-order, sales-order, and quote identifiers and revisions.
- `ProductionJobRevisionRecord`: immutable revision entries with author, reason, and changed fields.
- `ProductionJobAuditEvent`: repository-level action history.
- `ProductionJobPublishedEvent`: enterprise publication envelope.
- `ProductionJobTimelineEntry`: chronological operational trace.

## Status Model
`draft -> queued -> ready -> released -> running -> paused -> completed -> closed`
Alternative terminal path: `cancelled`.

## Deterministic Rules
- Transition must be from allowed predecessor statuses.
- Duplicate Production Job from same Work Order is rejected.
- Revision increments are monotonic and auditable.
- Lineage fields are established at creation and treated as immutable source references.
