import {
  ObservationPublisher,
  ObserverRegistry,
  compareDeterministicStrings,
} from "../../shared";
import type {
  AllocationContract,
  InventoryBalanceContract,
  InventoryHealthModel,
  InventoryMetricsModel,
  LotContract,
  ReservationContract,
  SerialNumberContract,
  TenantId,
} from "../contracts";
import { InventoryDomainError } from "../domain";
import type {
  InventoryRuntimeAuditRecord,
  InventoryRuntimeDependencies,
  InventoryReferenceHealthStatus,
  InventoryReferenceMetrics,
  InventoryReferenceService,
  InventoryReferenceValidatorRegistry,
} from "../integration";
import type {
  InventoryRuntimeContext,
  InventoryRuntimeServiceRegistration,
  InventoryServiceRegistrationHook,
  InventoryRuntimeState,
} from "../runtime";
import { createInventorySlice6Services, type InventorySlice6Services } from "./lot-serial-expiration";

export type InventoryHealthCategory = "HEALTHY" | "DEGRADED" | "UNHEALTHY";

export type InventoryHealthReasonCode =
  | "RUNTIME_NOT_READY"
  | "RUNTIME_PARTIAL_INITIALIZATION"
  | "MANDATORY_PRODUCT_VALIDATOR_MISSING"
  | "OPTIONAL_VALIDATOR_UNAVAILABLE"
  | "QUANTITY_INVARIANT_FAILURE"
  | "LEDGER_INTEGRITY_FAILURE"
  | "SERIAL_INTEGRITY_FAILURE"
  | "REFERENCE_VALIDATION_DEGRADATION"
  | "REPEATED_CONCURRENCY_CONFLICT"
  | "AUDIT_SINK_UNAVAILABLE"
  | "OBSERVATION_SINK_UNAVAILABLE"
  | "LIFECYCLE_STOP_FAILURE"
  | "HEALTH_CHECK_OK"
  | "INFORMATIONAL";

export type InventoryHealthSubsystem =
  | "runtime"
  | "providers"
  | "services"
  | "references"
  | "inventory-items"
  | "warehouse-location"
  | "balances"
  | "movement-ledger"
  | "idempotency"
  | "reservation-allocation"
  | "lot-serial"
  | "expiration"
  | "concurrency"
  | "recovery"
  | "observability";

export type InventoryHealthCheck = Readonly<{
  subsystem: InventoryHealthSubsystem;
  status: "PASS" | "WARN" | "FAIL";
  category: InventoryHealthCategory;
  reasonCode: InventoryHealthReasonCode;
  detail: string;
  required: boolean;
}>;

export type InventoryHealthSnapshot = InventoryHealthModel &
  Readonly<{
    checks: readonly InventoryHealthCheck[];
  }>;

export type InventoryMetricClassification = "COUNTER" | "GAUGE" | "DERIVED_PROJECTION";

export type InventoryMetricsSnapshot = Readonly<{
  generatedAt: string;
  classification: Readonly<Record<string, InventoryMetricClassification>>;
  values: InventoryMetricsModel &
    Readonly<{
      inventoryItemCount: number;
      activeInventoryItemCount: number;
      warehouseCount: number;
      storageLocationCount: number;
      binCount: number;
      balanceCount: number;
      onHandTotal: number;
      availableTotal: number;
      reservedTotal: number;
      allocatedTotal: number;
      quarantinedTotal: number;
      movementCount: number;
      adjustmentCount: number;
      internalMoveCount: number;
      writeOffCount: number;
      movementRejectionCount: number;
      ledgerEntryCount: number;
      ledgerIntegrityFailureCount: number;
      reservationCount: number;
      activeReservationCount: number;
      expiredReservationCount: number;
      reservationRejectionCount: number;
      allocationCount: number;
      activeAllocationCount: number;
      allocationRejectionCount: number;
      staleVersionCount: number;
      idempotentReplayCount: number;
      idempotencyConflictCount: number;
      lotCount: number;
      serialCount: number;
      quarantinedLotCount: number;
      quarantinedSerialCount: number;
      expiredLotCount: number;
      expiredSerialCount: number;
      nearExpiryCount: number;
      referenceValidationCount: number;
      referenceValidationFailureCount: number;
      mandatoryReferenceFailureCount: number;
      optionalReferenceFailureCount: number;
      missingValidatorCount: number;
      tenantMismatchCount: number;
      staleReferenceCount: number;
      startupFailureCount: number;
      shutdownFailureCount: number;
      integrationFailureCount: number;
    }>;
}>;

export type InventoryAuditCategory =
  | "ITEM"
  | "WAREHOUSE"
  | "LOCATION"
  | "BIN"
  | "BALANCE"
  | "MOVEMENT"
  | "ADJUSTMENT"
  | "LEDGER"
  | "RESERVATION"
  | "ALLOCATION"
  | "LOT"
  | "SERIAL"
  | "EXPIRATION"
  | "REFERENCE"
  | "RUNTIME"
  | "OBSERVATION";

export type InventoryAuditEvent = Readonly<{
  auditEventId: string;
  category: InventoryAuditCategory;
  action: string;
  rejectionClassification?: string;
  tenantId?: TenantId;
  correlationId?: string;
  entityType?: string;
  entityId?: string;
  record: InventoryRuntimeAuditRecord;
}>;

export type InventoryAuditSummary = Readonly<{
  totalEvents: number;
  acceptedEvents: number;
  rejectedEvents: number;
  byCategory: Readonly<Record<InventoryAuditCategory, number>>;
}>;

export type InventoryReferenceHealthProjection = Readonly<{
  status: InventoryHealthCategory;
  summary: InventoryReferenceHealthStatus;
  metrics: InventoryReferenceMetrics;
}>;

export type InventoryRuntimeReadinessProjection = Readonly<{
  runtimeId: string;
  phase: InventoryRuntimeState["phase"];
  ready: boolean;
  providerCount: number;
  serviceCount: number;
  partialInitialization: boolean;
  lastFailureCode?: string;
}>;

export type InventoryMissionControlObservation = Readonly<{
  platformIdentifier: "platform.inventory";
  schemaVersion: "1.0.0";
  runtime: InventoryRuntimeReadinessProjection;
  readiness: boolean;
  healthSummary: Readonly<{
    status: InventoryHealthCategory;
    degradedReasons: readonly InventoryHealthReasonCode[];
    unhealthyReasons: readonly InventoryHealthReasonCode[];
  }>;
  subsystemHealth: readonly InventoryHealthCheck[];
  metrics: InventoryMetricsSnapshot;
  referenceHealth: InventoryReferenceHealthProjection;
  lastObservationTimestamp: string;
}>;

export type InventoryObservabilityQuerySurface = Readonly<{
  getInventoryHealth(tenantId?: TenantId): Promise<InventoryHealthSnapshot>;
  getInventoryMetrics(tenantId?: TenantId): InventoryMetricsSnapshot;
  getInventoryAuditEvent(auditEventId: string): InventoryAuditEvent | undefined;
  listInventoryAuditEvents(tenantId?: TenantId): InventoryAuditEvent[];
  listAuditEventsByEntity(entityType: string, entityId?: string, tenantId?: TenantId): InventoryAuditEvent[];
  listAuditEventsByAction(action: string, tenantId?: TenantId): InventoryAuditEvent[];
  listAuditEventsByCorrelation(correlationId: string, tenantId?: TenantId): InventoryAuditEvent[];
  getReferenceHealth(): InventoryReferenceHealthProjection;
  getRuntimeReadiness(): InventoryRuntimeReadinessProjection;
  buildInventoryObservation(): Promise<InventoryMissionControlObservation>;
}>;

function cloneRecord(record: InventoryRuntimeAuditRecord): InventoryRuntimeAuditRecord {
  return structuredClone(record);
}

function categoryFromEventType(eventType: string): InventoryAuditCategory {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("inventory.item")) return "ITEM";
  if (normalized.includes("inventory.warehouse")) return "WAREHOUSE";
  if (normalized.includes("inventory.location")) return "LOCATION";
  if (normalized.includes("inventory.bin")) return "BIN";
  if (normalized.includes("inventory.balance")) return "BALANCE";
  if (normalized.includes("inventory.movement")) return "MOVEMENT";
  if (normalized.includes("inventory.adjustment")) return "ADJUSTMENT";
  if (normalized.includes("inventory.ledger")) return "LEDGER";
  if (normalized.includes("inventory.reservation")) return "RESERVATION";
  if (normalized.includes("inventory.allocation")) return "ALLOCATION";
  if (normalized.includes("inventory.lot")) return "LOT";
  if (normalized.includes("inventory.serial")) return "SERIAL";
  if (normalized.includes("inventory.expiration")) return "EXPIRATION";
  if (normalized.includes("inventory.reference")) return "REFERENCE";
  if (normalized.includes("runtime")) return "RUNTIME";
  if (normalized.includes("observation")) return "OBSERVATION";
  return "RUNTIME";
}

function readStringDetail(record: InventoryRuntimeAuditRecord, key: string): string | undefined {
  const value = record.details?.[key];
  return typeof value === "string" ? value : undefined;
}

function readBooleanDetail(record: InventoryRuntimeAuditRecord, key: string): boolean | undefined {
  const value = record.details?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function sortByRecordedAtAndId<T extends { recordedAt: string; id: string }>(records: readonly T[]): T[] {
  return [...records].sort((left, right) => {
    const byTime = compareDeterministicStrings(left.recordedAt, right.recordedAt);
    return byTime !== 0 ? byTime : compareDeterministicStrings(left.id, right.id);
  });
}

function computeQuantityInvariantFailureCount(balances: readonly InventoryBalanceContract[]): number {
  let failures = 0;
  for (const balance of balances) {
    const expected = balance.onHandQuantity - balance.reservedQuantity - balance.allocatedQuantity - balance.nonAllocatableHoldQuantity;
    if (
      balance.onHandQuantity < 0 ||
      balance.reservedQuantity < 0 ||
      balance.allocatedQuantity < 0 ||
      balance.nonAllocatableHoldQuantity < 0 ||
      balance.availableQuantity !== expected
    ) {
      failures += 1;
    }
  }
  return failures;
}

export class InventoryAuditService {
  private readonly events = new Map<string, InventoryAuditEvent>();
  private readonly tenantIds = new Set<TenantId>();
  private sequence = 0;

  constructor(
    private readonly dependencies: InventoryRuntimeDependencies,
    private readonly upstreamAuditSink = dependencies.auditSinkProvider,
  ) {}

  private createAuditEvent(record: InventoryRuntimeAuditRecord): InventoryAuditEvent {
    this.sequence += 1;
    const auditEventId = `${record.recordedAt}:${this.sequence.toString().padStart(9, "0")}`;
    const category = categoryFromEventType(record.eventType);
    const action = readStringDetail(record, "action") ?? "UNKNOWN_ACTION";
    const tenantId = readStringDetail(record, "tenantId") as TenantId | undefined;
    if (tenantId) {
      this.tenantIds.add(tenantId);
    }

    return {
      auditEventId,
      category,
      action,
      rejectionClassification: readStringDetail(record, "resultClassification") ?? readStringDetail(record, "rejectionClassification"),
      tenantId,
      correlationId: readStringDetail(record, "correlationId"),
      entityType: readStringDetail(record, "entityType"),
      entityId: readStringDetail(record, "entityId"),
      record: cloneRecord(record),
    };
  }

  getAuditSinkProvider() {
    return {
      ...this.upstreamAuditSink,
      providerId: `${this.upstreamAuditSink.providerId}.inventory-audit-service`,
      async recordAudit: async (record: InventoryRuntimeAuditRecord) => {
        const event = this.createAuditEvent(record);
        this.events.set(event.auditEventId, event);
        await this.upstreamAuditSink.recordAudit(record);
      },
    } satisfies InventoryRuntimeDependencies["auditSinkProvider"];
  }

  getKnownTenantIds(): TenantId[] {
    return [...this.tenantIds].sort(compareDeterministicStrings);
  }

  getInventoryAuditEvent(auditEventId: string): InventoryAuditEvent | undefined {
    const found = this.events.get(auditEventId);
    return found ? structuredClone(found) : undefined;
  }

  listInventoryAuditEvents(tenantId?: TenantId): InventoryAuditEvent[] {
    const list = [...this.events.values()]
      .filter((event) => !tenantId || event.tenantId === tenantId)
      .map((event) => ({ ...event, id: event.auditEventId, recordedAt: event.record.recordedAt }));
    return sortByRecordedAtAndId(list).map(({ id: _id, recordedAt: _recordedAt, ...event }) => structuredClone(event));
  }

  listAuditEventsByEntity(entityType: string, entityId?: string, tenantId?: TenantId): InventoryAuditEvent[] {
    return this.listInventoryAuditEvents(tenantId).filter(
      (event) => event.entityType === entityType && (!entityId || event.entityId === entityId),
    );
  }

  listAuditEventsByAction(action: string, tenantId?: TenantId): InventoryAuditEvent[] {
    return this.listInventoryAuditEvents(tenantId).filter((event) => event.action === action);
  }

  listAuditEventsByCorrelation(correlationId: string, tenantId?: TenantId): InventoryAuditEvent[] {
    return this.listInventoryAuditEvents(tenantId).filter((event) => event.correlationId === correlationId);
  }

  summarize(tenantId?: TenantId): InventoryAuditSummary {
    const events = this.listInventoryAuditEvents(tenantId);
    const byCategory: Record<InventoryAuditCategory, number> = {
      ITEM: 0,
      WAREHOUSE: 0,
      LOCATION: 0,
      BIN: 0,
      BALANCE: 0,
      MOVEMENT: 0,
      ADJUSTMENT: 0,
      LEDGER: 0,
      RESERVATION: 0,
      ALLOCATION: 0,
      LOT: 0,
      SERIAL: 0,
      EXPIRATION: 0,
      REFERENCE: 0,
      RUNTIME: 0,
      OBSERVATION: 0,
    };

    let acceptedEvents = 0;
    let rejectedEvents = 0;
    for (const event of events) {
      byCategory[event.category] += 1;
      const explicitSuccess = readBooleanDetail(event.record, "success");
      if (explicitSuccess === true) {
        acceptedEvents += 1;
      } else if (explicitSuccess === false || event.record.eventType.includes("rejected")) {
        rejectedEvents += 1;
      }
    }

    return {
      totalEvents: events.length,
      acceptedEvents,
      rejectedEvents,
      byCategory,
    };
  }

  rejectMutation(): never {
    throw new InventoryDomainError("APPEND_ONLY_VIOLATION", "inventory audit mutation is prohibited", false);
  }

  rejectDeletion(): never {
    throw new InventoryDomainError("APPEND_ONLY_VIOLATION", "inventory audit deletion is prohibited", false);
  }
}

export class InventoryMetricsService {
  private static readonly CLASSIFICATION: Readonly<Record<string, InventoryMetricClassification>> = {
    commandsAccepted: "COUNTER",
    commandsRejected: "COUNTER",
    movementCount: "GAUGE",
    reservationCount: "GAUGE",
    allocationCount: "GAUGE",
    lowStockCount: "DERIVED_PROJECTION",
    expiredStockCount: "DERIVED_PROJECTION",
    quarantinedStockCount: "DERIVED_PROJECTION",
    concurrencyConflictCount: "COUNTER",
    idempotencyRejectionCount: "COUNTER",
    failedReferenceCount: "COUNTER",
    inventoryItemCount: "GAUGE",
    activeInventoryItemCount: "GAUGE",
    warehouseCount: "GAUGE",
    storageLocationCount: "GAUGE",
    binCount: "GAUGE",
    balanceCount: "GAUGE",
    onHandTotal: "GAUGE",
    availableTotal: "GAUGE",
    reservedTotal: "GAUGE",
    allocatedTotal: "GAUGE",
    quarantinedTotal: "GAUGE",
    adjustmentCount: "GAUGE",
    internalMoveCount: "GAUGE",
    writeOffCount: "GAUGE",
    movementRejectionCount: "COUNTER",
    ledgerEntryCount: "GAUGE",
    ledgerIntegrityFailureCount: "COUNTER",
    activeReservationCount: "GAUGE",
    expiredReservationCount: "GAUGE",
    reservationRejectionCount: "COUNTER",
    activeAllocationCount: "GAUGE",
    allocationRejectionCount: "COUNTER",
    staleVersionCount: "COUNTER",
    idempotentReplayCount: "COUNTER",
    idempotencyConflictCount: "COUNTER",
    lotCount: "GAUGE",
    serialCount: "GAUGE",
    quarantinedLotCount: "GAUGE",
    quarantinedSerialCount: "GAUGE",
    expiredLotCount: "GAUGE",
    expiredSerialCount: "GAUGE",
    nearExpiryCount: "DERIVED_PROJECTION",
    referenceValidationCount: "COUNTER",
    referenceValidationFailureCount: "COUNTER",
    mandatoryReferenceFailureCount: "COUNTER",
    optionalReferenceFailureCount: "COUNTER",
    missingValidatorCount: "COUNTER",
    tenantMismatchCount: "COUNTER",
    staleReferenceCount: "COUNTER",
    startupFailureCount: "COUNTER",
    shutdownFailureCount: "COUNTER",
    integrationFailureCount: "COUNTER",
  };

  constructor(
    private readonly slice6: InventorySlice6Services,
    private readonly audit: InventoryAuditService,
    private readonly referenceService: InventoryReferenceService,
    private readonly dependencies: InventoryRuntimeDependencies,
    private readonly runtimeStateProvider: () => InventoryRuntimeState | undefined,
  ) {}

  private countEvents(predicate: (event: InventoryAuditEvent) => boolean): number {
    return this.audit.listInventoryAuditEvents().filter(predicate).length;
  }

  private gatherTenantIds(explicitTenant?: TenantId): TenantId[] {
    if (explicitTenant) {
      return [explicitTenant];
    }

    return this.audit.getKnownTenantIds();
  }

  private sumBalances(balances: readonly InventoryBalanceContract[]) {
    return balances.reduce(
      (acc, balance) => {
        acc.onHandTotal += balance.onHandQuantity;
        acc.availableTotal += balance.availableQuantity;
        acc.reservedTotal += balance.reservedQuantity;
        acc.allocatedTotal += balance.allocatedQuantity;
        acc.quarantinedTotal += balance.nonAllocatableHoldQuantity;
        return acc;
      },
      {
        onHandTotal: 0,
        availableTotal: 0,
        reservedTotal: 0,
        allocatedTotal: 0,
        quarantinedTotal: 0,
      },
    );
  }

  snapshot(tenantId?: TenantId): InventoryMetricsSnapshot {
    const tenantIds = this.gatherTenantIds(tenantId);

    const items = tenantIds.flatMap((id) => this.slice6.slice5.slice4.foundation.inventoryItemService.listInventoryItems(id));
    const warehouses = tenantIds.flatMap((id) => this.slice6.slice5.slice4.foundation.warehouseService.listWarehouses(id));
    const locations = tenantIds.flatMap((id) => this.slice6.slice5.slice4.foundation.storageLocationService.listStorageLocations(id));
    const bins = tenantIds.flatMap((id) => this.slice6.slice5.slice4.foundation.binService.listBins(id));
    const balances = tenantIds.flatMap((id) => this.slice6.slice5.slice4.foundation.inventoryBalanceService.listInventoryBalances(id));

    const movements = tenantIds.flatMap((id) => this.slice6.slice5.slice4.movementService.listInventoryMovements(id));
    const ledgerEntries = tenantIds.flatMap((id) => this.slice6.slice5.slice4.ledgerService.listLedgerEntries(id));
    const reservations = tenantIds.flatMap((id) => this.slice6.slice5.reservationService.listReservations(id));
    const allocations = tenantIds.flatMap((id) => this.slice6.slice5.allocationService.listAllocations(id));
    const lots = tenantIds.flatMap((id) => this.slice6.lotService.listLots(id));
    const serials = tenantIds.flatMap((id) => this.slice6.serialNumberService.listSerials(id));
    const nearExpiry = tenantIds.flatMap((id) => this.slice6.expirationService.listExpiring(id));
    const expired = tenantIds.flatMap((id) => this.slice6.expirationService.listExpired(id));

    const referenceMetrics = this.referenceService.getMetrics();
    const referenceAuditEvents = this.audit.listInventoryAuditEvents().filter((event) => event.category === "REFERENCE");
    const derivedReferenceMetrics = {
      referenceValidationCount: referenceAuditEvents.filter((event) => event.record.eventType.includes("validation")).length,
      referenceValidationFailureCount: referenceAuditEvents.filter(
        (event) => readBooleanDetail(event.record, "success") === false || event.record.eventType.includes("rejected"),
      ).length,
      mandatoryReferenceFailureCount: referenceAuditEvents.filter((event) => (event.rejectionClassification ?? "").includes("MANDATORY")).length,
      optionalReferenceFailureCount: referenceAuditEvents.filter((event) => (event.rejectionClassification ?? "").includes("OPTIONAL")).length,
      missingValidatorCount: referenceAuditEvents.filter((event) => event.record.eventType.includes("missing-validator")).length,
      tenantMismatchCount: referenceAuditEvents.filter((event) => (event.rejectionClassification ?? "").includes("TENANT")).length,
      staleReferenceCount: referenceAuditEvents.filter((event) => (event.rejectionClassification ?? "").includes("STALE")).length,
    };
    const balanceTotals = this.sumBalances(balances);

    const runtimeState = this.runtimeStateProvider();
    const startupFailureCount = runtimeState?.lastFailure?.code === "LIFECYCLE_START_FAILURE" ? 1 : 0;
    const shutdownFailureCount = runtimeState?.lastFailure?.code === "LIFECYCLE_STOP_FAILURE" ? 1 : 0;
    const integrationFailureCount =
      (runtimeState?.lastFailure?.code === "INTEGRATION_REGISTRATION_FAILURE" ? 1 : 0)
      + this.countEvents((event) => event.record.eventType === "inventory.observation.publish.rejected");

    const movementRejectionCount = this.countEvents((event) => event.category === "MOVEMENT" && event.record.eventType.includes("rejected"));
    const reservationRejectionCount = this.countEvents((event) => event.category === "RESERVATION" && event.record.eventType.includes("rejected"));
    const allocationRejectionCount = this.countEvents((event) => event.category === "ALLOCATION" && event.record.eventType.includes("rejected"));
    const ledgerIntegrityFailureCount = this.countEvents((event) => event.record.eventType === "inventory.ledger.integrity.rejected");

    const staleVersionCount = this.countEvents((event) => (event.rejectionClassification ?? "").startsWith("STALE_"));
    const idempotentReplayCount = this.countEvents((event) => event.record.eventType === "inventory.idempotency.replay" || event.record.eventType === "inventory.movement.idempotent-replay");
    const idempotencyConflictCount = this.countEvents((event) => event.rejectionClassification === "CONFLICTING_IDEMPOTENCY_PAYLOAD");

    const commandsAccepted = this.countEvents((event) => readBooleanDetail(event.record, "success") === true);
    const commandsRejected = this.countEvents((event) => readBooleanDetail(event.record, "success") === false || event.record.eventType.includes("rejected"));

    const values = {
      commandsAccepted,
      commandsRejected,
      movementCount: movements.length,
      reservationCount: reservations.length,
      allocationCount: allocations.length,
      lowStockCount: balances.filter((balance) => balance.availableQuantity <= 0).length,
      expiredStockCount: expired.length,
      quarantinedStockCount: balances.filter((balance) => balance.nonAllocatableHoldQuantity > 0).length,
      concurrencyConflictCount: staleVersionCount,
      idempotencyRejectionCount: idempotencyConflictCount,
      failedReferenceCount:
        referenceMetrics.referenceValidationFailureCount || derivedReferenceMetrics.referenceValidationFailureCount,
      inventoryItemCount: items.length,
      activeInventoryItemCount: items.filter((item) => item.lifecycleState === "ACTIVE").length,
      warehouseCount: warehouses.length,
      storageLocationCount: locations.length,
      binCount: bins.length,
      balanceCount: balances.length,
      onHandTotal: balanceTotals.onHandTotal,
      availableTotal: balanceTotals.availableTotal,
      reservedTotal: balanceTotals.reservedTotal,
      allocatedTotal: balanceTotals.allocatedTotal,
      quarantinedTotal: balanceTotals.quarantinedTotal,
      adjustmentCount: movements.filter((movement) => movement.movementType === "ADJUST_INCREASE" || movement.movementType === "ADJUST_DECREASE").length,
      internalMoveCount: movements.filter((movement) => movement.movementType === "INTERNAL_MOVE").length,
      writeOffCount: movements.filter((movement) => movement.movementType === "WRITE_OFF").length,
      movementRejectionCount,
      ledgerEntryCount: ledgerEntries.length,
      ledgerIntegrityFailureCount,
      activeReservationCount: reservations.filter((reservation) => reservation.status === "ACTIVE" || reservation.status === "PARTIALLY_RELEASED").length,
      expiredReservationCount: reservations.filter((reservation) => reservation.status === "EXPIRED").length,
      reservationRejectionCount,
      activeAllocationCount: allocations.filter((allocation) => allocation.status === "ACTIVE" || allocation.status === "PARTIALLY_RELEASED").length,
      allocationRejectionCount,
      staleVersionCount,
      idempotentReplayCount,
      idempotencyConflictCount,
      lotCount: lots.length,
      serialCount: serials.length,
      quarantinedLotCount: lots.filter((lot) => lot.status === "QUARANTINED").length,
      quarantinedSerialCount: serials.filter((serial) => serial.status === "QUARANTINED").length,
      expiredLotCount: lots.filter((lot) => lot.status === "EXPIRED").length,
      expiredSerialCount: serials.filter((serial) => serial.status === "RETIRED").length,
      nearExpiryCount: nearExpiry.length,
      referenceValidationCount: referenceMetrics.referenceValidationCount || derivedReferenceMetrics.referenceValidationCount,
      referenceValidationFailureCount:
        referenceMetrics.referenceValidationFailureCount || derivedReferenceMetrics.referenceValidationFailureCount,
      mandatoryReferenceFailureCount:
        referenceMetrics.mandatoryReferenceFailureCount || derivedReferenceMetrics.mandatoryReferenceFailureCount,
      optionalReferenceFailureCount:
        referenceMetrics.optionalReferenceFailureCount || derivedReferenceMetrics.optionalReferenceFailureCount,
      missingValidatorCount: referenceMetrics.missingValidatorCount || derivedReferenceMetrics.missingValidatorCount,
      tenantMismatchCount: referenceMetrics.tenantMismatchCount || derivedReferenceMetrics.tenantMismatchCount,
      staleReferenceCount: referenceMetrics.staleReferenceCount || derivedReferenceMetrics.staleReferenceCount,
      startupFailureCount,
      shutdownFailureCount,
      integrationFailureCount,
    };

    return {
      generatedAt: this.dependencies.clockProvider.now(),
      classification: InventoryMetricsService.CLASSIFICATION,
      values,
    };
  }
}

export class InventoryHealthService {
  constructor(
    private readonly slice6: InventorySlice6Services,
    private readonly audit: InventoryAuditService,
    private readonly metrics: InventoryMetricsService,
    private readonly referenceService: InventoryReferenceService,
    private readonly dependencies: InventoryRuntimeDependencies,
    private readonly runtimeStateProvider: () => InventoryRuntimeState | undefined,
  ) {}

  private makeCheck(
    subsystem: InventoryHealthSubsystem,
    status: "PASS" | "WARN" | "FAIL",
    reasonCode: InventoryHealthReasonCode,
    detail: string,
    required: boolean,
  ): InventoryHealthCheck {
    const category: InventoryHealthCategory = status === "FAIL" ? "UNHEALTHY" : status === "WARN" ? "DEGRADED" : "HEALTHY";
    return { subsystem, status, category, reasonCode, detail, required };
  }

  private gatherTenantIds(explicitTenant?: TenantId): TenantId[] {
    if (explicitTenant) {
      return [explicitTenant];
    }
    return this.audit.getKnownTenantIds();
  }

  async snapshot(tenantId?: TenantId): Promise<InventoryHealthSnapshot> {
    const checks: InventoryHealthCheck[] = [];
    const runtime = this.runtimeStateProvider();
    checks.push(
      this.makeCheck(
        "runtime",
        runtime?.ready ? "PASS" : runtime?.phase === "FAILED" ? "FAIL" : "WARN",
        runtime?.ready
          ? "HEALTH_CHECK_OK"
          : runtime?.phase === "FAILED"
            ? "RUNTIME_PARTIAL_INITIALIZATION"
            : "RUNTIME_NOT_READY",
        runtime ? `phase=${runtime.phase}` : "runtime state unavailable",
        true,
      ),
    );

    const providerHealth = await Promise.all([
      this.dependencies.clockProvider.inspectHealth(),
      this.dependencies.identifierProvider.inspectHealth(),
      this.dependencies.tenantContextProvider.inspectHealth(),
      this.dependencies.metadataProvider.inspectHealth(),
      this.dependencies.auditSinkProvider.inspectHealth(),
      this.dependencies.observationSinkProvider.inspectHealth(),
    ]);

    checks.push(
      this.makeCheck(
        "providers",
        providerHealth.every((entry) => entry.status === "HEALTHY") ? "PASS" : "WARN",
        providerHealth.every((entry) => entry.status === "HEALTHY") ? "HEALTH_CHECK_OK" : "INFORMATIONAL",
        providerHealth.map((entry) => entry.detail).join(" | "),
        true,
      ),
    );

    checks.push(
      this.makeCheck(
        "services",
        runtime && runtime.serviceIds.length > 0 ? "PASS" : "WARN",
        runtime && runtime.serviceIds.length > 0 ? "HEALTH_CHECK_OK" : "RUNTIME_PARTIAL_INITIALIZATION",
        runtime ? `services=${runtime.serviceIds.length}` : "service registration unavailable",
        true,
      ),
    );

    const referenceHealth = this.referenceService.getHealth();
    const referenceMetrics = this.referenceService.getMetrics();
    checks.push(
      this.makeCheck(
        "references",
        referenceHealth.requiredProductValidatorRegistered
          ? referenceMetrics.optionalReferenceFailureCount > 0 || referenceMetrics.missingValidatorCount > 0
            ? "WARN"
            : "PASS"
          : "FAIL",
        !referenceHealth.requiredProductValidatorRegistered
          ? "MANDATORY_PRODUCT_VALIDATOR_MISSING"
          : referenceMetrics.optionalReferenceFailureCount > 0 || referenceMetrics.missingValidatorCount > 0
            ? "OPTIONAL_VALIDATOR_UNAVAILABLE"
            : "HEALTH_CHECK_OK",
        `supported=${referenceHealth.supportedTypes.join(",") || "none"}; missingOptional=${referenceMetrics.missingValidatorCount}`,
        true,
      ),
    );

    const tenantIds = this.gatherTenantIds(tenantId);
    const items = tenantIds.flatMap((id) => this.slice6.slice5.slice4.foundation.inventoryItemService.listInventoryItems(id));
    const productKeys = new Set<string>();
    let duplicateMappings = 0;
    for (const item of items) {
      const key = `${item.tenantId}|${item.productReferenceId}|${item.productVariantReferenceId ?? ""}`;
      if (productKeys.has(key)) {
        duplicateMappings += 1;
      }
      productKeys.add(key);
    }
    checks.push(
      this.makeCheck(
        "inventory-items",
        duplicateMappings === 0 ? "PASS" : "FAIL",
        duplicateMappings === 0 ? "HEALTH_CHECK_OK" : "INFORMATIONAL",
        duplicateMappings === 0 ? "item mappings are unique" : `duplicate mappings=${duplicateMappings}`,
        true,
      ),
    );

    const warehouses = tenantIds.flatMap((id) => this.slice6.slice5.slice4.foundation.warehouseService.listWarehouses(id));
    const warehouseKeys = new Set(warehouses.map((warehouse) => `${warehouse.tenantId}|${warehouse.warehouseId}`));
    const locations = tenantIds.flatMap((id) => this.slice6.slice5.slice4.foundation.storageLocationService.listStorageLocations(id));
    const invalidLocationParents = locations.filter((location) => !warehouseKeys.has(`${location.tenantId}|${location.warehouseId}`)).length;
    checks.push(
      this.makeCheck(
        "warehouse-location",
        invalidLocationParents === 0 ? "PASS" : "FAIL",
        invalidLocationParents === 0 ? "HEALTH_CHECK_OK" : "INFORMATIONAL",
        invalidLocationParents === 0 ? "location containment intact" : `invalid location containment=${invalidLocationParents}`,
        true,
      ),
    );

    const balances = tenantIds.flatMap((id) => this.slice6.slice5.slice4.foundation.inventoryBalanceService.listInventoryBalances(id));
    const quantityFailures = computeQuantityInvariantFailureCount(balances);
    checks.push(
      this.makeCheck(
        "balances",
        quantityFailures === 0 ? "PASS" : "FAIL",
        quantityFailures === 0 ? "HEALTH_CHECK_OK" : "QUANTITY_INVARIANT_FAILURE",
        quantityFailures === 0 ? "quantity invariants hold" : `quantity invariant failures=${quantityFailures}`,
        true,
      ),
    );

    let ledgerFailures = 0;
    for (const id of tenantIds) {
      const integrity = await this.slice6.slice5.slice4.ledgerService.verifyLedgerIntegrity(this.slice6.slice5.slice4.movementService.listInventoryMovements(id));
      if (!integrity.valid) {
        ledgerFailures += 1;
      }
    }
    checks.push(
      this.makeCheck(
        "movement-ledger",
        ledgerFailures === 0 ? "PASS" : "FAIL",
        ledgerFailures === 0 ? "HEALTH_CHECK_OK" : "LEDGER_INTEGRITY_FAILURE",
        ledgerFailures === 0 ? "movement/ledger integrity valid" : `ledger integrity failures=${ledgerFailures}`,
        true,
      ),
    );

    const idempotencyConflicts = this.audit.listInventoryAuditEvents(tenantId).filter(
      (event) => event.rejectionClassification === "CONFLICTING_IDEMPOTENCY_PAYLOAD",
    ).length;
    checks.push(
      this.makeCheck(
        "idempotency",
        idempotencyConflicts === 0 ? "PASS" : "WARN",
        idempotencyConflicts === 0 ? "HEALTH_CHECK_OK" : "INFORMATIONAL",
        idempotencyConflicts === 0 ? "idempotency integrity healthy" : `idempotency conflicts=${idempotencyConflicts}`,
        true,
      ),
    );

    const reservations = tenantIds.flatMap((id) => this.slice6.slice5.reservationService.listReservations(id));
    const allocations = tenantIds.flatMap((id) => this.slice6.slice5.allocationService.listAllocations(id));
    const reservationIssues = reservations.filter((reservation) => reservation.remainingQuantity < 0).length;
    const allocationIssues = allocations.filter((allocation) => allocation.remainingQuantity < 0).length;
    checks.push(
      this.makeCheck(
        "reservation-allocation",
        reservationIssues + allocationIssues === 0 ? "PASS" : "FAIL",
        reservationIssues + allocationIssues === 0 ? "HEALTH_CHECK_OK" : "INFORMATIONAL",
        `reservationIssues=${reservationIssues}; allocationIssues=${allocationIssues}`,
        true,
      ),
    );

    const lots = tenantIds.flatMap((id) => this.slice6.lotService.listLots(id));
    const lotIds = new Set(lots.map((lot) => `${lot.tenantId}|${lot.lotId}`));
    const serials = tenantIds.flatMap((id) => this.slice6.serialNumberService.listSerials(id));
    const duplicateSerialCodeKeys = new Set<string>();
    let duplicateSerials = 0;
    let invalidSerialLot = 0;
    for (const serial of serials) {
      const codeKey = `${serial.tenantId}|${serial.serialCode}`;
      if (duplicateSerialCodeKeys.has(codeKey)) {
        duplicateSerials += 1;
      }
      duplicateSerialCodeKeys.add(codeKey);
      if (serial.lotId && !lotIds.has(`${serial.tenantId}|${serial.lotId}`)) {
        invalidSerialLot += 1;
      }
    }
    checks.push(
      this.makeCheck(
        "lot-serial",
        duplicateSerials + invalidSerialLot === 0 ? "PASS" : "FAIL",
        duplicateSerials + invalidSerialLot === 0 ? "HEALTH_CHECK_OK" : "SERIAL_INTEGRITY_FAILURE",
        `duplicateSerials=${duplicateSerials}; invalidSerialLotLinks=${invalidSerialLot}`,
        true,
      ),
    );

    const expirationIssues = tenantIds.reduce((count, id) => {
      const expiring = this.slice6.expirationService.listExpiring(id).filter(
        (record) => !record.lotId && !record.serialNumberId,
      ).length;
      const expired = this.slice6.expirationService.listExpired(id).filter(
        (record) => !record.lotId && !record.serialNumberId,
      ).length;
      return count + expiring + expired;
    }, 0);
    checks.push(
      this.makeCheck(
        "expiration",
        expirationIssues === 0 ? "PASS" : "WARN",
        expirationIssues === 0 ? "HEALTH_CHECK_OK" : "INFORMATIONAL",
        expirationIssues === 0 ? "expiration integrity valid" : `expiration anomalies=${expirationIssues}`,
        false,
      ),
    );

    const staleVersionCount = this.metrics.snapshot(tenantId).values.staleVersionCount;
    checks.push(
      this.makeCheck(
        "concurrency",
        staleVersionCount >= 3 ? "FAIL" : staleVersionCount > 0 ? "WARN" : "PASS",
        staleVersionCount >= 3 ? "REPEATED_CONCURRENCY_CONFLICT" : staleVersionCount > 0 ? "INFORMATIONAL" : "HEALTH_CHECK_OK",
        `staleVersionCount=${staleVersionCount}`,
        true,
      ),
    );

    checks.push(
      this.makeCheck(
        "recovery",
        runtime?.lastFailure?.code === "LIFECYCLE_STOP_FAILURE" ? "WARN" : "PASS",
        runtime?.lastFailure?.code === "LIFECYCLE_STOP_FAILURE" ? "LIFECYCLE_STOP_FAILURE" : "HEALTH_CHECK_OK",
        runtime?.lastFailure?.message ?? "recovery state nominal",
        false,
      ),
    );

    const auditSinkHealth = await this.dependencies.auditSinkProvider.inspectHealth();
    const observationSinkHealth = await this.dependencies.observationSinkProvider.inspectHealth();
    checks.push(
      this.makeCheck(
        "observability",
        auditSinkHealth.status === "HEALTHY" && observationSinkHealth.status === "HEALTHY"
          ? "PASS"
          : auditSinkHealth.status !== "HEALTHY"
            ? "FAIL"
            : "WARN",
        auditSinkHealth.status !== "HEALTHY"
          ? "AUDIT_SINK_UNAVAILABLE"
          : observationSinkHealth.status !== "HEALTHY"
            ? "OBSERVATION_SINK_UNAVAILABLE"
            : "HEALTH_CHECK_OK",
        `auditSink=${auditSinkHealth.detail}; observationSink=${observationSinkHealth.detail}`,
        true,
      ),
    );

    const orderedChecks = [...checks].sort((left, right) => compareDeterministicStrings(left.subsystem, right.subsystem));
    const hasFail = orderedChecks.some((check) => check.status === "FAIL");
    const hasWarn = orderedChecks.some((check) => check.status === "WARN");
    const status: InventoryHealthCategory = hasFail ? "UNHEALTHY" : hasWarn ? "DEGRADED" : "HEALTHY";

    return {
      status,
      generatedAt: this.dependencies.clockProvider.now(),
      checks: orderedChecks,
    };
  }
}

export class InventoryObservationService {
  private readonly observers = new ObserverRegistry<InventoryMissionControlObservation>();
  private readonly publisher = new ObservationPublisher(this.observers);
  private observationPublishFailureCount = 0;
  private lastObservationTimestamp?: string;

  constructor(
    private readonly dependencies: InventoryRuntimeDependencies,
    private readonly healthService: InventoryHealthService,
    private readonly metricsService: InventoryMetricsService,
    private readonly referenceService: InventoryReferenceService,
    private readonly runtimeReadinessProvider: () => InventoryRuntimeReadinessProjection,
    private readonly auditService: InventoryAuditService,
  ) {}

  registerObserver(observerId: string, receiveObservation: (observation: InventoryMissionControlObservation) => Promise<void>): void {
    this.observers.register({ observerId, receiveObservation });
  }

  getPublishFailureCount(): number {
    return this.observationPublishFailureCount;
  }

  async buildInventoryObservation(): Promise<InventoryMissionControlObservation> {
    const health = await this.healthService.snapshot();
    const metrics = this.metricsService.snapshot();
    const runtime = this.runtimeReadinessProvider();
    const degradedReasons = health.checks.filter((check) => check.status === "WARN").map((check) => check.reasonCode);
    const unhealthyReasons = health.checks.filter((check) => check.status === "FAIL").map((check) => check.reasonCode);

    const observation: InventoryMissionControlObservation = {
      platformIdentifier: "platform.inventory",
      schemaVersion: "1.0.0",
      runtime,
      readiness: runtime.ready,
      healthSummary: {
        status: health.status,
        degradedReasons,
        unhealthyReasons,
      },
      subsystemHealth: health.checks,
      metrics,
      referenceHealth: {
        status: this.referenceService.getHealth().degraded ? "DEGRADED" : "HEALTHY",
        summary: this.referenceService.getHealth(),
        metrics: this.referenceService.getMetrics(),
      },
      lastObservationTimestamp: this.lastObservationTimestamp ?? this.dependencies.clockProvider.now(),
    };

    return structuredClone(observation);
  }

  async publishInventoryObservation(): Promise<InventoryMissionControlObservation> {
    const observation = await this.buildInventoryObservation();
    try {
      await this.publisher.publish(observation);
      this.lastObservationTimestamp = this.dependencies.clockProvider.now();
      await this.auditService.getAuditSinkProvider().recordAudit({
        eventType: "inventory.observation.published",
        message: "inventory observation published",
        recordedAt: this.dependencies.clockProvider.now(),
        details: {
          action: "PUBLISH_INVENTORY_OBSERVATION",
          success: true,
        },
      });
    } catch (error) {
      this.observationPublishFailureCount += 1;
      await this.auditService.getAuditSinkProvider().recordAudit({
        eventType: "inventory.observation.publish.rejected",
        message: "inventory observation publication failed",
        recordedAt: this.dependencies.clockProvider.now(),
        details: {
          action: "PUBLISH_INVENTORY_OBSERVATION",
          success: false,
          rejectionClassification: "OBSERVATION_PUBLISH_FAILURE",
          reason: error instanceof Error ? error.message : "unknown error",
        },
      });
      throw error;
    }

    return observation;
  }
}

export class InventoryObservabilityQueryService implements InventoryObservabilityQuerySurface {
  constructor(
    private readonly healthService: InventoryHealthService,
    private readonly metricsService: InventoryMetricsService,
    private readonly auditService: InventoryAuditService,
    private readonly referenceService: InventoryReferenceService,
    private readonly runtimeReadinessProvider: () => InventoryRuntimeReadinessProjection,
    private readonly observationService: InventoryObservationService,
  ) {}

  async getInventoryHealth(tenantId?: TenantId): Promise<InventoryHealthSnapshot> {
    return this.healthService.snapshot(tenantId);
  }

  getInventoryMetrics(tenantId?: TenantId): InventoryMetricsSnapshot {
    return this.metricsService.snapshot(tenantId);
  }

  getInventoryAuditEvent(auditEventId: string): InventoryAuditEvent | undefined {
    return this.auditService.getInventoryAuditEvent(auditEventId);
  }

  listInventoryAuditEvents(tenantId?: TenantId): InventoryAuditEvent[] {
    return this.auditService.listInventoryAuditEvents(tenantId);
  }

  listAuditEventsByEntity(entityType: string, entityId?: string, tenantId?: TenantId): InventoryAuditEvent[] {
    return this.auditService.listAuditEventsByEntity(entityType, entityId, tenantId);
  }

  listAuditEventsByAction(action: string, tenantId?: TenantId): InventoryAuditEvent[] {
    return this.auditService.listAuditEventsByAction(action, tenantId);
  }

  listAuditEventsByCorrelation(correlationId: string, tenantId?: TenantId): InventoryAuditEvent[] {
    return this.auditService.listAuditEventsByCorrelation(correlationId, tenantId);
  }

  getReferenceHealth(): InventoryReferenceHealthProjection {
    const health = this.referenceService.getHealth();
    return {
      status: health.degraded ? "DEGRADED" : "HEALTHY",
      summary: health,
      metrics: this.referenceService.getMetrics(),
    };
  }

  getRuntimeReadiness(): InventoryRuntimeReadinessProjection {
    return this.runtimeReadinessProvider();
  }

  async buildInventoryObservation(): Promise<InventoryMissionControlObservation> {
    return this.observationService.buildInventoryObservation();
  }
}

export type InventorySlice8Services = Readonly<{
  slice6: InventorySlice6Services;
  auditService: InventoryAuditService;
  metricsService: InventoryMetricsService;
  healthService: InventoryHealthService;
  observationService: InventoryObservationService;
  observabilityQueryService: InventoryObservabilityQueryService;
}>;

function createRuntimeReadinessProjection(state?: InventoryRuntimeState): InventoryRuntimeReadinessProjection {
  return {
    runtimeId: state?.runtimeId ?? "inventory-runtime-unbound",
    phase: state?.phase ?? "CREATED",
    ready: state?.ready ?? false,
    providerCount: state?.providerIds.length ?? 0,
    serviceCount: state?.serviceIds.length ?? 0,
    partialInitialization: state?.phase === "FAILED" || (state ? !state.ready && state.phase !== "STOPPED" : true),
    lastFailureCode: state?.lastFailure?.code,
  };
}

export function createInventorySlice8Services(options: {
  dependencies: InventoryRuntimeDependencies;
  validatorRegistry: InventoryReferenceValidatorRegistry;
  runtimeStateProvider?: () => InventoryRuntimeState | undefined;
}): InventorySlice8Services {
  const runtimeStateProvider = options.runtimeStateProvider ?? (() => undefined);
  const auditService = new InventoryAuditService(options.dependencies);
  const wrappedDependencies: InventoryRuntimeDependencies = {
    ...options.dependencies,
    auditSinkProvider: auditService.getAuditSinkProvider(),
  };

  const slice6 = createInventorySlice6Services({
    dependencies: wrappedDependencies,
    validatorRegistry: options.validatorRegistry,
  });

  const referenceService = slice6.slice5.slice4.foundation.referenceValidationService;
  const metricsService = new InventoryMetricsService(
    slice6,
    auditService,
    referenceService,
    wrappedDependencies,
    runtimeStateProvider,
  );
  const healthService = new InventoryHealthService(
    slice6,
    auditService,
    metricsService,
    referenceService,
    wrappedDependencies,
    runtimeStateProvider,
  );

  const runtimeReadinessProvider = () => createRuntimeReadinessProjection(runtimeStateProvider());
  const observationService = new InventoryObservationService(
    wrappedDependencies,
    healthService,
    metricsService,
    referenceService,
    runtimeReadinessProvider,
    auditService,
  );

  const observabilityQueryService = new InventoryObservabilityQueryService(
    healthService,
    metricsService,
    auditService,
    referenceService,
    runtimeReadinessProvider,
    observationService,
  );

  return {
    slice6,
    auditService,
    metricsService,
    healthService,
    observationService,
    observabilityQueryService,
  };
}

export function createInventorySlice8ServiceRegistrationHook(options: {
  validatorRegistry: InventoryReferenceValidatorRegistry;
}): InventoryServiceRegistrationHook {
  return (context: InventoryRuntimeContext) => {
    const services = createInventorySlice8Services({
      dependencies: context.dependencies,
      validatorRegistry: options.validatorRegistry,
      runtimeStateProvider: () => context.host.getState(),
    });

    const registrations: InventoryRuntimeServiceRegistration[] = [
      {
        serviceId: "inventory.service.allocation",
        contract: "inventory.service.allocation",
        description: "Slice 5 allocation command service.",
        value: services.slice6.slice5.allocationService,
      },
      {
        serviceId: "inventory.service.allocation-query",
        contract: "inventory.service.allocation-query",
        description: "Slice 5 allocation query surface.",
        value: services.slice6.slice5.allocationQueryService,
      },
      {
        serviceId: "inventory.service.audit",
        contract: "inventory.service.audit",
        description: "Slice 8 inventory audit aggregation service.",
        value: services.auditService,
      },
      {
        serviceId: "inventory.service.bin",
        contract: "inventory.service.bin",
        description: "Slice 3 bin foundation service.",
        value: services.slice6.slice5.slice4.foundation.binService,
      },
      {
        serviceId: "inventory.service.expiration",
        contract: "inventory.service.expiration",
        description: "Slice 6 expiration service.",
        value: services.slice6.expirationService,
      },
      {
        serviceId: "inventory.service.expiration-query",
        contract: "inventory.service.expiration-query",
        description: "Slice 6 expiration query surface.",
        value: services.slice6.expirationQueryService,
      },
      {
        serviceId: "inventory.service.foundation-query",
        contract: "inventory.service.foundation-query",
        description: "Slice 3 deterministic foundation query service.",
        value: services.slice6.slice5.slice4.foundationQueries,
      },
      {
        serviceId: "inventory.service.health",
        contract: "inventory.service.health",
        description: "Slice 8 inventory health service.",
        value: services.healthService,
      },
      {
        serviceId: "inventory.service.inventory-adjustment",
        contract: "inventory.service.inventory-adjustment",
        description: "Slice 4 inventory adjustment service.",
        value: services.slice6.slice5.slice4.adjustmentService,
      },
      {
        serviceId: "inventory.service.inventory-balance",
        contract: "inventory.service.inventory-balance",
        description: "Slice 3 inventory balance foundation service.",
        value: services.slice6.slice5.slice4.foundation.inventoryBalanceService,
      },
      {
        serviceId: "inventory.service.inventory-item",
        contract: "inventory.service.inventory-item",
        description: "Slice 3 inventory item foundation service.",
        value: services.slice6.slice5.slice4.foundation.inventoryItemService,
      },
      {
        serviceId: "inventory.service.inventory-ledger",
        contract: "inventory.service.inventory-ledger",
        description: "Slice 4 append-only inventory ledger service.",
        value: services.slice6.slice5.slice4.ledgerService,
      },
      {
        serviceId: "inventory.service.inventory-movement",
        contract: "inventory.service.inventory-movement",
        description: "Slice 4 inventory movement service.",
        value: services.slice6.slice5.slice4.movementService,
      },
      {
        serviceId: "inventory.service.lot",
        contract: "inventory.service.lot",
        description: "Slice 6 lot command service.",
        value: services.slice6.lotService,
      },
      {
        serviceId: "inventory.service.lot-query",
        contract: "inventory.service.lot-query",
        description: "Slice 6 lot query surface.",
        value: services.slice6.lotQueryService,
      },
      {
        serviceId: "inventory.service.metrics",
        contract: "inventory.service.metrics",
        description: "Slice 8 inventory metrics service.",
        value: services.metricsService,
      },
      {
        serviceId: "inventory.service.movement-query",
        contract: "inventory.service.movement-query",
        description: "Slice 4 movement and ledger query service.",
        value: services.slice6.slice5.slice4.movementQueryService,
      },
      {
        serviceId: "inventory.service.observation-publisher",
        contract: "inventory.service.observation-publisher",
        description: "Slice 8 inventory mission control observation publisher.",
        value: services.observationService,
      },
      {
        serviceId: "inventory.service.observability-query",
        contract: "inventory.service.observability-query",
        description: "Slice 8 inventory observability query surface.",
        value: services.observabilityQueryService,
      },
      {
        serviceId: "inventory.service.reference-validation",
        contract: "inventory.service.reference-validation",
        description: "Slice 7 external reference validation service.",
        value: services.slice6.slice5.slice4.foundation.referenceValidationService,
      },
      {
        serviceId: "inventory.service.reference-validator-registry",
        contract: "inventory.service.reference-validator-registry",
        description: "Slice 3 bounded reference validator registry.",
        value: options.validatorRegistry,
      },
      {
        serviceId: "inventory.service.reservation",
        contract: "inventory.service.reservation",
        description: "Slice 5 reservation command service.",
        value: services.slice6.slice5.reservationService,
      },
      {
        serviceId: "inventory.service.reservation-query",
        contract: "inventory.service.reservation-query",
        description: "Slice 5 reservation query surface.",
        value: services.slice6.slice5.reservationQueryService,
      },
      {
        serviceId: "inventory.service.serial-number",
        contract: "inventory.service.serial-number",
        description: "Slice 6 serial number command service.",
        value: services.slice6.serialNumberService,
      },
      {
        serviceId: "inventory.service.serial-query",
        contract: "inventory.service.serial-query",
        description: "Slice 6 serial query surface.",
        value: services.slice6.serialQueryService,
      },
      {
        serviceId: "inventory.service.storage-location",
        contract: "inventory.service.storage-location",
        description: "Slice 3 storage location foundation service.",
        value: services.slice6.slice5.slice4.foundation.storageLocationService,
      },
      {
        serviceId: "inventory.service.warehouse",
        contract: "inventory.service.warehouse",
        description: "Slice 3 warehouse foundation service.",
        value: services.slice6.slice5.slice4.foundation.warehouseService,
      },
    ];

    for (const registration of registrations.sort((left, right) => compareDeterministicStrings(left.serviceId, right.serviceId))) {
      context.host.registerService(registration);
    }
  };
}
