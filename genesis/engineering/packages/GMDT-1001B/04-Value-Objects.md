# 04 Value Objects

## Canonical Value Objects

| Value Object | Purpose | Core Rules |
|---|---|---|
| WorkOrderNumber | Human-facing work-order business identifier | unique within tenant and approved scope; non-reusable after retirement |
| ProductionOrderNumber | Human-facing production-order identifier | unique within tenant scope |
| BatchCode | Batch business code | uniqueness policy explicit per tenant and Product context |
| RunCode | Production run business code | unique per tenant and work-order scope |
| OperationCode | Operation business code | unique within routing scope |
| RoutingStepCode | Step business code | unique within routing |
| SequenceNumber | Ordered sequence value | positive integer; no duplicates in same sequence scope |
| PlannedQuantity | Planned execution quantity | non-negative; unit-aware |
| CompletedQuantity | Completed quantity | non-negative; bounded by policy |
| RejectedQuantity | Rejected quantity | non-negative |
| ScrapQuantity | Scrap quantity | non-negative |
| ReworkQuantity | Rework quantity | non-negative |
| RequiredMaterialQuantity | Required material quantity | non-negative; unit-aware |
| ConsumedMaterialQuantity | Consumed material quantity | non-negative; variance policy aware |
| YieldPercentage | Yield metric value | decimal range 0 to 100 inclusive |
| CycleTime | Expected or actual cycle duration | non-negative duration |
| SetupTime | Setup duration | non-negative duration |
| RunTime | Run duration | non-negative duration |
| DowntimeDuration | Downtime duration | non-negative duration; end >= start |
| LaborDuration | Labor duration | non-negative duration |
| MachineDuration | Machine runtime duration | non-negative duration |
| WorkCenterCode | Work center business code | unique per tenant |
| ProductionCellCode | Production cell business code | unique per work center or tenant policy |
| StatusCode | Domain status value | must belong to approved status enumeration |
| EffectiveDateRange | Inclusive temporal range | start <= end |
| ExecutionVersion | Monotonic version number | incremented on accepted mutation |
| ConcurrencyToken | Optimistic write token | must match expected state for mutation acceptance |
| IdempotencyKey | Duplicate-command guard key | unique within tenant and command scope |
| CorrelationIdentifier | Cross-flow correlation key | stable for correlated command chain |
| ProductIdentifier | Product reference identifier | foreign-owned, stable reference only |
| ProductVariantIdentifier | Product variant reference identifier | foreign-owned, stable reference only |
| ProductVersionIdentifier | Product version reference identifier | foreign-owned, stable reference only |
| BomIdentifier | Product BOM identifier | foreign-owned, stable reference only |
| InventoryItemIdentifier | Inventory item identifier | foreign-owned, stable reference only |
| InventoryReservationIdentifier | Inventory reservation identifier | foreign-owned, stable reference only |
| InventoryAllocationIdentifier | Inventory allocation identifier | foreign-owned, stable reference only |
| InventoryMovementIdentifier | Inventory movement identifier | foreign-owned, stable reference only |
| OrganizationIdentifier | Organization identifier | foreign-owned, stable reference only |
| AssetIdentifier | Asset identifier | foreign-owned, stable reference only |
| DocumentIdentifier | Document identifier | foreign-owned, stable reference only |
| KnowledgeIdentifier | Knowledge identifier | foreign-owned, stable reference only |
| CommerceOrderIdentifier | Commerce order identifier | foreign-owned, stable reference only |
| FinanceClassificationIdentifier | Finance classification identifier | foreign-owned, stable reference only |
| MetadataCollection | Structured metadata map | key allowlist, deterministic normalization, auditable updates |
