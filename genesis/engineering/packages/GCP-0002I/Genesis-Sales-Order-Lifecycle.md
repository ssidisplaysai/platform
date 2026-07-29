# Genesis Sales Order Lifecycle

## Statuses
- Draft
- Pending Approval
- Approved
- Released
- In Fulfillment
- Completed
- Cancelled
- Closed

## Deterministic Transition Rules (Implemented)
- `submit`: Draft -> Pending Approval
- `approve`: Draft or Pending Approval -> Approved
- `release`: Approved -> Released
- `cancel`: Draft/Pending Approval/Approved/Released/In Fulfillment -> Cancelled
- `close`: Completed or Cancelled -> Closed

## Enforcement Behavior
Invalid transitions return validation failure and do not mutate persisted state.

## Transition Audit
Every transition emits:
- Audit event
- Optional published order event (approve/release/cancel/close)

## Future Expansion
`In Fulfillment` and `Completed` transitions are reserved for downstream packages and are not implemented in this package.
