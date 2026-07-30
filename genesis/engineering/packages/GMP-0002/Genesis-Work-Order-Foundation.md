# Genesis Work Order Foundation

## Objective
Deliver a durable work-order foundation that transforms approved commerce commitments into governed manufacturing commitments.

## Core Characteristics
- Immutable source lineage to sales order and quote revisions
- Deterministic lifecycle transitions with guarded state changes
- Optimistic-concurrency persistence with rollback-safe mutation pattern
- Append-only audit and published-event streams
- Revision-first governance for controlled change history

## Aggregate Coverage
- Work order identity and numbering
- Status model: draft, planned, released, in_production, paused, completed, cancelled, closed
- Line snapshot model sourced from sales order
- Correlation and causation continuity for enterprise tracing

## Out-of-Scope
- Production job execution
- Operation routing and sequencing
- Scheduling optimization
- Inventory execution controls
- Quality execution records
- MES and IoT integration
