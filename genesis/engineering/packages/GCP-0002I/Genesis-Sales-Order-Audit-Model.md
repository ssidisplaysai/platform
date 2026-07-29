# Genesis Sales Order Audit Model

## Audit Guarantees
- Every mutation is recorded
- Every transition is traceable
- Every approval action is attributable

## Audit Event Types
- `order_created`
- `order_viewed`
- `order_updated`
- `order_submitted`
- `order_approved`
- `order_released`
- `order_cancelled`
- `order_closed`
- `order_revision_created`

## Timeline Model
Timeline merges:
- Audit events
- Revision history
- Published order events

This provides a single trace stream for operational and governance consumers.

## Persistence Model
Audit state is persisted in the same durable repository namespace with transactional rollback semantics.
