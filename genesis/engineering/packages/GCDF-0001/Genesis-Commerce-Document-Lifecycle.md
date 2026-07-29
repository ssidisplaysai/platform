# Genesis Commerce Document Lifecycle

## Lifecycle Philosophy
Lifecycle, status, approval, publication, and execution are separate state dimensions and must never be conflated.

## Lifecycle States
1. Draft
2. PendingReview
3. Approved
4. Rejected
5. Active
6. Closed
7. Archived
8. Cancelled

## Core State Transition Contract
Allowed baseline transitions:
1. Draft -> PendingReview | Cancelled
2. PendingReview -> Approved | Rejected | Cancelled
3. Rejected -> Draft | Cancelled
4. Approved -> Active | Cancelled
5. Active -> Closed | Cancelled
6. Closed -> Archived
7. Cancelled -> Archived

## State Transition Governance
1. Transition attempts must emit audit transition events.
2. Transition authorization is externalized through provider hooks.
3. Derived document types may narrow transitions but may not bypass baseline governance.

## Approval Dimension
Approval status is independent from lifecycle and supports:
1. NotRequired
2. Requested
3. Approved
4. Rejected
5. Superseded

## Publication Dimension
Publication status supports rendering/export readiness states:
1. NotPublished
2. PendingPublication
3. Published
4. Superseded

## Execution Dimension
Execution status supports downstream operations without owning operations:
1. NotStarted
2. InProgress
3. Completed
4. Blocked
5. Cancelled

## Derived Document Extension Rule
Derived types may add additional sub-status values and guards while preserving base separation of dimensions.

## Non-Ownership Rule
Lifecycle model does not implement:
1. inventory reservation
2. shipment execution
3. invoice posting
4. workflow orchestration
