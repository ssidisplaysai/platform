import { compareDeterministicStrings } from "../../shared";
import type {
  AuditMetadata,
  CommandMetadata,
  ExpectedVersion,
  ExpirationRecordContract,
  ExpirationRecordId,
  ExpirationState,
  InventoryBalanceContract,
  InventoryBalanceId,
  InventoryFailureClassification,
  InventoryItemId,
  LotContract,
  LotId,
  LotQuantityTrackingMode,
  LotStatus,
  MovementId,
  ProductReferenceId,
  ProductVariantReferenceId,
  SerialNumberContract,
  SerialNumberId,
  SerialStatus,
  StorageLocationId,
  TenantId,
  WarehouseId,
} from "../contracts";
import {
  InventoryDomainError,
  assertValidTransition,
  lotStatusTransitions,
  serialStatusTransitions,
  sortInventoryRecords,
} from "../domain";
import { createExpectedVersion, createVersionIdentifier } from "../domain";
import type { InventoryRuntimeDependencies } from "../integration";
import type { InventoryRuntimeContext, InventoryRuntimeServiceRegistration, InventoryServiceRegistrationHook } from "../runtime";
import { createInventorySlice5Services, type InventorySlice5Services } from "./reservation-allocation";
import {
  InventoryExpirationQueryService,
  InventoryLotQueryService,
  InventorySerialQueryService,
} from "../queries";
import type { InventoryReferenceValidatorRegistry } from "../integration";

export type LotRegistrationInput = Readonly<{
  lotId: LotId;
  tenantId: TenantId;
  inventoryItemId: InventoryItemId;
  lotCode: string;
  quantityTrackingMode?: LotQuantityTrackingMode;
  trackedQuantity?: number;
  warehouseId?: WarehouseId;
  storageLocationId?: StorageLocationId;
  inventoryBalanceId?: InventoryBalanceId;
  manufactureDate?: string;
  bestBeforeDate?: string;
  expirationDate?: string;
  status?: LotStatus;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type LotMutationInput = Readonly<{
  lotId: LotId;
  tenantId: TenantId;
  expectedVersion: ExpectedVersion;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type LotMetadataUpdateInput = LotMutationInput &
  Readonly<{
    manufactureDate?: string;
    bestBeforeDate?: string;
    expirationDate?: string;
    trackedQuantity?: number;
  }>;

export type SerialRegistrationInput = Readonly<{
  serialNumberId: SerialNumberId;
  tenantId: TenantId;
  inventoryItemId: InventoryItemId;
  serialCode: string;
  status?: SerialStatus;
  inventoryBalanceId?: InventoryBalanceId;
  storageLocationId?: StorageLocationId;
  lotId?: LotId;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type SerialMutationInput = Readonly<{
  serialNumberId: SerialNumberId;
  tenantId: TenantId;
  expectedVersion: ExpectedVersion;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type SerialBindingInput = SerialMutationInput &
  Readonly<{
    inventoryBalanceId?: InventoryBalanceId;
    storageLocationId?: StorageLocationId;
    movementReferenceId?: MovementId;
    lotId?: LotId;
  }>;

export type ExpirationEvaluationInput = Readonly<{
  expirationRecordId: ExpirationRecordId;
  tenantId: TenantId;
  inventoryItemId: InventoryItemId;
  lotId?: LotId;
  serialNumberId?: SerialNumberId;
  manufactureDate?: string;
  bestBeforeDate?: string;
  expirationDate?: string;
  expectedVersion?: ExpectedVersion;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

type Slice6IdempotencyRecord = Readonly<{
  tenantId: TenantId;
  idempotencyKey: CommandMetadata["idempotencyKey"];
  fingerprint: string;
  replayType: "lot" | "serial" | "expiration";
  replayId: string;
}>;

type Slice6State = {
  readonly lots: Map<string, LotContract>;
  readonly serials: Map<string, SerialNumberContract>;
  readonly expirations: Map<string, ExpirationRecordContract>;
  readonly idempotency: Map<string, Slice6IdempotencyRecord>;
};

function createSlice6State(): Slice6State {
  return {
    lots: new Map(),
    serials: new Map(),
    expirations: new Map(),
    idempotency: new Map(),
  };
}

function lotKey(tenantId: TenantId, lotId: LotId): string {
  return `${tenantId}|${lotId}`;
}

function serialKey(tenantId: TenantId, serialNumberId: SerialNumberId): string {
  return `${tenantId}|${serialNumberId}`;
}

function expirationKey(tenantId: TenantId, expirationRecordId: ExpirationRecordId): string {
  return `${tenantId}|${expirationRecordId}`;
}

function idempotencyKey(tenantId: TenantId, key: CommandMetadata["idempotencyKey"]): string {
  return `${tenantId}|${key}`;
}

function nextVersion(version: number): number {
  return version + 1;
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new InventoryDomainError("INVALID_QUANTITY", "quantity must be a finite non-negative number", false);
  }
}

function assertVersionMatches(currentVersion: number, expectedVersion: ExpectedVersion, classification: InventoryFailureClassification): void {
  if (currentVersion !== expectedVersion) {
    throw new InventoryDomainError(classification, `stale expected version: expected ${expectedVersion}, current ${currentVersion}`, false);
  }
}

function isSerialActive(status: SerialStatus): boolean {
  return status === "ACTIVE" || status === "RESERVED" || status === "ALLOCATED";
}

function parseDate(value: string | undefined, label: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) {
    throw new InventoryDomainError("INVALID_EXPIRATION_DATES", `${label} is not a valid ISO timestamp`, false);
  }
  return ts;
}

function assertDateOrdering(manufactureDate?: string, bestBeforeDate?: string, expirationDate?: string): void {
  const manufacture = parseDate(manufactureDate, "manufactureDate");
  const bestBefore = parseDate(bestBeforeDate, "bestBeforeDate");
  const expiration = parseDate(expirationDate, "expirationDate");

  if (manufacture !== undefined && bestBefore !== undefined && manufacture > bestBefore) {
    throw new InventoryDomainError("INVALID_EXPIRATION_DATES", "manufacture date cannot be after best-before date", false);
  }
  if (manufacture !== undefined && expiration !== undefined && manufacture > expiration) {
    throw new InventoryDomainError("INVALID_EXPIRATION_DATES", "manufacture date cannot be after expiration date", false);
  }
  if (bestBefore !== undefined && expiration !== undefined && bestBefore > expiration) {
    throw new InventoryDomainError("INVALID_EXPIRATION_DATES", "best-before date cannot be after expiration date", false);
  }
}

class Slice6AuditRecorder {
  constructor(private readonly dependencies: InventoryRuntimeDependencies) {}

  async record(eventType: string, message: string, commandMetadata: CommandMetadata, details: Record<string, unknown>): Promise<void> {
    await this.dependencies.auditSinkProvider.recordAudit({
      eventType,
      message,
      recordedAt: this.dependencies.clockProvider.now(),
      details: {
        ...details,
        commandId: commandMetadata.commandId,
        correlationId: commandMetadata.correlationId,
        causationId: commandMetadata.causationId,
        idempotencyKey: commandMetadata.idempotencyKey,
        expectedVersion: commandMetadata.expectedVersion,
      },
    });
  }
}

class Slice6Idempotency {
  constructor(private readonly state: Slice6State, private readonly audit: Slice6AuditRecorder) {}

  async resolveReplay(
    input: {
      tenantId: TenantId;
      idempotencyKey: CommandMetadata["idempotencyKey"];
      fingerprint: string;
      replayType: Slice6IdempotencyRecord["replayType"];
      commandMetadata: CommandMetadata;
    },
    resolver: (id: string) => LotContract | SerialNumberContract | ExpirationRecordContract | undefined,
  ): Promise<LotContract | SerialNumberContract | ExpirationRecordContract | undefined> {
    const existing = this.state.idempotency.get(idempotencyKey(input.tenantId, input.idempotencyKey));
    if (!existing) {
      return undefined;
    }
    if (existing.fingerprint !== input.fingerprint || existing.replayType !== input.replayType) {
      throw new InventoryDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
    }

    const replay = resolver(existing.replayId);
    if (!replay) {
      throw new InventoryDomainError("ATOMICITY_FAILURE", "idempotency replay target missing", false);
    }

    await this.audit.record("inventory.idempotency.replay", "slice 6 idempotent replay", input.commandMetadata, {
      action: "IDEMPOTENT_REPLAY",
      tenantId: input.tenantId,
      entityType: input.replayType,
      entityId: existing.replayId,
      resultClassification: "IDEMPOTENT_REPLAY",
      success: true,
    });

    return replay;
  }

  record(input: {
    tenantId: TenantId;
    idempotencyKeyValue: CommandMetadata["idempotencyKey"];
    fingerprint: string;
    replayType: Slice6IdempotencyRecord["replayType"];
    replayId: string;
  }): void {
    this.state.idempotency.set(idempotencyKey(input.tenantId, input.idempotencyKeyValue), {
      tenantId: input.tenantId,
      idempotencyKey: input.idempotencyKeyValue,
      fingerprint: input.fingerprint,
      replayType: input.replayType,
      replayId: input.replayId,
    });
  }
}

export class LotService {
  constructor(
    private readonly slice5: InventorySlice5Services,
    private readonly state: Slice6State,
    private readonly audit: Slice6AuditRecorder,
    private readonly idem: Slice6Idempotency,
    private readonly dependencies: InventoryRuntimeDependencies,
  ) {}

  async registerLot(input: LotRegistrationInput): Promise<LotContract> {
    const fingerprint = [
      "lot.register",
      input.lotId,
      input.tenantId,
      input.inventoryItemId,
      input.lotCode,
      input.quantityTrackingMode ?? "BALANCE_SCOPED",
      input.trackedQuantity ?? 0,
      input.warehouseId ?? "",
      input.storageLocationId ?? "",
      input.inventoryBalanceId ?? "",
      input.manufactureDate ?? "",
      input.bestBeforeDate ?? "",
      input.expirationDate ?? "",
      input.status ?? "ACTIVE",
    ].join("|");

    try {
      const replay = await this.idem.resolveReplay(
        {
          tenantId: input.tenantId,
          idempotencyKey: input.commandMetadata.idempotencyKey,
          fingerprint,
          replayType: "lot",
          commandMetadata: input.commandMetadata,
        },
        (id) => this.getLot(input.tenantId, id as LotId),
      );
      if (replay) {
        return replay as LotContract;
      }

      const entityKey = lotKey(input.tenantId, input.lotId);
      if (this.state.lots.has(entityKey)) {
        throw new InventoryDomainError("DUPLICATE_LOT_ID", "duplicate lot id", false);
      }

      const item = this.slice5.slice4.foundation.inventoryItemService.getInventoryItem(input.tenantId, input.inventoryItemId);
      if (!item) {
        throw new InventoryDomainError("INVALID_REFERENCE", "inventory item not found", false);
      }

      for (const existing of this.state.lots.values()) {
        if (existing.tenantId === input.tenantId && existing.inventoryItemId === input.inventoryItemId && existing.lotCode === input.lotCode) {
          throw new InventoryDomainError("DUPLICATE_LOT_CODE", "duplicate lot code within inventory item scope", false);
        }
      }

      assertDateOrdering(input.manufactureDate, input.bestBeforeDate, input.expirationDate);
      const trackedQuantity = input.trackedQuantity ?? 0;
      assertPositiveQuantity(trackedQuantity);

      let scopedBalance: InventoryBalanceContract | undefined;
      if (input.inventoryBalanceId) {
        scopedBalance = this.slice5.slice4.foundation.inventoryBalanceService.requireBalance(input.tenantId, input.inventoryBalanceId);
        if (scopedBalance.inventoryItemId !== input.inventoryItemId) {
          throw new InventoryDomainError("INVENTORY_ITEM_MISMATCH", "lot balance inventory item mismatch", false);
        }
        if (trackedQuantity > scopedBalance.onHandQuantity) {
          throw new InventoryDomainError("QUANTITY_INCONSISTENCY", "lot tracked quantity exceeds associated balance quantity", false);
        }
      }

      const now = this.dependencies.clockProvider.now();
      const lot: LotContract = {
        lotId: input.lotId,
        tenantId: input.tenantId,
        inventoryItemId: input.inventoryItemId,
        productReferenceId: item.productReferenceId as ProductReferenceId,
        productVariantReferenceId: item.productVariantReferenceId as ProductVariantReferenceId | undefined,
        lotCode: input.lotCode,
        status: input.status ?? "ACTIVE",
        manufactureDate: input.manufactureDate,
        bestBeforeDate: input.bestBeforeDate,
        expirationDate: input.expirationDate,
        quantityTrackingMode: input.quantityTrackingMode ?? "BALANCE_SCOPED",
        trackedQuantity,
        warehouseId: input.warehouseId ?? scopedBalance?.warehouseId,
        storageLocationId: input.storageLocationId ?? scopedBalance?.storageLocationId,
        inventoryBalanceId: input.inventoryBalanceId,
        version: 1,
        createdAt: now,
        commandMetadata: input.commandMetadata,
        auditMetadata: input.auditMetadata,
        publishedIdentifier: this.dependencies.identifierProvider.createIdentifier("lot") as LotContract["publishedIdentifier"],
        versionIdentifier: createVersionIdentifier("1.0.1"),
      };

      this.state.lots.set(entityKey, structuredClone(lot));
      this.idem.record({
        tenantId: input.tenantId,
        idempotencyKeyValue: input.commandMetadata.idempotencyKey,
        fingerprint,
        replayType: "lot",
        replayId: input.lotId,
      });

      await this.audit.record("inventory.lot.registered", "lot registered", input.commandMetadata, {
        action: "REGISTER_LOT",
        tenantId: input.tenantId,
        entityType: "Lot",
        entityId: input.lotId,
        inventoryItemId: input.inventoryItemId,
        lotCode: input.lotCode,
        resultClassification: "ACCEPTED",
        success: true,
      });
      return structuredClone(lot);
    } catch (error) {
      await this.audit.record("inventory.lot.rejected", "lot registration rejected", input.commandMetadata, {
        action: "REGISTER_LOT",
        tenantId: input.tenantId,
        entityType: "Lot",
        entityId: input.lotId,
        inventoryItemId: input.inventoryItemId,
        lotCode: input.lotCode,
        resultClassification: error instanceof InventoryDomainError ? error.classification : "INVALID_LOT_COMMAND",
        success: false,
      });
      throw error;
    }
  }

  async updateLotMetadata(input: LotMetadataUpdateInput): Promise<LotContract> {
    const current = this.requireLot(input.tenantId, input.lotId);
    assertVersionMatches(current.version, input.expectedVersion, "STALE_EXPECTED_VERSION");

    assertDateOrdering(input.manufactureDate ?? current.manufactureDate, input.bestBeforeDate ?? current.bestBeforeDate, input.expirationDate ?? current.expirationDate);

    const trackedQuantity = input.trackedQuantity ?? current.trackedQuantity;
    assertPositiveQuantity(trackedQuantity);
    if (current.inventoryBalanceId) {
      const balance = this.slice5.slice4.foundation.inventoryBalanceService.requireBalance(input.tenantId, current.inventoryBalanceId);
      if (trackedQuantity > balance.onHandQuantity) {
        throw new InventoryDomainError("QUANTITY_INCONSISTENCY", "lot tracked quantity exceeds associated balance quantity", false);
      }
    }

    const version = nextVersion(current.version);
    const updated: LotContract = {
      ...current,
      manufactureDate: input.manufactureDate ?? current.manufactureDate,
      bestBeforeDate: input.bestBeforeDate ?? current.bestBeforeDate,
      expirationDate: input.expirationDate ?? current.expirationDate,
      trackedQuantity,
      version,
      versionIdentifier: createVersionIdentifier(`1.0.${version}`),
      commandMetadata: input.commandMetadata,
      auditMetadata: input.auditMetadata,
    };

    this.state.lots.set(lotKey(input.tenantId, input.lotId), structuredClone(updated));
    await this.audit.record("inventory.lot.metadata.updated", "lot metadata updated", input.commandMetadata, {
      action: "UPDATE_LOT_METADATA",
      tenantId: input.tenantId,
      entityType: "Lot",
      entityId: input.lotId,
      inventoryItemId: current.inventoryItemId,
      lotCode: current.lotCode,
      priorVersion: current.version,
      resultingVersion: updated.version,
      resultClassification: "ACCEPTED",
      success: true,
    });

    return structuredClone(updated);
  }

  async quarantineLot(input: LotMutationInput): Promise<LotContract> {
    return this.transitionLot({ ...input, targetStatus: "QUARANTINED" });
  }

  async releaseLotFromQuarantine(input: LotMutationInput): Promise<LotContract> {
    const expiration = this.findExpirationByLot(input.tenantId, input.lotId);
    if (expiration?.state === "EXPIRED") {
      throw new InventoryDomainError("EXPIRED_ENTITY_RELEASE_PROHIBITED", "cannot release expired lot", false);
    }
    return this.transitionLot({ ...input, targetStatus: "ACTIVE" });
  }

  async retireLot(input: LotMutationInput): Promise<LotContract> {
    return this.transitionLot({ ...input, targetStatus: "DISPOSED" });
  }

  getLot(tenantId: TenantId, lotId: LotId): LotContract | undefined {
    const found = this.state.lots.get(lotKey(tenantId, lotId));
    return found ? structuredClone(found) : undefined;
  }

  listLots(tenantId: TenantId): LotContract[] {
    return sortInventoryRecords(
      [...this.state.lots.values()].filter((lot) => lot.tenantId === tenantId),
      (lot) => `${lot.createdAt}:${lot.lotCode}:${lot.lotId}`,
    ).map((lot) => structuredClone(lot));
  }

  private async transitionLot(input: LotMutationInput & { targetStatus: LotStatus }): Promise<LotContract> {
    const fingerprint = [
      "lot.transition",
      input.lotId,
      input.tenantId,
      input.expectedVersion,
      input.targetStatus,
    ].join("|");

    const replay = await this.idem.resolveReplay(
      {
        tenantId: input.tenantId,
        idempotencyKey: input.commandMetadata.idempotencyKey,
        fingerprint,
        replayType: "lot",
        commandMetadata: input.commandMetadata,
      },
      (id) => this.getLot(input.tenantId, id as LotId),
    );
    if (replay) {
      return replay as LotContract;
    }

    const current = this.requireLot(input.tenantId, input.lotId);
    assertVersionMatches(current.version, input.expectedVersion, "STALE_EXPECTED_VERSION");
    assertValidTransition(lotStatusTransitions, current.status, input.targetStatus, "INVALID_LOT");

    const version = nextVersion(current.version);
    const updated: LotContract = {
      ...current,
      status: input.targetStatus,
      version,
      versionIdentifier: createVersionIdentifier(`1.0.${version}`),
      commandMetadata: input.commandMetadata,
      auditMetadata: input.auditMetadata,
    };

    this.state.lots.set(lotKey(input.tenantId, input.lotId), structuredClone(updated));
    this.idem.record({
      tenantId: input.tenantId,
      idempotencyKeyValue: input.commandMetadata.idempotencyKey,
      fingerprint,
      replayType: "lot",
      replayId: input.lotId,
    });

    await this.audit.record("inventory.lot.status.changed", "lot status changed", input.commandMetadata, {
      action: "TRANSITION_LOT_STATUS",
      tenantId: input.tenantId,
      entityType: "Lot",
      entityId: input.lotId,
      inventoryItemId: current.inventoryItemId,
      lotCode: current.lotCode,
      statusFrom: current.status,
      statusTo: updated.status,
      priorVersion: current.version,
      resultingVersion: updated.version,
      resultClassification: "ACCEPTED",
      success: true,
    });

    return structuredClone(updated);
  }

  private requireLot(tenantId: TenantId, lotId: LotId): LotContract {
    const found = this.state.lots.get(lotKey(tenantId, lotId));
    if (!found) {
      throw new InventoryDomainError("INVALID_LOT", "lot not found", false);
    }
    return structuredClone(found);
  }

  private findExpirationByLot(tenantId: TenantId, lotId: LotId): ExpirationRecordContract | undefined {
    for (const expiration of this.state.expirations.values()) {
      if (expiration.tenantId === tenantId && expiration.lotId === lotId) {
        return structuredClone(expiration);
      }
    }
    return undefined;
  }
}

export class SerialNumberService {
  constructor(
    private readonly slice5: InventorySlice5Services,
    private readonly state: Slice6State,
    private readonly audit: Slice6AuditRecorder,
    private readonly idem: Slice6Idempotency,
    private readonly dependencies: InventoryRuntimeDependencies,
  ) {}

  async registerSerialNumber(input: SerialRegistrationInput): Promise<SerialNumberContract> {
    const fingerprint = [
      "serial.register",
      input.serialNumberId,
      input.tenantId,
      input.inventoryItemId,
      input.serialCode,
      input.status ?? "ACTIVE",
      input.inventoryBalanceId ?? "",
      input.storageLocationId ?? "",
      input.lotId ?? "",
    ].join("|");

    try {
      const replay = await this.idem.resolveReplay(
        {
          tenantId: input.tenantId,
          idempotencyKey: input.commandMetadata.idempotencyKey,
          fingerprint,
          replayType: "serial",
          commandMetadata: input.commandMetadata,
        },
        (id) => this.getSerial(input.tenantId, id as SerialNumberId),
      );
      if (replay) {
        return replay as SerialNumberContract;
      }

      const entityKey = serialKey(input.tenantId, input.serialNumberId);
      if (this.state.serials.has(entityKey)) {
        throw new InventoryDomainError("DUPLICATE_SERIAL_ID", "duplicate serial id", false);
      }

      const item = this.slice5.slice4.foundation.inventoryItemService.getInventoryItem(input.tenantId, input.inventoryItemId);
      if (!item) {
        throw new InventoryDomainError("INVALID_REFERENCE", "inventory item not found", false);
      }

      for (const existing of this.state.serials.values()) {
        if (existing.tenantId === input.tenantId && existing.inventoryItemId === input.inventoryItemId && existing.serialCode === input.serialCode) {
          throw new InventoryDomainError("DUPLICATE_SERIAL_CODE", "duplicate serial code", false);
        }
      }

      if (input.lotId) {
        const lot = this.state.lots.get(lotKey(input.tenantId, input.lotId));
        if (!lot) {
          throw new InventoryDomainError("INVALID_LOT_SERIAL_ASSOCIATION", "lot not found for serial association", false);
        }
        if (lot.inventoryItemId !== input.inventoryItemId) {
          throw new InventoryDomainError("INVALID_LOT_SERIAL_ASSOCIATION", "serial lot inventory item mismatch", false);
        }
      }

      let scopedBalance: InventoryBalanceContract | undefined;
      if (input.inventoryBalanceId) {
        scopedBalance = this.slice5.slice4.foundation.inventoryBalanceService.requireBalance(input.tenantId, input.inventoryBalanceId);
        if (scopedBalance.inventoryItemId !== input.inventoryItemId) {
          throw new InventoryDomainError("INVENTORY_ITEM_MISMATCH", "serial balance inventory item mismatch", false);
        }
      }

      const initialStatus = input.status ?? "ACTIVE";
      if (isSerialActive(initialStatus) && !input.inventoryBalanceId && !input.storageLocationId) {
        throw new InventoryDomainError("INVALID_SERIAL_COMMAND", "active serial requires balance or location binding", false);
      }

      const now = this.dependencies.clockProvider.now();
      const serial: SerialNumberContract = {
        serialNumberId: input.serialNumberId,
        tenantId: input.tenantId,
        inventoryItemId: input.inventoryItemId,
        serialCode: input.serialCode,
        status: initialStatus,
        inventoryBalanceId: input.inventoryBalanceId,
        storageLocationId: input.storageLocationId ?? scopedBalance?.storageLocationId,
        lotId: input.lotId,
        version: 1,
        createdAt: now,
        commandMetadata: input.commandMetadata,
        auditMetadata: input.auditMetadata,
        publishedIdentifier: this.dependencies.identifierProvider.createIdentifier("serial") as SerialNumberContract["publishedIdentifier"],
        versionIdentifier: createVersionIdentifier("1.0.1"),
      };

      this.state.serials.set(entityKey, structuredClone(serial));
      this.idem.record({
        tenantId: input.tenantId,
        idempotencyKeyValue: input.commandMetadata.idempotencyKey,
        fingerprint,
        replayType: "serial",
        replayId: input.serialNumberId,
      });

      await this.audit.record("inventory.serial.registered", "serial registered", input.commandMetadata, {
        action: "REGISTER_SERIAL",
        tenantId: input.tenantId,
        entityType: "Serial",
        entityId: input.serialNumberId,
        inventoryItemId: input.inventoryItemId,
        serialCode: input.serialCode,
        resultClassification: "ACCEPTED",
        success: true,
      });

      return structuredClone(serial);
    } catch (error) {
      await this.audit.record("inventory.serial.rejected", "serial rejected", input.commandMetadata, {
        action: "REGISTER_SERIAL",
        tenantId: input.tenantId,
        entityType: "Serial",
        entityId: input.serialNumberId,
        inventoryItemId: input.inventoryItemId,
        serialCode: input.serialCode,
        resultClassification: error instanceof InventoryDomainError ? error.classification : "INVALID_SERIAL_COMMAND",
        success: false,
      });
      throw error;
    }
  }

  async bindSerial(input: SerialBindingInput): Promise<SerialNumberContract> {
    const current = this.requireSerial(input.tenantId, input.serialNumberId);
    assertVersionMatches(current.version, input.expectedVersion, "STALE_EXPECTED_VERSION");

    const bindingChanged = current.inventoryBalanceId !== input.inventoryBalanceId || current.storageLocationId !== input.storageLocationId;
    if (bindingChanged && !input.movementReferenceId) {
      throw new InventoryDomainError("SERIAL_ALREADY_ACTIVE_ELSEWHERE", "serial reassignment requires approved movement reference", false);
    }

    if (input.inventoryBalanceId) {
      const balance = this.slice5.slice4.foundation.inventoryBalanceService.requireBalance(input.tenantId, input.inventoryBalanceId);
      if (balance.inventoryItemId !== current.inventoryItemId) {
        throw new InventoryDomainError("INVENTORY_ITEM_MISMATCH", "serial binding inventory item mismatch", false);
      }
    }

    if (input.lotId) {
      const lot = this.state.lots.get(lotKey(input.tenantId, input.lotId));
      if (!lot || lot.inventoryItemId !== current.inventoryItemId) {
        throw new InventoryDomainError("INVALID_LOT_SERIAL_ASSOCIATION", "invalid lot association", false);
      }
    }

    const status = current.status === "CREATED" ? "ACTIVE" : current.status;
    if (isSerialActive(status) && !input.inventoryBalanceId && !input.storageLocationId) {
      throw new InventoryDomainError("INVALID_SERIAL_COMMAND", "active serial requires balance or location binding", false);
    }

    const version = nextVersion(current.version);
    const updated: SerialNumberContract = {
      ...current,
      status,
      inventoryBalanceId: input.inventoryBalanceId,
      storageLocationId: input.storageLocationId,
      lotId: input.lotId ?? current.lotId,
      lastMovementReferenceId: input.movementReferenceId,
      version,
      versionIdentifier: createVersionIdentifier(`1.0.${version}`),
      commandMetadata: input.commandMetadata,
      auditMetadata: input.auditMetadata,
    };

    this.state.serials.set(serialKey(input.tenantId, input.serialNumberId), structuredClone(updated));
    await this.audit.record("inventory.serial.binding.changed", "serial binding changed", input.commandMetadata, {
      action: "BIND_SERIAL",
      tenantId: input.tenantId,
      entityType: "Serial",
      entityId: input.serialNumberId,
      inventoryItemId: current.inventoryItemId,
      serialCode: current.serialCode,
      priorVersion: current.version,
      resultingVersion: updated.version,
      resultClassification: "ACCEPTED",
      success: true,
    });

    return structuredClone(updated);
  }

  async quarantineSerial(input: SerialMutationInput): Promise<SerialNumberContract> {
    return this.transitionSerial({ ...input, targetStatus: "QUARANTINED" });
  }

  async releaseSerialFromQuarantine(input: SerialMutationInput): Promise<SerialNumberContract> {
    const expiration = this.findExpirationBySerial(input.tenantId, input.serialNumberId);
    if (expiration?.state === "EXPIRED") {
      throw new InventoryDomainError("EXPIRED_ENTITY_RELEASE_PROHIBITED", "cannot release expired serial", false);
    }
    return this.transitionSerial({ ...input, targetStatus: "ACTIVE" });
  }

  async retireSerial(input: SerialMutationInput): Promise<SerialNumberContract> {
    return this.transitionSerial({ ...input, targetStatus: "RETIRED" });
  }

  getSerial(tenantId: TenantId, serialNumberId: SerialNumberId): SerialNumberContract | undefined {
    const found = this.state.serials.get(serialKey(tenantId, serialNumberId));
    return found ? structuredClone(found) : undefined;
  }

  listSerials(tenantId: TenantId): SerialNumberContract[] {
    return sortInventoryRecords(
      [...this.state.serials.values()].filter((serial) => serial.tenantId === tenantId),
      (serial) => `${serial.createdAt}:${serial.serialCode}:${serial.serialNumberId}`,
    ).map((serial) => structuredClone(serial));
  }

  private async transitionSerial(input: SerialMutationInput & { targetStatus: SerialStatus }): Promise<SerialNumberContract> {
    const fingerprint = ["serial.transition", input.serialNumberId, input.tenantId, input.expectedVersion, input.targetStatus].join("|");
    const replay = await this.idem.resolveReplay(
      {
        tenantId: input.tenantId,
        idempotencyKey: input.commandMetadata.idempotencyKey,
        fingerprint,
        replayType: "serial",
        commandMetadata: input.commandMetadata,
      },
      (id) => this.getSerial(input.tenantId, id as SerialNumberId),
    );
    if (replay) {
      return replay as SerialNumberContract;
    }

    const current = this.requireSerial(input.tenantId, input.serialNumberId);
    assertVersionMatches(current.version, input.expectedVersion, "STALE_EXPECTED_VERSION");
    assertValidTransition(serialStatusTransitions, current.status, input.targetStatus, "INVALID_SERIAL");

    const version = nextVersion(current.version);
    const updated: SerialNumberContract = {
      ...current,
      status: input.targetStatus,
      version,
      versionIdentifier: createVersionIdentifier(`1.0.${version}`),
      commandMetadata: input.commandMetadata,
      auditMetadata: input.auditMetadata,
    };

    this.state.serials.set(serialKey(input.tenantId, input.serialNumberId), structuredClone(updated));
    this.idem.record({
      tenantId: input.tenantId,
      idempotencyKeyValue: input.commandMetadata.idempotencyKey,
      fingerprint,
      replayType: "serial",
      replayId: input.serialNumberId,
    });

    await this.audit.record("inventory.serial.status.changed", "serial status changed", input.commandMetadata, {
      action: "TRANSITION_SERIAL_STATUS",
      tenantId: input.tenantId,
      entityType: "Serial",
      entityId: input.serialNumberId,
      inventoryItemId: current.inventoryItemId,
      serialCode: current.serialCode,
      statusFrom: current.status,
      statusTo: updated.status,
      priorVersion: current.version,
      resultingVersion: updated.version,
      resultClassification: "ACCEPTED",
      success: true,
    });

    return structuredClone(updated);
  }

  private requireSerial(tenantId: TenantId, serialNumberId: SerialNumberId): SerialNumberContract {
    const found = this.state.serials.get(serialKey(tenantId, serialNumberId));
    if (!found) {
      throw new InventoryDomainError("INVALID_SERIAL", "serial not found", false);
    }
    return structuredClone(found);
  }

  private findExpirationBySerial(tenantId: TenantId, serialNumberId: SerialNumberId): ExpirationRecordContract | undefined {
    for (const expiration of this.state.expirations.values()) {
      if (expiration.tenantId === tenantId && expiration.serialNumberId === serialNumberId) {
        return structuredClone(expiration);
      }
    }
    return undefined;
  }
}

export class ExpirationService {
  constructor(
    private readonly slice5: InventorySlice5Services,
    private readonly state: Slice6State,
    private readonly audit: Slice6AuditRecorder,
    private readonly idem: Slice6Idempotency,
    private readonly dependencies: InventoryRuntimeDependencies,
  ) {}

  async evaluateExpiration(input: ExpirationEvaluationInput): Promise<ExpirationRecordContract> {
    const fingerprint = [
      "expiration.evaluate",
      input.expirationRecordId,
      input.tenantId,
      input.inventoryItemId,
      input.lotId ?? "",
      input.serialNumberId ?? "",
      input.manufactureDate ?? "",
      input.bestBeforeDate ?? "",
      input.expirationDate ?? "",
      input.expectedVersion ?? "",
    ].join("|");

    try {
      const replay = await this.idem.resolveReplay(
        {
          tenantId: input.tenantId,
          idempotencyKey: input.commandMetadata.idempotencyKey,
          fingerprint,
          replayType: "expiration",
          commandMetadata: input.commandMetadata,
        },
        (id) => this.getExpirationStatus(input.tenantId, id as ExpirationRecordId),
      );
      if (replay) {
        return replay as ExpirationRecordContract;
      }

      if (!!input.lotId === !!input.serialNumberId) {
        throw new InventoryDomainError("INVALID_COMMAND", "expiration target must be exactly one of lot or serial", false);
      }

      const item = this.slice5.slice4.foundation.inventoryItemService.getInventoryItem(input.tenantId, input.inventoryItemId);
      if (!item) {
        throw new InventoryDomainError("INVALID_REFERENCE", "inventory item not found", false);
      }

      let lot: LotContract | undefined;
      let serial: SerialNumberContract | undefined;
      if (input.lotId) {
        lot = this.state.lots.get(lotKey(input.tenantId, input.lotId));
        if (!lot || lot.inventoryItemId !== input.inventoryItemId) {
          throw new InventoryDomainError("INVALID_LOT", "expiration lot target is invalid", false);
        }
      }
      if (input.serialNumberId) {
        serial = this.state.serials.get(serialKey(input.tenantId, input.serialNumberId));
        if (!serial || serial.inventoryItemId !== input.inventoryItemId) {
          throw new InventoryDomainError("INVALID_SERIAL", "expiration serial target is invalid", false);
        }
      }

      const manufactureDate = input.manufactureDate ?? lot?.manufactureDate;
      const bestBeforeDate = input.bestBeforeDate ?? lot?.bestBeforeDate;
      const expirationDate = input.expirationDate ?? lot?.expirationDate;
      assertDateOrdering(manufactureDate, bestBeforeDate, expirationDate);

      const existing = this.state.expirations.get(expirationKey(input.tenantId, input.expirationRecordId));
      if (existing && input.expectedVersion !== undefined) {
        assertVersionMatches(existing.version, input.expectedVersion, "STALE_EXPECTED_VERSION");
      }

      const now = this.dependencies.clockProvider.now();
      const evaluatedState = this.evaluateState(now, bestBeforeDate, expirationDate, lot?.status, serial?.status);
      const nextVersionValue = existing ? nextVersion(existing.version) : 1;

      const record: ExpirationRecordContract = {
        expirationRecordId: input.expirationRecordId,
        tenantId: input.tenantId,
        inventoryItemId: input.inventoryItemId,
        lotId: input.lotId,
        serialNumberId: input.serialNumberId,
        manufactureDate,
        bestBeforeDate,
        expirationDate,
        state: evaluatedState,
        evaluatedAt: now,
        version: nextVersionValue,
        commandMetadata: input.commandMetadata,
        auditMetadata: input.auditMetadata,
        versionIdentifier: createVersionIdentifier(`1.0.${nextVersionValue}`),
      };

      if (evaluatedState === "EXPIRED") {
        if (lot && lot.status !== "EXPIRED" && lot.status !== "DISPOSED") {
          const updatedLot: LotContract = {
            ...lot,
            status: "EXPIRED",
            version: nextVersion(lot.version),
            versionIdentifier: createVersionIdentifier(`1.0.${nextVersion(lot.version)}`),
            commandMetadata: input.commandMetadata,
            auditMetadata: input.auditMetadata,
          };
          this.state.lots.set(lotKey(input.tenantId, lot.lotId), structuredClone(updatedLot));
        }

        if (serial && serial.status !== "RETIRED" && serial.status !== "QUARANTINED") {
          const updatedSerial: SerialNumberContract = {
            ...serial,
            status: "QUARANTINED",
            version: nextVersion(serial.version),
            versionIdentifier: createVersionIdentifier(`1.0.${nextVersion(serial.version)}`),
            commandMetadata: input.commandMetadata,
            auditMetadata: input.auditMetadata,
          };
          this.state.serials.set(serialKey(input.tenantId, serial.serialNumberId), structuredClone(updatedSerial));
        }
      }

      this.state.expirations.set(expirationKey(input.tenantId, input.expirationRecordId), structuredClone(record));
      this.idem.record({
        tenantId: input.tenantId,
        idempotencyKeyValue: input.commandMetadata.idempotencyKey,
        fingerprint,
        replayType: "expiration",
        replayId: input.expirationRecordId,
      });

      await this.audit.record("inventory.expiration.evaluated", "expiration evaluated", input.commandMetadata, {
        action: "EVALUATE_EXPIRATION",
        tenantId: input.tenantId,
        entityType: input.lotId ? "Lot" : "Serial",
        entityId: input.lotId ?? input.serialNumberId,
        inventoryItemId: input.inventoryItemId,
        state: evaluatedState,
        resultClassification: "ACCEPTED",
        success: true,
      });

      return structuredClone(record);
    } catch (error) {
      await this.audit.record("inventory.expiration.rejected", "expiration evaluation rejected", input.commandMetadata, {
        action: "EVALUATE_EXPIRATION",
        tenantId: input.tenantId,
        entityType: input.lotId ? "Lot" : "Serial",
        entityId: input.lotId ?? input.serialNumberId,
        inventoryItemId: input.inventoryItemId,
        resultClassification: error instanceof InventoryDomainError ? error.classification : "INVALID_COMMAND",
        success: false,
      });
      throw error;
    }
  }

  getExpirationStatus(tenantId: TenantId, expirationRecordId: ExpirationRecordId): ExpirationRecordContract | undefined {
    const found = this.state.expirations.get(expirationKey(tenantId, expirationRecordId));
    return found ? structuredClone(found) : undefined;
  }

  listExpiring(tenantId: TenantId): ExpirationRecordContract[] {
    return this.listRecords(tenantId).filter((record) => record.state === "NEAR_EXPIRY");
  }

  listExpired(tenantId: TenantId): ExpirationRecordContract[] {
    return this.listRecords(tenantId).filter((record) => record.state === "EXPIRED");
  }

  private listRecords(tenantId: TenantId): ExpirationRecordContract[] {
    return sortInventoryRecords(
      [...this.state.expirations.values()].filter((record) => record.tenantId === tenantId),
      (record) => `${record.evaluatedAt}:${record.expirationRecordId}`,
    ).map((record) => structuredClone(record));
  }

  private evaluateState(
    now: string,
    bestBeforeDate?: string,
    expirationDate?: string,
    lotStatus?: LotStatus,
    serialStatus?: SerialStatus,
  ): ExpirationState {
    const nowTs = Date.parse(now);
    const expirationTs = expirationDate ? Date.parse(expirationDate) : undefined;
    if (expirationTs !== undefined && nowTs >= expirationTs) {
      return "EXPIRED";
    }

    if (lotStatus === "DISPOSED" || serialStatus === "RETIRED") {
      return "RETIRED";
    }
    if (lotStatus === "QUARANTINED" || serialStatus === "QUARANTINED") {
      return "QUARANTINED";
    }

    const bestBeforeTs = bestBeforeDate ? Date.parse(bestBeforeDate) : undefined;
    if (bestBeforeTs !== undefined && nowTs >= bestBeforeTs) {
      return "NEAR_EXPIRY";
    }

    return "VALID";
  }
}

export type InventorySlice6Services = Readonly<{
  slice5: InventorySlice5Services;
  lotService: LotService;
  serialNumberService: SerialNumberService;
  expirationService: ExpirationService;
  lotQueryService: InventoryLotQueryService;
  serialQueryService: InventorySerialQueryService;
  expirationQueryService: InventoryExpirationQueryService;
}>;

export function createInventorySlice6Services(options: {
  dependencies: InventoryRuntimeDependencies;
  validatorRegistry: InventoryReferenceValidatorRegistry;
}): InventorySlice6Services {
  const slice5 = createInventorySlice5Services({
    dependencies: options.dependencies,
    validatorRegistry: options.validatorRegistry,
  });

  const state = createSlice6State();
  const audit = new Slice6AuditRecorder(options.dependencies);
  const idem = new Slice6Idempotency(state, audit);
  const lotService = new LotService(slice5, state, audit, idem, options.dependencies);
  const serialNumberService = new SerialNumberService(slice5, state, audit, idem, options.dependencies);
  const expirationService = new ExpirationService(slice5, state, audit, idem, options.dependencies);
  const lotQueryService = new InventoryLotQueryService(lotService, expirationService);
  const serialQueryService = new InventorySerialQueryService(serialNumberService, expirationService);
  const expirationQueryService = new InventoryExpirationQueryService(expirationService);

  return {
    slice5,
    lotService,
    serialNumberService,
    expirationService,
    lotQueryService,
    serialQueryService,
    expirationQueryService,
  };
}

export function createInventorySlice6ServiceRegistrationHook(options: {
  validatorRegistry: InventoryReferenceValidatorRegistry;
}): InventoryServiceRegistrationHook {
  return (context: InventoryRuntimeContext) => {
    const services = createInventorySlice6Services({
      dependencies: context.dependencies,
      validatorRegistry: options.validatorRegistry,
    });

    const registrations: InventoryRuntimeServiceRegistration[] = [
      {
        serviceId: "inventory.service.allocation",
        contract: "inventory.service.allocation",
        description: "Slice 5 allocation command service.",
        value: services.slice5.allocationService,
      },
      {
        serviceId: "inventory.service.allocation-query",
        contract: "inventory.service.allocation-query",
        description: "Slice 5 allocation query surface.",
        value: services.slice5.allocationQueryService,
      },
      {
        serviceId: "inventory.service.bin",
        contract: "inventory.service.bin",
        description: "Slice 3 bin foundation service.",
        value: services.slice5.slice4.foundation.binService,
      },
      {
        serviceId: "inventory.service.expiration",
        contract: "inventory.service.expiration",
        description: "Slice 6 expiration service.",
        value: services.expirationService,
      },
      {
        serviceId: "inventory.service.expiration-query",
        contract: "inventory.service.expiration-query",
        description: "Slice 6 expiration query surface.",
        value: services.expirationQueryService,
      },
      {
        serviceId: "inventory.service.foundation-query",
        contract: "inventory.service.foundation-query",
        description: "Slice 3 deterministic foundation query service.",
        value: services.slice5.slice4.foundationQueries,
      },
      {
        serviceId: "inventory.service.inventory-adjustment",
        contract: "inventory.service.inventory-adjustment",
        description: "Slice 4 inventory adjustment service.",
        value: services.slice5.slice4.adjustmentService,
      },
      {
        serviceId: "inventory.service.inventory-balance",
        contract: "inventory.service.inventory-balance",
        description: "Slice 3 inventory balance foundation service.",
        value: services.slice5.slice4.foundation.inventoryBalanceService,
      },
      {
        serviceId: "inventory.service.inventory-item",
        contract: "inventory.service.inventory-item",
        description: "Slice 3 inventory item foundation service.",
        value: services.slice5.slice4.foundation.inventoryItemService,
      },
      {
        serviceId: "inventory.service.inventory-ledger",
        contract: "inventory.service.inventory-ledger",
        description: "Slice 4 append-only inventory ledger service.",
        value: services.slice5.slice4.ledgerService,
      },
      {
        serviceId: "inventory.service.inventory-movement",
        contract: "inventory.service.inventory-movement",
        description: "Slice 4 inventory movement service.",
        value: services.slice5.slice4.movementService,
      },
      {
        serviceId: "inventory.service.lot",
        contract: "inventory.service.lot",
        description: "Slice 6 lot command service.",
        value: services.lotService,
      },
      {
        serviceId: "inventory.service.lot-query",
        contract: "inventory.service.lot-query",
        description: "Slice 6 lot query surface.",
        value: services.lotQueryService,
      },
      {
        serviceId: "inventory.service.movement-query",
        contract: "inventory.service.movement-query",
        description: "Slice 4 movement and ledger query service.",
        value: services.slice5.slice4.movementQueryService,
      },
      {
        serviceId: "inventory.service.reference-validator-registry",
        contract: "inventory.service.reference-validator-registry",
        description: "Slice 3 bounded reference validator registry.",
        value: options.validatorRegistry,
      },
      {
        serviceId: "inventory.service.reference-validation",
        contract: "inventory.service.reference-validation",
        description: "Slice 7 external reference validation service.",
        value: services.slice5.slice4.foundation.referenceValidationService,
      },
      {
        serviceId: "inventory.service.reservation",
        contract: "inventory.service.reservation",
        description: "Slice 5 reservation command service.",
        value: services.slice5.reservationService,
      },
      {
        serviceId: "inventory.service.reservation-query",
        contract: "inventory.service.reservation-query",
        description: "Slice 5 reservation query surface.",
        value: services.slice5.reservationQueryService,
      },
      {
        serviceId: "inventory.service.serial-number",
        contract: "inventory.service.serial-number",
        description: "Slice 6 serial number command service.",
        value: services.serialNumberService,
      },
      {
        serviceId: "inventory.service.serial-query",
        contract: "inventory.service.serial-query",
        description: "Slice 6 serial query surface.",
        value: services.serialQueryService,
      },
      {
        serviceId: "inventory.service.storage-location",
        contract: "inventory.service.storage-location",
        description: "Slice 3 storage location foundation service.",
        value: services.slice5.slice4.foundation.storageLocationService,
      },
      {
        serviceId: "inventory.service.warehouse",
        contract: "inventory.service.warehouse",
        description: "Slice 3 warehouse foundation service.",
        value: services.slice5.slice4.foundation.warehouseService,
      },
    ];

    for (const registration of registrations.sort((left, right) => compareDeterministicStrings(left.serviceId, right.serviceId))) {
      context.host.registerService(registration);
    }
  };
}
