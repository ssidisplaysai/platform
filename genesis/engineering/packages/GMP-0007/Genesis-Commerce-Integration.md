# Genesis Commerce Integration

## Commerce Boundary
Commerce remains the system of record for commercial commitments.

## Consumed From Commerce
- Sales Orders
- Order Revisions
- Order Cancellation

## Published To Commerce
- Manufacturing Accepted
- Manufacturing Started
- Manufacturing Completed
- Manufacturing Blocked
- Manufacturing Cancelled

## Rules
- Manufacturing may consume commerce commitments as authoritative inputs.
- Manufacturing must not duplicate commerce ownership.
- Integration must remain contract-based and versioned.
- Publishing manufacturing outcomes must not trigger execution semantics outside the manufacturing authority boundary.
