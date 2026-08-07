# 06 Relationships

## Core Relationships

- ManufacturingWorkOrder -> ProductReference (mandatory)
- ManufacturingWorkOrder -> ProductVersionReference (mandatory)
- ManufacturingWorkOrder -> ProductBomReference (mandatory)
- ManufacturingWorkOrder -> ProductVariantReference (optional)
- ManufacturingWorkOrder -> ProductionRun (one-to-many)
- ManufacturingWorkOrder -> ExecutionRouting (one-to-one or one-to-many by policy)
- ManufacturingWorkOrder -> MaterialRequirement (one-to-many)
- ManufacturingWorkOrder -> ProductionOutputRecord (one-to-many)
- ManufacturingWorkOrder -> WorkInProgressState (one-to-one current state)
- ExecutionRouting -> RoutingStep (one-to-many ordered)
- RoutingStep -> ManufacturingOperation (one-to-one or one-to-many by model profile)
- ManufacturingOperation -> OperationExecution (one-to-many historical executions)
- MaterialRequirement -> MaterialIssueRequest (one-to-many)
- MaterialRequirement -> MaterialConsumptionRecord (one-to-many)
- ProductionOutputRecord -> ScrapRecord/ReworkRecord/YieldRecord (one-to-many as applicable)
- WorkCenter -> ProductionCell (one-to-many)
- WorkCenter/ProductionCell -> MachineAssignment/ToolAssignment/LaborAssignment (one-to-many)
- ProductionTraceRecord links across all major entities by immutable references

## Relationship Governance

- all cross-entity links are tenant-consistent
- all foreign links are references only
- prohibited cycles are blocked except approved bounded rework loops
- relationship mutation is audited with before/after references and causation metadata
