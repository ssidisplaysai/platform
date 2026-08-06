# 03 Service Catalog

Service contract template:

- Purpose
- Owned commands
- Owned queries
- Inputs
- Outputs
- Aggregate boundary
- Transaction boundary
- Dependencies
- GSP components consumed
- Audit behavior
- Concurrency behavior
- Idempotency behavior
- Failure classes
- Prohibited behavior

1. InventoryItemService
- Purpose: register and lifecycle-manage inventory items linked to Product references.
- Owned commands: RegisterInventoryItem.
- Owned queries: GetInventoryItem, ListInventoryByProduct.
- Inputs: tenant, product reference, unit of measure, status intent, metadata.
- Outputs: inventory item state and version.
- Aggregate boundary: InventoryItemAggregate.
- Transaction boundary: single item aggregate mutation.
- Dependencies: Product reference validator, item repository, audit, metrics.
- GSP consumed: InvariantEngine, CommonValidators, PersistenceCoordinator, AuditService.
- Audit: record registration actor and reference validation result.
- Concurrency: expected-version on status transitions.
- Idempotency: register command key scoped by tenant and product reference.
- Failures: invalid reference, duplicate item mapping, stale version, validation failure.
- Prohibited: defining product attributes.

2. WarehouseService
- Purpose: warehouse creation and status lifecycle.
- Commands: CreateWarehouse.
- Queries: GetWarehouse, ListInventoryByWarehouse.
- Dependencies: warehouse repository, audit, health.
- Concurrency: expected-version for status transitions.
- Idempotency: CreateWarehouse key by tenant and warehouse code.
- Prohibited: facilities ownership beyond inventory operational state.

3. StorageLocationService
- Purpose: location and bin registration and status control.
- Commands: CreateStorageLocation, CreateBin.
- Queries: GetLocation, GetBin, ListInventoryByLocation.
- Dependencies: warehouse repository, location repository, containment validator.
- Concurrency: location and bin expected-version checks.
- Idempotency: create keys per parent and code.
- Failures: invalid containment, duplicate code, inactive parent.
- Prohibited: recursive containment.

4. InventoryBalanceService
- Purpose: authoritative quantity state reads and controlled updates.
- Commands: AdjustInventory, CreateInventorySnapshot.
- Queries: GetInventoryBalance, GetAvailability.
- Dependencies: balance repo, movement repo, projection updater.
- Concurrency: balance expected-version and compare-on-write.
- Idempotency: adjustment keys by external command identity.
- Prohibited: direct silent overwrite without movement or adjustment fact.

5. InventoryMovementService
- Purpose: execute stock movements across scopes.
- Commands: ReceiveStock, PutAwayStock, PickInventory, ShipInventoryMovement, ReturnInventory, TransferInventory, QuarantineInventory, ReleaseFromQuarantine, ExpireInventory.
- Queries: GetMovement, ListInTransitInventory.
- Dependencies: balance, location, lot, serial repos and validators.
- GSP consumed: PersistenceCoordinator, deterministic utilities, AuditService, MetricsService.
- Concurrency: per-aggregate and affected-balance version verification.
- Idempotency: movement key required for all movement commands.
- Prohibited: destructive mutation of prior ledger facts.

6. InventoryAdjustmentService
- Purpose: correction deltas with explicit reason classification.
- Commands: AdjustInventory.
- Queries: movement and adjustment history via ledger.
- Failures: invalid quantity sign, unauthorized reason, stale state.

7. InventoryLedgerService
- Purpose: append-only ledger fact creation and history reads.
- Commands: none directly external, invoked by movement/adjustment services.
- Queries: GetLedgerHistory.
- Concurrency: append sequence monotonic per stream.
- Idempotency: dedupe repeated append attempts by movement identity.
- Prohibited: update/delete ledger entries.

8. ReservationService
- Purpose: create, release, cancel, and expire reservation intent.
- Commands: ReserveInventory, ReleaseReservation.
- Queries: GetReservation, ListReservedInventory.
- Concurrency: reservation expected-version and balance conflict checks.
- Idempotency: reservation key by tenant plus external request identity.
- Failures: insufficient availability, stale reservation, expiry conflict.

9. AllocationService
- Purpose: commit reserved stock to execution scope.
- Commands: AllocateInventory, ReleaseAllocation.
- Queries: GetAllocation, ListAllocatedInventory.
- Concurrency: allocation expected-version and reservation remain-quantity checks.
- Idempotency: allocation key by reservation and external request identity.
- Failures: over-allocation, reservation invalid state, scope conflict.

10. TransferService
- Purpose: cross-location and cross-warehouse transfer orchestration.
- Commands: TransferInventory.
- Queries: ListInTransitInventory, transfer status read through movement summaries.
- Concurrency: source and destination balance versions verified atomically.
- Idempotency: transfer key required.
- Failures: transfer race, invalid destination, insufficient source quantity.

11. ReceivingService
- Purpose: inbound stock registration before final placement.
- Commands: ReceiveStock.
- Failures: invalid reference, invalid quantity, receiving location mismatch.

12. PutAwayService
- Purpose: assign received stock to storage location/bin.
- Commands: PutAwayStock.
- Failures: inactive location, quarantine-only mismatch.

13. PickingService
- Purpose: decrement allocatable stock for execution.
- Commands: PickInventory.
- Failures: insufficient allocated quantity, stale allocation.

14. PackingStateService
- Purpose: transition pick output into packed commitment state.
- Commands: MarkPacked.
- Failures: invalid prior state, duplicate pack operation.

15. LotService
- Purpose: lot registration, uniqueness enforcement, lot-bound stock behavior.
- Commands: RegisterLot.
- Queries: GetLot.
- Failures: duplicate lot code, invalid product scope.

16. SerialNumberService
- Purpose: serial registration and one-active-location enforcement.
- Commands: RegisterSerial.
- Queries: GetSerial.
- Failures: duplicate serial code, serial double assignment race.

17. ExpirationService
- Purpose: expiration calculation and state transitions.
- Commands: ExpireInventory.
- Queries: GetExpirationStatus.
- Failures: invalid date transition, release of expired stock without requalification.

18. ReorderPolicyService
- Purpose: manage reorder and safety stock policy definitions.
- Commands: SetReorderPolicy.
- Queries: GetReorderStatus.
- Failures: invalid threshold ranges, policy overlap.

19. InventoryReferenceService
- Purpose: validate and cache foreign references by policy.
- Commands: internal reference revalidation.
- Queries: reference validation status projection.
- Prohibited: direct foreign persistence writes or reads.

20. InventoryQueryService
- Purpose: facade for query handlers and projections.
- Commands: none.
- Queries: all list/get read surfaces.
- Prohibited: canonical mutation.

21. InventoryAuditService
- Purpose: inventory-specific audit envelope composition and reason taxonomy.
- Commands and queries: internal support service.
- GSP consumed: AuditService and ObservationPublisher.

22. InventoryHealthService
- Purpose: aggregate health indicators from runtime, persistence, references, and invariants.
- GSP consumed: HealthService.

23. InventoryMetricsService
- Purpose: emit domain counters and rates.
- GSP consumed: MetricsService.
- Prohibited: control-flow side effects from metrics emission.