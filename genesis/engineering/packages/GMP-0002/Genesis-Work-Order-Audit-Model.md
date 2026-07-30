# Genesis Work Order Audit Model

## Audit Event Shape
- eventId
- workOrderId
- organizationId
- actor
- action
- previousState
- resultingState
- correlationId
- causationId
- metadata
- createdAt

## Audit Actions
- work_order_created
- work_order_viewed
- work_order_updated
- work_order_planned
- work_order_released
- work_order_paused
- work_order_resumed
- work_order_completed
- work_order_cancelled
- work_order_closed
- work_order_revision_created

## Guarantees
- Append-only event stream
- Chronological query support
- Correlation continuity with upstream commerce lineage
