# 09 Domain Events

Conceptual domain events (no runtime implementation in this work order):

- ManufacturingWorkOrderCreated
- ManufacturingWorkOrderReleased
- ManufacturingWorkOrderStarted
- ManufacturingWorkOrderPaused
- ManufacturingWorkOrderCompleted
- OperationStarted
- OperationCompleted
- MaterialRequirementCreated
- MaterialIssueRequested
- MaterialConsumed
- MaterialReturned
- ProductionOutputRecorded
- ScrapRecorded
- ReworkRequested
- ReworkCompleted
- MachineAssigned
- LaborAssigned
- DowntimeStarted
- DowntimeEnded
- ProductionBatchStarted
- ProductionBatchCompleted
- WipStateChanged
- QualityHoldApplied
- QualityHoldReleased

Event rules:
- events describe facts; they do not transfer canonical ownership
- events carry tenant, correlation, causation, and idempotency context
- event identity is immutable and append-only in conceptual model
- replay of same idempotent command yields deterministic event behavior
