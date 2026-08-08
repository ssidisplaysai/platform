# 13 Query Surface

ManufacturingRoutingQueryService provides deterministic read-only queries:
- GetExecutionRouting
- ListExecutionRoutings
- GetRoutingProgress
- GetRoutingStep
- ListRoutingSteps
- GetOperationExecution
- ListOperationsByWorkOrder
- ListOperationsByRouting
- ListOperationsByStatus
- GetOperationEligibility
- GetNextEligibleOperations

Query behavior is tenant-isolated and non-mutating.
