# 03 Aggregates

## Aggregate Definitions and Consistency Boundaries

| Aggregate | Root | Contained Entities | Transactional Boundary | Consistency and Invariant Boundary | Allowed Cross-Aggregate References | Prohibited Direct Mutation Paths | Independent Existence Rule |
|---|---|---|---|---|---|---|---|
| ManufacturingWorkOrder aggregate | ManufacturingWorkOrder | WorkInProgressState, ProductionStatus, ManufacturingMetadata, ManufacturingInstructionReference, QualityHoldReference | commands that mutate work-order execution state | quantity coherence, lifecycle legality, tenant integrity | references to ProductionRun, ExecutionRouting, MaterialRequirement, Output, assignments, trace | no direct mutation of Inventory quantities; no direct Product definition edits | root must exist first |
| ProductionRun aggregate | ProductionRun | ProductionBatch, ProductionStatus, run-level metadata | run creation/start/pause/complete actions | run lifecycle and run quantity consistency | references back to work order, operation execution, output | no direct work-order state rewrite bypassing rules | cannot exist without work order |
| ExecutionRouting aggregate | ExecutionRouting | RoutingStep, ManufacturingOperation, ManufacturingRelationship | routing instantiate/update commands | acyclic dependencies except bounded rework loops; sequence uniqueness | references to work center/cell, Product routing definition refs | no mutation of Product design routing | cannot exist without work order context |
| OperationExecution aggregate | OperationExecution | ProductionStatus, local assignment links | start/progress/pause/complete/correct commands | operation lifecycle, prerequisite gates, quantity coherence | references to material consumption, outputs, downtime, assignments | no cross-operation quantity mutation bypassing contracts | cannot exist without work order + routing step |
| MaterialRequirement aggregate | MaterialRequirement | MaterialIssueRequest, MaterialConsumptionRecord | requirement/issue/consume/return commands | required, issued, consumed, returned coherence | inventory reservation/allocation/movement references only | no direct inventory stock mutation | cannot exist without work order context |
| ProductionOutput aggregate | ProductionOutputRecord | YieldRecord, ScrapRecord, ReworkRecord | output/scrap/rework/yield record commands | output disposition integrity and compensating correction rules | operation execution and inventory receipt/movement refs | no direct inventory receipt mutation | cannot exist without work order context |
| WorkCenter aggregate | WorkCenter | ProductionCell, MachineAssignment, ToolAssignment, LaborAssignment | assignment and availability commands | capacity, concurrency, status availability rules | operation execution and work-order refs | no asset identity/custody mutation | work center may exist independently; assignments cannot |
| ProductionBatch aggregate | ProductionBatch | batch-level trace links and status | batch start/close/correct commands | batch quantity and lifecycle coherence | work order, run, output refs | no external stock mutation | cannot exist without work order or run |
| DowntimeRecord aggregate | DowntimeRecord | none or optional exception metadata node | downtime start/end/correct commands | duration, overlap, category validity | operation/work center/machine refs | no maintenance-asset lifecycle mutation | can exist with work-order context before operation link |
| ProductionTrace aggregate | ProductionTraceRecord | append-only trace nodes linked by causation | trace append commands | immutable lineage, no destructive rewrite | all entity references as identifiers | no source-record mutation through trace writes | trace node cannot exist without source reference |

Entities that may not exist independently:
- RoutingStep, ManufacturingOperation without ExecutionRouting
- OperationExecution without WorkOrder plus RoutingStep
- MaterialIssueRequest and MaterialConsumptionRecord without MaterialRequirement
- YieldRecord, ScrapRecord, ReworkRecord without ProductionOutput or WorkOrder context
- MachineAssignment, ToolAssignment, LaborAssignment without executable target context
