# 25 Health Metrics and Audit

## Health

Health surfaces include:
- runtime
- persistence
- recovery
- Product integration
- Inventory integration
- Work Order invariants
- routing integrity
- operation integrity
- material requirement integrity
- traceability integrity
- idempotency
- concurrency
- resource assignment
- audit and observation sinks

## Metrics

Requested metrics are supported as first-class runtime counters or gauges:
- workOrderCount
- activeWorkOrderCount
- completedWorkOrderCount
- blockedWorkOrderCount
- operationCount
- activeOperationCount
- materialRequirementCount
- materialIssueRequestCount
- consumptionRecordCount
- productionOutputCount
- scrapCount
- reworkCount
- downtimeCount
- downtimeDuration
- wipQuantity
- completedQuantity
- rejectedQuantity
- scrapQuantity
- yieldProjection
- inventoryIntegrationFailureCount
- productValidationFailureCount
- staleVersionCount
- idempotentReplayCount
- idempotencyConflictCount
- recoveryCount
- recoveryFailureCount

## Audit

Audit captures command authority, correlation, idempotency, expected version, actor context, and immutable outcome evidence for all state-changing paths.
