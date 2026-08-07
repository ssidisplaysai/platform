import { compareDeterministicStrings } from "../../shared";
import type {
  AllocationContract,
  BinContract,
  ExpirationRecordContract,
  InventoryBalanceContract,
  InventoryItemContract,
  LedgerEntryContract,
  LotContract,
  MovementContract,
  ReservationContract,
  SerialNumberContract,
  StorageLocationContract,
  TenantId,
  WarehouseContract,
} from "../contracts";
import type { InventoryRuntimeAuditRecord, InventoryRuntimeDependencies, InventoryReferenceValidatorRegistry } from "../integration";
import type { InventorySlice8Services } from "../services/observability";
import { InventoryFileStore } from "./InventoryFileStore";
import { createInventoryPersistenceSchemaValidator } from "./schema";
import { InventoryRecoveryCoordinator } from "./InventoryRecoveryCoordinator";
import type {
  InventoryAuditSummary,
  InventoryPersistenceEnvelope,
  InventoryPersistenceMetrics,
  InventoryPersistenceTenantPartition,
} from "./types";
import { INVENTORY_PERSISTENCE_SCHEMA_VERSION } from "./types";

function key(parts: readonly (string | undefined)[]): string {
  return parts.map((part) => part ?? "").join("|");
}

function asState<TState>(service: unknown): TState {
  return (service as { state: TState }).state;
}

function replaceMap<TKey, TValue>(target: Map<TKey, TValue>, source: Map<TKey, TValue>): void {
  target.clear();
  for (const [entryKey, entryValue] of source.entries()) {
    target.set(entryKey, structuredClone(entryValue));
  }
}

function setMapFromArray<TKey, TValue>(
  target: Map<TKey, TValue>,
  values: readonly TValue[],
  toKey: (value: TValue) => TKey,
): void {
  target.clear();
  for (const value of values) {
    target.set(toKey(value), structuredClone(value));
  }
}

function compareById(left: { tenantId: string; id: string }, right: { tenantId: string; id: string }): number {
  return compareDeterministicStrings(`${left.tenantId}|${left.id}`, `${right.tenantId}|${right.id}`);
}

function auditSummary(events: readonly InventoryRuntimeAuditRecord[]): InventoryAuditSummary {
  const byCategory: InventoryAuditSummary["byCategory"] = {
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
    const normalized = event.eventType.toLowerCase();
    if (normalized.includes("inventory.item")) byCategory.ITEM += 1;
    else if (normalized.includes("inventory.warehouse")) byCategory.WAREHOUSE += 1;
    else if (normalized.includes("inventory.location")) byCategory.LOCATION += 1;
    else if (normalized.includes("inventory.bin")) byCategory.BIN += 1;
    else if (normalized.includes("inventory.balance")) byCategory.BALANCE += 1;
    else if (normalized.includes("inventory.movement")) byCategory.MOVEMENT += 1;
    else if (normalized.includes("inventory.adjustment")) byCategory.ADJUSTMENT += 1;
    else if (normalized.includes("inventory.ledger")) byCategory.LEDGER += 1;
    else if (normalized.includes("inventory.reservation")) byCategory.RESERVATION += 1;
    else if (normalized.includes("inventory.allocation")) byCategory.ALLOCATION += 1;
    else if (normalized.includes("inventory.lot")) byCategory.LOT += 1;
    else if (normalized.includes("inventory.serial")) byCategory.SERIAL += 1;
    else if (normalized.includes("inventory.expiration")) byCategory.EXPIRATION += 1;
    else if (normalized.includes("inventory.reference")) byCategory.REFERENCE += 1;
    else if (normalized.includes("observation")) byCategory.OBSERVATION += 1;
    else byCategory.RUNTIME += 1;

    if (event.details?.success === true) {
      acceptedEvents += 1;
    } else if (event.details?.success === false || normalized.includes("rejected")) {
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

function validatePartition(partition: InventoryPersistenceTenantPartition): void {
  const tenantId = partition.tenantId;
  const inventoryItemIds = new Set<string>();
  const productMappings = new Set<string>();
  for (const item of partition.foundation.inventoryItems) {
    if (item.tenantId !== tenantId) throw new Error(`cross-tenant inventory item: ${item.inventoryItemId}`);
    const keyValue = item.inventoryItemId;
    if (inventoryItemIds.has(keyValue)) throw new Error(`duplicate inventory item: ${keyValue}`);
    inventoryItemIds.add(keyValue);
    const mappingKey = key([item.tenantId, item.productReferenceId, item.productVariantReferenceId]);
    if (productMappings.has(mappingKey)) throw new Error(`duplicate inventory item product mapping: ${mappingKey}`);
    productMappings.add(mappingKey);
    if (!item.lifecycleState) throw new Error(`invalid lifecycle for inventory item: ${item.inventoryItemId}`);
  }

  const warehouseIds = new Set<string>();
  const warehouseCodes = new Set<string>();
  for (const warehouse of partition.foundation.warehouses) {
    if (warehouse.tenantId !== tenantId) throw new Error(`cross-tenant warehouse: ${warehouse.warehouseId}`);
    if (warehouseIds.has(warehouse.warehouseId)) throw new Error(`duplicate warehouse: ${warehouse.warehouseId}`);
    warehouseIds.add(warehouse.warehouseId);
    const codeKey = key([warehouse.tenantId, warehouse.warehouseCode]);
    if (warehouseCodes.has(codeKey)) throw new Error(`duplicate warehouse code: ${warehouse.warehouseCode}`);
    warehouseCodes.add(codeKey);
  }

  const storageLocationIds = new Set<string>();
  const storageLocationCodes = new Set<string>();
  for (const location of partition.foundation.storageLocations) {
    if (location.tenantId !== tenantId) throw new Error(`cross-tenant location: ${location.storageLocationId}`);
    if (!warehouseIds.has(location.warehouseId)) throw new Error(`broken warehouse/location relationship: ${location.storageLocationId}`);
    if (storageLocationIds.has(location.storageLocationId)) throw new Error(`duplicate storage location: ${location.storageLocationId}`);
    storageLocationIds.add(location.storageLocationId);
    const codeKey = key([location.tenantId, location.warehouseId, location.locationCode]);
    if (storageLocationCodes.has(codeKey)) throw new Error(`duplicate storage location code: ${location.locationCode}`);
    storageLocationCodes.add(codeKey);
  }

  const binIds = new Set<string>();
  const binCodes = new Set<string>();
  for (const bin of partition.foundation.bins) {
    if (bin.tenantId !== tenantId) throw new Error(`cross-tenant bin: ${bin.binId}`);
    if (!storageLocationIds.has(bin.storageLocationId)) throw new Error(`broken bin containment: ${bin.binId}`);
    if (binIds.has(bin.binId)) throw new Error(`duplicate bin: ${bin.binId}`);
    binIds.add(bin.binId);
    const codeKey = key([bin.tenantId, bin.storageLocationId, bin.binCode]);
    if (binCodes.has(codeKey)) throw new Error(`duplicate bin code: ${bin.binCode}`);
    binCodes.add(codeKey);
  }

  const balanceIds = new Set<string>();
  const balanceDimensions = new Set<string>();
  for (const balance of partition.foundation.balances) {
    if (balance.tenantId !== tenantId) throw new Error(`cross-tenant balance: ${balance.inventoryBalanceId}`);
    if (!inventoryItemIds.has(balance.inventoryItemId)) throw new Error(`invalid balance inventory item: ${balance.inventoryBalanceId}`);
    if (!warehouseIds.has(balance.warehouseId)) throw new Error(`invalid balance warehouse: ${balance.inventoryBalanceId}`);
    if (balance.storageLocationId && !storageLocationIds.has(balance.storageLocationId)) throw new Error(`invalid balance location: ${balance.inventoryBalanceId}`);
    if (balance.binId && !binIds.has(balance.binId)) throw new Error(`invalid balance bin: ${balance.inventoryBalanceId}`);
    if (balance.onHandQuantity < 0 || balance.reservedQuantity < 0 || balance.allocatedQuantity < 0 || balance.nonAllocatableHoldQuantity < 0) {
      throw new Error(`invalid balance quantity: ${balance.inventoryBalanceId}`);
    }
    if (balance.availableQuantity !== balance.onHandQuantity - balance.reservedQuantity - balance.allocatedQuantity - balance.nonAllocatableHoldQuantity) {
      throw new Error(`balance quantity invariant failure: ${balance.inventoryBalanceId}`);
    }
    if (balanceIds.has(balance.inventoryBalanceId)) throw new Error(`duplicate balance: ${balance.inventoryBalanceId}`);
    balanceIds.add(balance.inventoryBalanceId);
    const dimensionalKey = balance.dimensionalKey;
    if (balanceDimensions.has(dimensionalKey)) throw new Error(`duplicate balance dimensional key: ${dimensionalKey}`);
    balanceDimensions.add(dimensionalKey);
  }

  const movementIds = new Set<string>();
  const ledgerEntryIds = new Set<string>();
  for (const movement of partition.movement.movements) {
    if (movement.tenantId !== tenantId) throw new Error(`cross-tenant movement: ${movement.movementId}`);
    if (!inventoryItemIds.has(movement.inventoryItemId)) throw new Error(`invalid movement inventory item: ${movement.movementId}`);
    if (movementIds.has(movement.movementId)) throw new Error(`duplicate movement: ${movement.movementId}`);
    movementIds.add(movement.movementId);
  }
  for (const ledgerEntry of partition.movement.ledgerEntries) {
    if (ledgerEntry.tenantId !== tenantId) throw new Error(`cross-tenant ledger entry: ${ledgerEntry.ledgerEntryId}`);
    if (!movementIds.has(ledgerEntry.movementId)) throw new Error(`inconsistent movement/ledger relationship: ${ledgerEntry.ledgerEntryId}`);
    if (!balanceIds.has(ledgerEntry.affectedBalanceId)) throw new Error(`inconsistent movement/ledger balance relationship: ${ledgerEntry.ledgerEntryId}`);
    if (ledgerEntryIds.has(ledgerEntry.ledgerEntryId)) throw new Error(`duplicate ledger: ${ledgerEntry.ledgerEntryId}`);
    ledgerEntryIds.add(ledgerEntry.ledgerEntryId);
  }
  for (const [movementKey, ledgerIds] of Object.entries(partition.movement.movementLedgerIds)) {
    const movementId = movementKey.split("|")[1];
    if (!movementIds.has(movementId)) throw new Error(`missing movement for ledger mapping: ${movementKey}`);
    for (const ledgerId of ledgerIds) {
      if (!ledgerEntryIds.has(ledgerId)) throw new Error(`missing ledger for mapping: ${ledgerId}`);
    }
  }

  const reservationIds = new Set<string>();
  for (const reservation of partition.slice5.reservations) {
    if (reservation.tenantId !== tenantId) throw new Error(`cross-tenant reservation: ${reservation.reservationId}`);
    if (!balanceIds.has(reservation.inventoryBalanceId)) throw new Error(`invalid reservation balance: ${reservation.reservationId}`);
    if (reservationIds.has(reservation.reservationId)) throw new Error(`duplicate reservation: ${reservation.reservationId}`);
    reservationIds.add(reservation.reservationId);
    if (reservation.remainingQuantity < 0) throw new Error(`invalid reservation quantity: ${reservation.reservationId}`);
  }

  const allocationIds = new Set<string>();
  for (const allocation of partition.slice5.allocations) {
    if (allocation.tenantId !== tenantId) throw new Error(`cross-tenant allocation: ${allocation.allocationId}`);
    if (!balanceIds.has(allocation.inventoryBalanceId)) throw new Error(`invalid allocation balance: ${allocation.allocationId}`);
    if (allocation.reservationId && !reservationIds.has(allocation.reservationId)) throw new Error(`invalid allocation reservation: ${allocation.allocationId}`);
    if (allocationIds.has(allocation.allocationId)) throw new Error(`duplicate allocation: ${allocation.allocationId}`);
    allocationIds.add(allocation.allocationId);
    if (allocation.remainingQuantity < 0) throw new Error(`invalid allocation quantity: ${allocation.allocationId}`);
  }

  const lotIds = new Set<string>();
  const lotCodes = new Set<string>();
  for (const lot of partition.slice6.lots) {
    if (lot.tenantId !== tenantId) throw new Error(`cross-tenant lot: ${lot.lotId}`);
    if (!inventoryItemIds.has(lot.inventoryItemId)) throw new Error(`invalid lot inventory item: ${lot.lotId}`);
    if (lotIds.has(lot.lotId)) throw new Error(`duplicate lot: ${lot.lotId}`);
    lotIds.add(lot.lotId);
    const codeKey = key([lot.tenantId, lot.lotCode]);
    if (lotCodes.has(codeKey)) throw new Error(`duplicate lot code: ${lot.lotCode}`);
    lotCodes.add(codeKey);
  }

  const serialIds = new Set<string>();
  const serialCodes = new Set<string>();
  for (const serial of partition.slice6.serials) {
    if (serial.tenantId !== tenantId) throw new Error(`cross-tenant serial: ${serial.serialNumberId}`);
    if (!inventoryItemIds.has(serial.inventoryItemId)) throw new Error(`invalid serial inventory item: ${serial.serialNumberId}`);
    if (serial.lotId && !lotIds.has(serial.lotId)) throw new Error(`invalid lot serial association: ${serial.serialNumberId}`);
    if (serialIds.has(serial.serialNumberId)) throw new Error(`duplicate serial: ${serial.serialNumberId}`);
    serialIds.add(serial.serialNumberId);
    const codeKey = key([serial.tenantId, serial.serialCode]);
    if (serialCodes.has(codeKey)) throw new Error(`duplicate serial code: ${serial.serialCode}`);
    serialCodes.add(codeKey);
  }

  for (const expiration of partition.slice6.expirations) {
    if (expiration.tenantId !== tenantId) throw new Error(`cross-tenant expiration: ${expiration.expirationRecordId}`);
    if (expiration.lotId && !lotIds.has(expiration.lotId)) throw new Error(`invalid expiration lot: ${expiration.expirationRecordId}`);
    if (expiration.serialNumberId && !serialIds.has(expiration.serialNumberId)) throw new Error(`invalid expiration serial: ${expiration.expirationRecordId}`);
    if (expiration.expirationDate && Number.isNaN(Date.parse(expiration.expirationDate))) throw new Error(`invalid expiration state: ${expiration.expirationRecordId}`);
  }

  const idempotencyKeys = new Set<string>();
  for (const record of partition.movement.idempotency) {
    const scopedKey = key([record.tenantId, record.idempotencyKey]);
    if (idempotencyKeys.has(scopedKey)) throw new Error(`conflicting idempotency state: ${scopedKey}`);
    idempotencyKeys.add(scopedKey);
  }
  for (const record of partition.slice5.idempotency) {
    const scopedKey = key([record.tenantId, record.idempotencyKey]);
    if (idempotencyKeys.has(scopedKey)) throw new Error(`conflicting idempotency state: ${scopedKey}`);
    idempotencyKeys.add(scopedKey);
  }
  for (const record of partition.slice6.idempotency) {
    const scopedKey = key([record.tenantId, record.idempotencyKey]);
    if (idempotencyKeys.has(scopedKey)) throw new Error(`conflicting idempotency state: ${scopedKey}`);
    idempotencyKeys.add(scopedKey);
  }
}

function captureTenantPartition(services: InventorySlice8Services, tenantId: TenantId): InventoryPersistenceTenantPartition {
  const foundationState = asState<{
    inventoryItems: Map<string, InventoryItemContract>;
    warehouses: Map<string, WarehouseContract>;
    storageLocations: Map<string, StorageLocationContract>;
    bins: Map<string, BinContract>;
    balances: Map<string, InventoryBalanceContract>;
  }>(services.slice6.slice5.slice4.foundation.inventoryItemService);

  const movementState = asState<{
    movements: Map<string, MovementContract>;
    movementLedgerIds: Map<string, readonly string[]>;
    ledgerEntries: Map<string, LedgerEntryContract>;
    idempotency: Map<string, { tenantId: TenantId; idempotencyKey: string; fingerprint: string; movementId: string; recordedAt: string }>;
    sequence: number;
  }>(services.slice6.slice5.slice4.movementService);

  const slice5State = asState<{
    reservations: Map<string, ReservationContract>;
    allocations: Map<string, AllocationContract>;
    idempotency: Map<string, { tenantId: TenantId; idempotencyKey: string; fingerprint: string; replayType: "reservation" | "allocation"; replayId: string; recordedAt: string }>;
  }>(services.slice6.slice5.reservationService);

  const slice6State = asState<{
    lots: Map<string, LotContract>;
    serials: Map<string, SerialNumberContract>;
    expirations: Map<string, ExpirationRecordContract>;
    idempotency: Map<string, { tenantId: TenantId; idempotencyKey: string; fingerprint: string; replayType: "lot" | "serial" | "expiration"; replayId: string; recordedAt: string }>;
  }>(services.slice6.lotService);

  const auditEvents = services.observabilityQueryService.listInventoryAuditEvents(tenantId).map((event) => event.record);

  return {
    tenantId,
    foundation: {
      inventoryItems: [...foundationState.inventoryItems.values()].filter((value) => value.tenantId === tenantId),
      warehouses: [...foundationState.warehouses.values()].filter((value) => value.tenantId === tenantId),
      storageLocations: [...foundationState.storageLocations.values()].filter((value) => value.tenantId === tenantId),
      bins: [...foundationState.bins.values()].filter((value) => value.tenantId === tenantId),
      balances: [...foundationState.balances.values()].filter((value) => value.tenantId === tenantId),
    },
    movement: {
      movements: [...movementState.movements.values()].filter((value) => value.tenantId === tenantId),
      ledgerEntries: [...movementState.ledgerEntries.values()].filter((value) => value.tenantId === tenantId),
      movementLedgerIds: Object.fromEntries(
        [...movementState.movementLedgerIds.entries()].filter(([entryKey]) => entryKey.startsWith(`${tenantId}|`)),
      ),
      idempotency: [...movementState.idempotency.values()].filter((value) => value.tenantId === tenantId),
      sequence: movementState.sequence,
    },
    slice5: {
      reservations: [...slice5State.reservations.values()].filter((value) => value.tenantId === tenantId),
      allocations: [...slice5State.allocations.values()].filter((value) => value.tenantId === tenantId),
      idempotency: [...slice5State.idempotency.values()].filter((value) => value.tenantId === tenantId),
    },
    slice6: {
      lots: [...slice6State.lots.values()].filter((value) => value.tenantId === tenantId),
      serials: [...slice6State.serials.values()].filter((value) => value.tenantId === tenantId),
      expirations: [...slice6State.expirations.values()].filter((value) => value.tenantId === tenantId),
      idempotency: [...slice6State.idempotency.values()].filter((value) => value.tenantId === tenantId),
    },
    auditEvents,
  };
}

function restoreTenantPartition(services: InventorySlice8Services, partition: InventoryPersistenceTenantPartition): void {
  const foundationState = asState<{
    inventoryItems: Map<string, InventoryItemContract>;
    warehouses: Map<string, WarehouseContract>;
    storageLocations: Map<string, StorageLocationContract>;
    bins: Map<string, BinContract>;
    balances: Map<string, InventoryBalanceContract>;
  }>(services.slice6.slice5.slice4.foundation.inventoryItemService);

  setMapFromArray(foundationState.inventoryItems, partition.foundation.inventoryItems, (value) => key([value.tenantId, value.inventoryItemId]));
  setMapFromArray(foundationState.warehouses, partition.foundation.warehouses, (value) => key([value.tenantId, value.warehouseId]));
  setMapFromArray(foundationState.storageLocations, partition.foundation.storageLocations, (value) => key([value.tenantId, value.storageLocationId]));
  setMapFromArray(foundationState.bins, partition.foundation.bins, (value) => key([value.tenantId, value.binId]));
  setMapFromArray(foundationState.balances, partition.foundation.balances, (value) => key([value.tenantId, value.inventoryBalanceId]));

  const movementState = asState<{
    movements: Map<string, MovementContract>;
    movementLedgerIds: Map<string, readonly string[]>;
    ledgerEntries: Map<string, LedgerEntryContract>;
    idempotency: Map<string, { tenantId: TenantId; idempotencyKey: string; fingerprint: string; movementId: string; recordedAt: string }>;
    sequence: number;
  }>(services.slice6.slice5.slice4.movementService);
  setMapFromArray(movementState.movements, partition.movement.movements, (value) => key([value.tenantId, value.movementId]));
  setMapFromArray(movementState.ledgerEntries, partition.movement.ledgerEntries, (value) => key([value.tenantId, value.ledgerEntryId]));
  movementState.movementLedgerIds.clear();
  for (const [entryKey, ledgerIds] of Object.entries(partition.movement.movementLedgerIds)) {
    movementState.movementLedgerIds.set(entryKey, [...ledgerIds]);
  }
  setMapFromArray(movementState.idempotency, partition.movement.idempotency, (value) => key([value.tenantId, value.idempotencyKey]));
  movementState.sequence = partition.movement.sequence;

  const slice5State = asState<{
    reservations: Map<string, ReservationContract>;
    allocations: Map<string, AllocationContract>;
    idempotency: Map<string, { tenantId: TenantId; idempotencyKey: string; fingerprint: string; replayType: "reservation" | "allocation"; replayId: string; recordedAt: string }>;
  }>(services.slice6.slice5.reservationService);
  setMapFromArray(slice5State.reservations, partition.slice5.reservations, (value) => key([value.tenantId, value.reservationId]));
  setMapFromArray(slice5State.allocations, partition.slice5.allocations, (value) => key([value.tenantId, value.allocationId]));
  setMapFromArray(slice5State.idempotency, partition.slice5.idempotency, (value) => key([value.tenantId, value.idempotencyKey]));

  const slice6State = asState<{
    lots: Map<string, LotContract>;
    serials: Map<string, SerialNumberContract>;
    expirations: Map<string, ExpirationRecordContract>;
    idempotency: Map<string, { tenantId: TenantId; idempotencyKey: string; fingerprint: string; replayType: "lot" | "serial" | "expiration"; replayId: string; recordedAt: string }>;
  }>(services.slice6.lotService);
  setMapFromArray(slice6State.lots, partition.slice6.lots, (value) => key([value.tenantId, value.lotId]));
  setMapFromArray(slice6State.serials, partition.slice6.serials, (value) => key([value.tenantId, value.serialNumberId]));
  setMapFromArray(slice6State.expirations, partition.slice6.expirations, (value) => key([value.tenantId, value.expirationRecordId]));
  setMapFromArray(slice6State.idempotency, partition.slice6.idempotency, (value) => key([value.tenantId, value.idempotencyKey]));

  const auditService = services.auditService as unknown as {
    events: Map<string, { auditEventId: string; category: string; action: string; rejectionClassification?: string; tenantId?: TenantId; correlationId?: string; entityType?: string; entityId?: string; record: InventoryRuntimeAuditRecord }>;
    tenantIds: Set<TenantId>;
    sequence: number;
  };
  auditService.events.clear();
  auditService.tenantIds.clear();
  const restoredAuditEvents = [...partition.auditEvents].sort((left, right) => compareDeterministicStrings(left.recordedAt, right.recordedAt));
  restoredAuditEvents.forEach((record, index) => {
    const auditEventId = `${record.recordedAt}:${String(index + 1).padStart(9, "0")}`;
    const tenantId = typeof record.details?.tenantId === "string" ? (record.details.tenantId as TenantId) : undefined;
    if (tenantId) {
      auditService.tenantIds.add(tenantId);
    }
    auditService.events.set(auditEventId, {
      auditEventId,
      category: record.eventType.toLowerCase().includes("reference") ? "REFERENCE" : "RUNTIME",
      action: typeof record.details?.action === "string" ? record.details.action : "UNKNOWN_ACTION",
      rejectionClassification: typeof record.details?.rejectionClassification === "string" ? record.details.rejectionClassification : undefined,
      tenantId,
      correlationId: typeof record.details?.correlationId === "string" ? record.details.correlationId : undefined,
      entityType: typeof record.details?.entityType === "string" ? record.details.entityType : undefined,
      entityId: typeof record.details?.entityId === "string" ? record.details.entityId : undefined,
      record: structuredClone(record),
    });
  });
  auditService.sequence = restoredAuditEvents.length;
}

export class InventoryPersistenceCoordinator {
  private readonly fileStore: InventoryFileStore;
  private readonly schemaValidator = createInventoryPersistenceSchemaValidator();
  private readonly recoveryCoordinator: InventoryRecoveryCoordinator;
  private persistQueue: Promise<void> = Promise.resolve();
  private statusMessage = "uninitialized";
  private metrics: InventoryPersistenceMetrics = {
    persistenceLoadCount: 0,
    persistenceWriteCount: 0,
    persistenceWriteFailureCount: 0,
    recoveryCount: 0,
    recoveryFailureCount: 0,
    corruptStateCount: 0,
    unsupportedSchemaCount: 0,
    projectionRebuildCount: 0,
    temporaryArtifactRecoveryCount: 0,
  };
  private envelope: InventoryPersistenceEnvelope;

  constructor(
    private readonly options: Readonly<{
      rootDir: string;
      runtimeId: string;
      dependencies: InventoryRuntimeDependencies;
      validatorRegistry: InventoryReferenceValidatorRegistry;
    }>,
  ) {
    this.fileStore = new InventoryFileStore({ rootDir: options.rootDir, runtimeId: options.runtimeId });
    this.recoveryCoordinator = new InventoryRecoveryCoordinator({ runtimeId: options.runtimeId });
    this.envelope = this.recoveryCoordinator.createEmptyEnvelope();
  }

  getMetrics(): InventoryPersistenceMetrics {
    return { ...this.metrics };
  }

  getStatus() {
    return this.recoveryCoordinator.getStatus();
  }

  async loadAndRecover(): Promise<InventoryPersistenceEnvelope> {
    this.metrics = { ...this.metrics, persistenceLoadCount: this.metrics.persistenceLoadCount + 1 };
    try {
      const manifest = await this.fileStore.loadManifest();
      const schemaVersion = manifest.manifest.schemaVersion ?? INVENTORY_PERSISTENCE_SCHEMA_VERSION;
      if (schemaVersion !== INVENTORY_PERSISTENCE_SCHEMA_VERSION) {
        this.metrics = { ...this.metrics, unsupportedSchemaCount: this.metrics.unsupportedSchemaCount + 1 };
        this.recoveryCoordinator.markCorrupt(`unsupported schema: ${schemaVersion}`);
        throw new Error(`unsupported inventory persistence schema version: ${schemaVersion}`);
      }

      const tenantPartitions = await this.fileStore.loadAllPartitions(manifest.manifest.tenantIds);
      const envelope = this.recoveryCoordinator.normalizeEnvelope({
        manifest: {
          ...manifest.manifest,
          schemaVersion,
        },
        tenants: tenantPartitions,
      });
      this.schemaValidator.validateOrThrow(envelope);
      envelope.tenants.forEach(validatePartition);
      this.envelope = envelope;
      this.metrics = { ...this.metrics, recoveryCount: this.metrics.recoveryCount + 1 };
      const firstRun = envelope.tenants.length === 0 && envelope.manifest.lastLoadedAt === undefined && envelope.manifest.lastDurableWriteAt === undefined;
      this.recoveryCoordinator.markLoaded(firstRun ? "FIRST_RUN" : "LOADED");
      this.recoveryCoordinator.markRecovery(true);
      this.recoveryCoordinator.markProjectionRebuild(true);
      this.recoveryCoordinator.markCleanup(true);
      return cloneEnvelope(envelope);
    } catch (error) {
      const message = error instanceof Error ? error.message : "inventory persistence recovery failed";
      this.metrics = {
        ...this.metrics,
        recoveryFailureCount: this.metrics.recoveryFailureCount + 1,
        corruptStateCount: this.metrics.corruptStateCount + 1,
      };
      if (message.includes("unsupported inventory persistence schema version")) {
        this.recoveryCoordinator.markCorrupt(message);
        throw error;
      }
      this.recoveryCoordinator.markCorrupt(message);
      throw error;
    }
  }

  restore(services: InventorySlice8Services, envelope: InventoryPersistenceEnvelope): void {
    const orderedTenants = [...envelope.tenants].sort((left, right) => compareDeterministicStrings(left.tenantId, right.tenantId));
    for (const partition of orderedTenants) {
      validatePartition(partition);
      restoreTenantPartition(services, partition);
    }
    this.envelope = this.recoveryCoordinator.normalizeEnvelope(envelope);
    this.recoveryCoordinator.markProjectionRebuild(true);
  }

  snapshot(services: InventorySlice8Services): InventoryPersistenceEnvelope {
    const tenantIds = services.auditService.getKnownTenantIds().sort(compareDeterministicStrings);
    const partitions = tenantIds.map((tenantId) => captureTenantPartition(services, tenantId));
    return this.recoveryCoordinator.normalizeEnvelope({
      manifest: {
        schemaVersion: INVENTORY_PERSISTENCE_SCHEMA_VERSION,
        runtimeId: this.options.runtimeId,
        tenantIds,
        lastLoadedAt: this.envelope.manifest.lastLoadedAt,
        lastDurableWriteAt: this.envelope.manifest.lastDurableWriteAt,
        lastRecoveryAt: this.envelope.manifest.lastRecoveryAt,
        lastRecoveryReason: this.envelope.manifest.lastRecoveryReason,
      },
      tenants: partitions,
    });
  }

  async persist(services: InventorySlice8Services): Promise<void> {
    const work = this.persistQueue.then(async () => {
      try {
        const snapshot = this.snapshot(services);
        await this.fileStore.saveAll(snapshot);
        this.envelope = snapshot;
        this.metrics = { ...this.metrics, persistenceWriteCount: this.metrics.persistenceWriteCount + 1 };
        this.recoveryCoordinator.markDurableWrite(true);
      } catch (error) {
        this.metrics = { ...this.metrics, persistenceWriteFailureCount: this.metrics.persistenceWriteFailureCount + 1 };
        this.recoveryCoordinator.markDurableWrite(false);
        throw error;
      }
    });
    this.persistQueue = work.then(() => undefined, () => undefined);
    await work;
  }
}

function cloneEnvelope(envelope: InventoryPersistenceEnvelope): InventoryPersistenceEnvelope {
  return structuredClone(envelope);
}
