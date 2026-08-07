# 17 WIP and Execution State Model

## WorkInProgressState

WIP represents Manufacturing execution state, not Warehouse stock authority.

Required model fields:
- wipId
- workOrderReference
- currentOperationReference
- quantityInProcess
- quantityWaiting
- quantityCompleted
- quantityRejected
- currentWorkCenterReference
- currentStatus
- holdState
- traceabilityReference
- version

Rules:
- WIP quantities are non-negative and coherent
- WIP status transitions must align with work-order and operation transitions
- WIP does not imply Inventory stock mutation unless explicit inventory receipt contract is completed

## ProductionStatus

ProductionStatus captures current semantic state for monitored execution entities with explicit state codes, reason codes, and versioned transition history.
