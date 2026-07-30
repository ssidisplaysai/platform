# Genesis Production Job Revision Model

## Revision Intent
Track business-authorized modifications to a Production Job while preserving auditability and version progression.

## Revision Entry Fields
- Revision number
- Timestamp
- Author
- Reason
- Changed fields

## Operations
- `createProductionJobRevision` appends immutable revision records.
- Draft updates require version expectation for optimistic concurrency.

## Governance
- Revision numbers are positive and monotonic.
- Revision events generate audit and timeline evidence.
- Revision model does not rewire upstream lineage references.
