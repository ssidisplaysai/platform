import { compareDeterministicStrings } from "../../shared";
import type {
  AuditMetadata,
  BinContract,
  BinId,
  CommandMetadata,
  ExpectedVersion,
  InventoryBalanceContract,
  InventoryBalanceId,
  InventoryBalanceStatus,
  InventoryItemContract,
  InventoryItemId,
  InventoryLifecycleState,
  InventoryLocationType,
  InventoryMetadata,
  LocationStatus,
  ProductReferenceId,
  ProductVariantReferenceId,
  StorageLocationContract,
  StorageLocationId,
  TenantId,
  WarehouseContract,
  WarehouseId,
  WarehouseStatus,
} from "../contracts";
import {
  assertImmutableIdentity,
  assertNoRecursiveContainment,
  assertTenantScope,
  assertValidTransition,
  assertExpectedVersionMatches,
  assertQuantityInvariant,
  createConcurrencyToken,
  createExpectedVersion,
  createQuantityModel,
  createVersionIdentifier,
  inventoryLifecycleTransitions,
  locationStatusTransitions,
  sortInventoryRecords,
  warehouseStatusTransitions,
} from "../domain";
import { InventoryDomainError } from "../domain";
import type {
  InventoryBinReferenceValidator,
  InventoryProductReferenceValidator,
  InventoryReferenceValidatorRegistry,
  InventoryStorageLocationReferenceValidator,
  InventoryWarehouseReferenceValidator,
} from "../integration";
import type { InventoryRuntimeAuditRecord, InventoryRuntimeDependencies } from "../integration";
import type { InventoryRuntimeContext, InventoryRuntimeServiceRegistration, InventoryServiceRegistrationHook } from "../runtime";

export type InventoryItemRegistrationInput = Readonly<{
  inventoryItemId: InventoryItemId;
  tenantId: TenantId;
  productReferenceId: ProductReferenceId;
  productVariantReferenceId?: ProductVariantReferenceId;
  unitOfMeasure: string;
  metadata?: InventoryMetadata;
  lifecycleState?: InventoryLifecycleState;
  publishedIdentifier?: string;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type WarehouseRegistrationInput = Readonly<{
  warehouseId: WarehouseId;
  tenantId: TenantId;
  warehouseCode: string;
  status?: WarehouseStatus;
  metadata?: InventoryMetadata;
  publishedIdentifier?: string;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type StorageLocationRegistrationInput = Readonly<{
  storageLocationId: StorageLocationId;
  warehouseId: WarehouseId;
  tenantId: TenantId;
  locationCode: string;
  locationType: InventoryLocationType;
  status?: LocationStatus;
  parentLocationId?: StorageLocationId;
  metadata?: InventoryMetadata;
  publishedIdentifier?: string;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type BinRegistrationInput = Readonly<{
  binId: BinId;
  storageLocationId: StorageLocationId;
  tenantId: TenantId;
  binCode: string;
  status?: LocationStatus;
  metadata?: InventoryMetadata;
  publishedIdentifier?: string;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type InventoryBalanceInitializationInput = Readonly<{
  inventoryBalanceId: InventoryBalanceId;
  inventoryItemId: InventoryItemId;
  tenantId: TenantId;
  warehouseId: WarehouseId;
  storageLocationId?: StorageLocationId;
  binId?: BinId;
  status?: InventoryBalanceStatus;
  metadata?: InventoryMetadata;
  publishedIdentifier?: string;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
  initialQuantities?: Readonly<{
    onHandQuantity?: number;
    reservedQuantity?: number;
    allocatedQuantity?: number;
    nonAllocatableHoldQuantity?: number;
  }>;
}>;

export type InventoryFoundationAuditEntry = InventoryRuntimeAuditRecord;

export type InventoryFoundationServices = Readonly<{
  inventoryItemService: InventoryItemService;
  warehouseService: WarehouseService;
  storageLocationService: StorageLocationService;
  binService: BinService;
  inventoryBalanceService: InventoryBalanceService;
}>;

type FoundationState = {
  readonly inventoryItems: Map<string, InventoryItemContract>;
  readonly warehouses: Map<string, WarehouseContract>;
  readonly storageLocations: Map<string, StorageLocationContract>;
  readonly bins: Map<string, BinContract>;
  readonly balances: Map<string, InventoryBalanceContract>;
};

function createState(): FoundationState {
  return {
    inventoryItems: new Map(),
    warehouses: new Map(),
    storageLocations: new Map(),
    bins: new Map(),
    balances: new Map(),
  };
}

function key(parts: readonly (string | undefined)[]): string {
  return parts.map((part) => part ?? "").join("|");
}

function metadataOrEmpty(metadata?: InventoryMetadata): InventoryMetadata {
  return metadata ?? {};
}

function nextVersion(currentVersion?: number): number {
  return currentVersion === undefined ? 1 : currentVersion + 1;
}

function toVersionIdentifier(version: number) {
  return createVersionIdentifier(`1.0.${version}`);
}

function findByIdentifier<TRecord extends Record<TKey, string>, TKey extends keyof TRecord>(
  values: Iterable<TRecord>,
  field: TKey,
  expected: TRecord[TKey],
): TRecord | undefined {
  for (const value of values) {
    if (value[field] === expected) {
      return value;
    }
  }
  return undefined;
}

class InventoryAuditRecorder {
  constructor(private readonly dependencies: InventoryRuntimeDependencies) {}

  now(): string {
    return this.dependencies.clockProvider.now();
  }

  async record(
    eventType: string,
    message: string,
    commandMetadata: CommandMetadata,
    details: Record<string, unknown>,
  ): Promise<void> {
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

export class InventoryItemService {
  constructor(
    private readonly state: FoundationState,
    private readonly audit: InventoryAuditRecorder,
    private readonly productValidatorRegistry: InventoryReferenceValidatorRegistry,
    private readonly dependencies: InventoryRuntimeDependencies,
  ) {}

  async registerInventoryItem(input: InventoryItemRegistrationInput): Promise<InventoryItemContract> {
    const itemKey = key([input.tenantId, input.inventoryItemId]);
    const productKey = key([input.tenantId, input.productReferenceId, input.productVariantReferenceId]);

    try {
      if (this.state.inventoryItems.has(itemKey)) {
        throw new InventoryDomainError("DUPLICATE_INVENTORY_ITEM", "duplicate inventory item identity", false);
      }
      for (const existing of this.state.inventoryItems.values()) {
        if (key([existing.tenantId, existing.productReferenceId, existing.productVariantReferenceId]) === productKey) {
          throw new InventoryDomainError("DUPLICATE_PRODUCT_REFERENCE", "duplicate product reference mapping", false);
        }
      }

      let validator: InventoryProductReferenceValidator;
      try {
        validator = this.productValidatorRegistry.requireProductValidator();
      } catch {
        throw new InventoryDomainError("MISSING_REQUIRED_VALIDATOR", "product reference validator is not registered", false);
      }
      const validation = await validator.validate({
        tenantId: input.tenantId,
        inventoryItemId: input.inventoryItemId,
        productReferenceId: input.productReferenceId,
        productVariantReferenceId: input.productVariantReferenceId,
      });
      if (!validation.valid) {
        throw new InventoryDomainError("INVALID_PRODUCT_REFERENCE", validation.reason, false);
      }

      const version = 1;
      const record: InventoryItemContract = {
        inventoryItemId: input.inventoryItemId,
        tenantId: input.tenantId,
        productReferenceId: input.productReferenceId,
        productVariantReferenceId: input.productVariantReferenceId,
        lifecycleState: input.lifecycleState ?? "DRAFT",
        unitOfMeasure: input.unitOfMeasure,
        metadata: metadataOrEmpty(input.metadata),
        version,
        publishedIdentifier: (input.publishedIdentifier ?? this.dependencies.identifierProvider.createIdentifier("inventory-item")) as InventoryItemContract["publishedIdentifier"],
        versionIdentifier: toVersionIdentifier(version),
      };

      this.state.inventoryItems.set(itemKey, record);
      await this.audit.record("inventory.item.register.accepted", "inventory item registered", input.commandMetadata, {
        action: "REGISTER_INVENTORY_ITEM",
        tenantId: input.tenantId,
        entityType: "InventoryItem",
        entityId: input.inventoryItemId,
        success: true,
        resultingVersion: record.version,
      });
      return structuredClone(record);
    } catch (error) {
      await this.audit.record("inventory.item.register.rejected", "inventory item registration rejected", input.commandMetadata, {
        action: "REGISTER_INVENTORY_ITEM",
        tenantId: input.tenantId,
        entityType: "InventoryItem",
        entityId: input.inventoryItemId,
        success: false,
        rejectionClassification: error instanceof InventoryDomainError ? error.classification : "INVALID_COMMAND",
      });
      throw error;
    }
  }

  getInventoryItem(tenantId: TenantId, inventoryItemId: InventoryItemId): InventoryItemContract | undefined {
    const found = this.state.inventoryItems.get(key([tenantId, inventoryItemId]));
    return found ? structuredClone(found) : undefined;
  }

  listInventoryItems(tenantId: TenantId): InventoryItemContract[] {
    return sortInventoryRecords(
      [...this.state.inventoryItems.values()].filter((item) => item.tenantId === tenantId),
      (item) => item.inventoryItemId,
    ).map((item) => structuredClone(item));
  }

  async transitionInventoryItemLifecycle(input: {
    tenantId: TenantId;
    inventoryItemId: InventoryItemId;
    nextLifecycleState: InventoryLifecycleState;
    expectedVersion: ExpectedVersion;
    commandMetadata: CommandMetadata;
  }): Promise<InventoryItemContract> {
    const itemKey = key([input.tenantId, input.inventoryItemId]);
    const current = this.state.inventoryItems.get(itemKey);
    if (!current) {
      throw new InventoryDomainError("INVALID_REFERENCE", "inventory item not found", false);
    }

    assertExpectedVersionMatches(current.version, input.expectedVersion);
    assertValidTransition(inventoryLifecycleTransitions, current.lifecycleState, input.nextLifecycleState, "INVALID_COMMAND");

    const version = nextVersion(current.version);
    const updated: InventoryItemContract = {
      ...current,
      lifecycleState: input.nextLifecycleState,
      version,
      versionIdentifier: toVersionIdentifier(version),
    };
    this.state.inventoryItems.set(itemKey, updated);
    await this.audit.record("inventory.item.lifecycle.accepted", "inventory item lifecycle updated", input.commandMetadata, {
      action: "TRANSITION_INVENTORY_ITEM_LIFECYCLE",
      tenantId: input.tenantId,
      entityType: "InventoryItem",
      entityId: input.inventoryItemId,
      priorVersion: current.version,
      resultingVersion: updated.version,
      success: true,
    });
    return structuredClone(updated);
  }

  async updateInventoryItemMetadata(input: {
    tenantId: TenantId;
    inventoryItemId: InventoryItemId;
    expectedVersion: ExpectedVersion;
    metadata: InventoryMetadata;
    publishedIdentifier?: InventoryItemContract["publishedIdentifier"];
    commandMetadata: CommandMetadata;
  }): Promise<InventoryItemContract> {
    const itemKey = key([input.tenantId, input.inventoryItemId]);
    const current = this.state.inventoryItems.get(itemKey);
    if (!current) {
      throw new InventoryDomainError("INVALID_REFERENCE", "inventory item not found", false);
    }

    assertExpectedVersionMatches(current.version, input.expectedVersion);
    if (input.publishedIdentifier) {
      assertImmutableIdentity(current.publishedIdentifier, input.publishedIdentifier, "publishedIdentifier");
    }

    const version = nextVersion(current.version);
    const updated: InventoryItemContract = {
      ...current,
      metadata: metadataOrEmpty(input.metadata),
      version,
      versionIdentifier: toVersionIdentifier(version),
    };
    this.state.inventoryItems.set(itemKey, updated);
    await this.audit.record("inventory.item.metadata.accepted", "inventory item metadata updated", input.commandMetadata, {
      action: "UPDATE_INVENTORY_ITEM_METADATA",
      tenantId: input.tenantId,
      entityType: "InventoryItem",
      entityId: input.inventoryItemId,
      priorVersion: current.version,
      resultingVersion: updated.version,
      success: true,
    });
    return structuredClone(updated);
  }
}

export class WarehouseService implements InventoryWarehouseReferenceValidator {
  constructor(private readonly state: FoundationState, private readonly audit: InventoryAuditRecorder, private readonly dependencies: InventoryRuntimeDependencies) {}

  requireWarehouse(tenantId: TenantId, warehouseId: WarehouseId): void {
    const found = this.state.warehouses.get(key([tenantId, warehouseId]));
    if (!found) {
      throw new InventoryDomainError("INVALID_WAREHOUSE", "warehouse not found", false);
    }
  }

  async registerWarehouse(input: WarehouseRegistrationInput): Promise<WarehouseContract> {
    const warehouseKey = key([input.tenantId, input.warehouseId]);
    if (this.state.warehouses.has(warehouseKey)) {
      throw new InventoryDomainError("UNIQUE_CONSTRAINT_VIOLATION", "duplicate warehouse identity", false);
    }

    for (const warehouse of this.state.warehouses.values()) {
      if (warehouse.tenantId === input.tenantId && warehouse.warehouseCode === input.warehouseCode) {
        throw new InventoryDomainError("DUPLICATE_WAREHOUSE_CODE", "duplicate warehouse code", false);
      }
    }

    const version = 1;
    const record: WarehouseContract = {
      warehouseId: input.warehouseId,
      tenantId: input.tenantId,
      warehouseCode: input.warehouseCode,
      status: input.status ?? "ACTIVE",
      metadata: metadataOrEmpty(input.metadata),
      version,
      publishedIdentifier: (input.publishedIdentifier ?? this.dependencies.identifierProvider.createIdentifier("warehouse")) as WarehouseContract["publishedIdentifier"],
      versionIdentifier: toVersionIdentifier(version),
    };
    this.state.warehouses.set(warehouseKey, record);
    await this.audit.record("inventory.warehouse.register.accepted", "warehouse registered", input.commandMetadata, {
      action: "REGISTER_WAREHOUSE",
      tenantId: input.tenantId,
      entityType: "Warehouse",
      entityId: input.warehouseId,
      resultingVersion: record.version,
      success: true,
    });
    return structuredClone(record);
  }

  getWarehouse(tenantId: TenantId, warehouseId: WarehouseId): WarehouseContract | undefined {
    const found = this.state.warehouses.get(key([tenantId, warehouseId]));
    return found ? structuredClone(found) : undefined;
  }

  listWarehouses(tenantId: TenantId): WarehouseContract[] {
    return sortInventoryRecords(
      [...this.state.warehouses.values()].filter((warehouse) => warehouse.tenantId === tenantId),
      (warehouse) => warehouse.warehouseCode,
    ).map((warehouse) => structuredClone(warehouse));
  }

  async transitionWarehouseLifecycle(input: {
    tenantId: TenantId;
    warehouseId: WarehouseId;
    nextStatus: WarehouseStatus;
    expectedVersion: ExpectedVersion;
    commandMetadata: CommandMetadata;
  }): Promise<WarehouseContract> {
    const warehouseKey = key([input.tenantId, input.warehouseId]);
    const current = this.state.warehouses.get(warehouseKey);
    if (!current) {
      throw new InventoryDomainError("INVALID_WAREHOUSE", "warehouse not found", false);
    }
    assertExpectedVersionMatches(current.version, input.expectedVersion);
    assertValidTransition(warehouseStatusTransitions, current.status, input.nextStatus, "INVALID_WAREHOUSE");

    const version = nextVersion(current.version);
    const updated: WarehouseContract = {
      ...current,
      status: input.nextStatus,
      version,
      versionIdentifier: toVersionIdentifier(version),
    };
    this.state.warehouses.set(warehouseKey, updated);
    await this.audit.record("inventory.warehouse.lifecycle.accepted", "warehouse lifecycle updated", input.commandMetadata, {
      action: "TRANSITION_WAREHOUSE_LIFECYCLE",
      tenantId: input.tenantId,
      entityType: "Warehouse",
      entityId: input.warehouseId,
      priorVersion: current.version,
      resultingVersion: updated.version,
      success: true,
    });
    return structuredClone(updated);
  }

  async updateWarehouseMetadata(input: {
    tenantId: TenantId;
    warehouseId: WarehouseId;
    expectedVersion: ExpectedVersion;
    metadata: InventoryMetadata;
    publishedIdentifier?: WarehouseContract["publishedIdentifier"];
    commandMetadata: CommandMetadata;
  }): Promise<WarehouseContract> {
    const warehouseKey = key([input.tenantId, input.warehouseId]);
    const current = this.state.warehouses.get(warehouseKey);
    if (!current) {
      throw new InventoryDomainError("INVALID_WAREHOUSE", "warehouse not found", false);
    }
    assertExpectedVersionMatches(current.version, input.expectedVersion);
    if (input.publishedIdentifier) {
      assertImmutableIdentity(current.publishedIdentifier, input.publishedIdentifier, "publishedIdentifier");
    }

    const version = nextVersion(current.version);
    const updated: WarehouseContract = {
      ...current,
      metadata: metadataOrEmpty(input.metadata),
      version,
      versionIdentifier: toVersionIdentifier(version),
    };
    this.state.warehouses.set(warehouseKey, updated);
    await this.audit.record("inventory.warehouse.metadata.accepted", "warehouse metadata updated", input.commandMetadata, {
      action: "UPDATE_WAREHOUSE_METADATA",
      tenantId: input.tenantId,
      entityType: "Warehouse",
      entityId: input.warehouseId,
      priorVersion: current.version,
      resultingVersion: updated.version,
      success: true,
    });
    return structuredClone(updated);
  }
}

export class StorageLocationService implements InventoryStorageLocationReferenceValidator {
  constructor(
    private readonly state: FoundationState,
    private readonly audit: InventoryAuditRecorder,
    private readonly warehouseValidator: InventoryWarehouseReferenceValidator,
    private readonly dependencies: InventoryRuntimeDependencies,
  ) {}

  requireStorageLocation(tenantId: TenantId, storageLocationId: StorageLocationId): void {
    const found = this.state.storageLocations.get(key([tenantId, storageLocationId]));
    if (!found) {
      throw new InventoryDomainError("INVALID_LOCATION", "storage location not found", false);
    }
  }

  async registerStorageLocation(input: StorageLocationRegistrationInput): Promise<StorageLocationContract> {
    this.warehouseValidator.requireWarehouse(input.tenantId, input.warehouseId);

    const locationKey = key([input.tenantId, input.storageLocationId]);
    if (this.state.storageLocations.has(locationKey)) {
      throw new InventoryDomainError("UNIQUE_CONSTRAINT_VIOLATION", "duplicate storage location identity", false);
    }

    for (const location of this.state.storageLocations.values()) {
      if (
        location.tenantId === input.tenantId &&
        location.warehouseId === input.warehouseId &&
        location.locationCode === input.locationCode
      ) {
        throw new InventoryDomainError("DUPLICATE_LOCATION_CODE", "duplicate location code", false);
      }
    }

    if (input.parentLocationId) {
      const parent = this.state.storageLocations.get(key([input.tenantId, input.parentLocationId]));
      if (!parent || parent.warehouseId !== input.warehouseId) {
        throw new InventoryDomainError("INVALID_LOCATION_PARENT", "invalid location parent", false);
      }
    }

    const nextRelationships = [...this.state.storageLocations.values()].map((location) => ({
      nodeId: location.storageLocationId,
      parentNodeId: location.parentLocationId,
    }));
    nextRelationships.push({ nodeId: input.storageLocationId, parentNodeId: input.parentLocationId });
    assertNoRecursiveContainment(nextRelationships);

    const version = 1;
    const record: StorageLocationContract = {
      storageLocationId: input.storageLocationId,
      warehouseId: input.warehouseId,
      tenantId: input.tenantId,
      locationCode: input.locationCode,
      locationType: input.locationType,
      status: input.status ?? "ACTIVE",
      parentLocationId: input.parentLocationId,
      metadata: metadataOrEmpty(input.metadata),
      version,
      publishedIdentifier: (input.publishedIdentifier ?? this.dependencies.identifierProvider.createIdentifier("location")) as StorageLocationContract["publishedIdentifier"],
      versionIdentifier: toVersionIdentifier(version),
    };
    this.state.storageLocations.set(locationKey, record);
    await this.audit.record("inventory.location.register.accepted", "storage location registered", input.commandMetadata, {
      action: "REGISTER_STORAGE_LOCATION",
      tenantId: input.tenantId,
      entityType: "StorageLocation",
      entityId: input.storageLocationId,
      resultingVersion: record.version,
      success: true,
    });
    return structuredClone(record);
  }

  getStorageLocation(tenantId: TenantId, storageLocationId: StorageLocationId): StorageLocationContract | undefined {
    const found = this.state.storageLocations.get(key([tenantId, storageLocationId]));
    return found ? structuredClone(found) : undefined;
  }

  listStorageLocations(tenantId: TenantId): StorageLocationContract[] {
    return sortInventoryRecords(
      [...this.state.storageLocations.values()].filter((location) => location.tenantId === tenantId),
      (location) => `${location.warehouseId}:${location.locationCode}`,
    ).map((location) => structuredClone(location));
  }

  listLocationsByWarehouse(tenantId: TenantId, warehouseId: WarehouseId): StorageLocationContract[] {
    return sortInventoryRecords(
      [...this.state.storageLocations.values()].filter(
        (location) => location.tenantId === tenantId && location.warehouseId === warehouseId,
      ),
      (location) => location.locationCode,
    ).map((location) => structuredClone(location));
  }

  async transitionStorageLocationLifecycle(input: {
    tenantId: TenantId;
    storageLocationId: StorageLocationId;
    nextStatus: LocationStatus;
    expectedVersion: ExpectedVersion;
    commandMetadata: CommandMetadata;
  }): Promise<StorageLocationContract> {
    const locationKey = key([input.tenantId, input.storageLocationId]);
    const current = this.state.storageLocations.get(locationKey);
    if (!current) {
      throw new InventoryDomainError("INVALID_LOCATION", "storage location not found", false);
    }
    assertExpectedVersionMatches(current.version, input.expectedVersion);
    assertValidTransition(locationStatusTransitions, current.status, input.nextStatus, "INVALID_LOCATION");

    const version = nextVersion(current.version);
    const updated: StorageLocationContract = {
      ...current,
      status: input.nextStatus,
      version,
      versionIdentifier: toVersionIdentifier(version),
    };
    this.state.storageLocations.set(locationKey, updated);
    await this.audit.record("inventory.location.lifecycle.accepted", "storage location lifecycle updated", input.commandMetadata, {
      action: "TRANSITION_STORAGE_LOCATION_LIFECYCLE",
      tenantId: input.tenantId,
      entityType: "StorageLocation",
      entityId: input.storageLocationId,
      priorVersion: current.version,
      resultingVersion: updated.version,
      success: true,
    });
    return structuredClone(updated);
  }

  async updateStorageLocationMetadata(input: {
    tenantId: TenantId;
    storageLocationId: StorageLocationId;
    expectedVersion: ExpectedVersion;
    metadata: InventoryMetadata;
    publishedIdentifier?: StorageLocationContract["publishedIdentifier"];
    commandMetadata: CommandMetadata;
  }): Promise<StorageLocationContract> {
    const locationKey = key([input.tenantId, input.storageLocationId]);
    const current = this.state.storageLocations.get(locationKey);
    if (!current) {
      throw new InventoryDomainError("INVALID_LOCATION", "storage location not found", false);
    }
    assertExpectedVersionMatches(current.version, input.expectedVersion);
    if (input.publishedIdentifier) {
      assertImmutableIdentity(current.publishedIdentifier, input.publishedIdentifier, "publishedIdentifier");
    }

    const version = nextVersion(current.version);
    const updated: StorageLocationContract = {
      ...current,
      metadata: metadataOrEmpty(input.metadata),
      version,
      versionIdentifier: toVersionIdentifier(version),
    };
    this.state.storageLocations.set(locationKey, updated);
    await this.audit.record("inventory.location.metadata.accepted", "storage location metadata updated", input.commandMetadata, {
      action: "UPDATE_STORAGE_LOCATION_METADATA",
      tenantId: input.tenantId,
      entityType: "StorageLocation",
      entityId: input.storageLocationId,
      priorVersion: current.version,
      resultingVersion: updated.version,
      success: true,
    });
    return structuredClone(updated);
  }

  async reparentStorageLocation(input: {
    tenantId: TenantId;
    storageLocationId: StorageLocationId;
    parentLocationId?: StorageLocationId;
    expectedVersion: ExpectedVersion;
    commandMetadata: CommandMetadata;
  }): Promise<StorageLocationContract> {
    const locationKey = key([input.tenantId, input.storageLocationId]);
    const current = this.state.storageLocations.get(locationKey);
    if (!current) {
      throw new InventoryDomainError("INVALID_LOCATION", "storage location not found", false);
    }
    assertExpectedVersionMatches(current.version, input.expectedVersion);
    if (input.parentLocationId) {
      const parent = this.state.storageLocations.get(key([input.tenantId, input.parentLocationId]));
      if (!parent || parent.warehouseId !== current.warehouseId) {
        throw new InventoryDomainError("INVALID_LOCATION_PARENT", "invalid location parent", false);
      }
    }

    const relationships = [...this.state.storageLocations.values()].map((location) => ({
      nodeId: location.storageLocationId,
      parentNodeId: location.storageLocationId === input.storageLocationId ? input.parentLocationId : location.parentLocationId,
    }));
    assertNoRecursiveContainment(relationships);

    const version = nextVersion(current.version);
    const updated: StorageLocationContract = {
      ...current,
      parentLocationId: input.parentLocationId,
      version,
      versionIdentifier: toVersionIdentifier(version),
    };
    this.state.storageLocations.set(locationKey, updated);
    await this.audit.record("inventory.location.reparent.accepted", "storage location reparented", input.commandMetadata, {
      action: "REPARENT_STORAGE_LOCATION",
      tenantId: input.tenantId,
      entityType: "StorageLocation",
      entityId: input.storageLocationId,
      priorVersion: current.version,
      resultingVersion: updated.version,
      success: true,
    });
    return structuredClone(updated);
  }
}

export class BinService implements InventoryBinReferenceValidator {
  constructor(
    private readonly state: FoundationState,
    private readonly audit: InventoryAuditRecorder,
    private readonly locationValidator: InventoryStorageLocationReferenceValidator,
    private readonly dependencies: InventoryRuntimeDependencies,
  ) {}

  requireBin(tenantId: TenantId, binId: BinId): void {
    const found = this.state.bins.get(key([tenantId, binId]));
    if (!found) {
      throw new InventoryDomainError("INVALID_BIN_PARENT", "bin not found", false);
    }
  }

  async registerBin(input: BinRegistrationInput): Promise<BinContract> {
    this.locationValidator.requireStorageLocation(input.tenantId, input.storageLocationId);

    const binKey = key([input.tenantId, input.binId]);
    if (this.state.bins.has(binKey)) {
      throw new InventoryDomainError("UNIQUE_CONSTRAINT_VIOLATION", "duplicate bin identity", false);
    }

    for (const bin of this.state.bins.values()) {
      if (bin.tenantId === input.tenantId && bin.storageLocationId === input.storageLocationId && bin.binCode === input.binCode) {
        throw new InventoryDomainError("DUPLICATE_BIN_CODE", "duplicate bin code", false);
      }
    }

    const version = 1;
    const record: BinContract = {
      binId: input.binId,
      storageLocationId: input.storageLocationId,
      tenantId: input.tenantId,
      binCode: input.binCode,
      status: input.status ?? "ACTIVE",
      metadata: metadataOrEmpty(input.metadata),
      version,
      publishedIdentifier: (input.publishedIdentifier ?? this.dependencies.identifierProvider.createIdentifier("bin")) as BinContract["publishedIdentifier"],
      versionIdentifier: toVersionIdentifier(version),
    };
    this.state.bins.set(binKey, record);
    await this.audit.record("inventory.bin.register.accepted", "bin registered", input.commandMetadata, {
      action: "REGISTER_BIN",
      tenantId: input.tenantId,
      entityType: "Bin",
      entityId: input.binId,
      resultingVersion: record.version,
      success: true,
    });
    return structuredClone(record);
  }

  getBin(tenantId: TenantId, binId: BinId): BinContract | undefined {
    const found = this.state.bins.get(key([tenantId, binId]));
    return found ? structuredClone(found) : undefined;
  }

  listBins(tenantId: TenantId): BinContract[] {
    return sortInventoryRecords(
      [...this.state.bins.values()].filter((bin) => bin.tenantId === tenantId),
      (bin) => `${bin.storageLocationId}:${bin.binCode}`,
    ).map((bin) => structuredClone(bin));
  }

  listBinsByLocation(tenantId: TenantId, storageLocationId: StorageLocationId): BinContract[] {
    return sortInventoryRecords(
      [...this.state.bins.values()].filter((bin) => bin.tenantId === tenantId && bin.storageLocationId === storageLocationId),
      (bin) => bin.binCode,
    ).map((bin) => structuredClone(bin));
  }

  async transitionBinLifecycle(input: {
    tenantId: TenantId;
    binId: BinId;
    nextStatus: LocationStatus;
    expectedVersion: ExpectedVersion;
    commandMetadata: CommandMetadata;
  }): Promise<BinContract> {
    const binKey = key([input.tenantId, input.binId]);
    const current = this.state.bins.get(binKey);
    if (!current) {
      throw new InventoryDomainError("INVALID_BIN_PARENT", "bin not found", false);
    }
    assertExpectedVersionMatches(current.version, input.expectedVersion);
    assertValidTransition(locationStatusTransitions, current.status, input.nextStatus, "INVALID_LOCATION");

    const version = nextVersion(current.version);
    const updated: BinContract = {
      ...current,
      status: input.nextStatus,
      version,
      versionIdentifier: toVersionIdentifier(version),
    };
    this.state.bins.set(binKey, updated);
    await this.audit.record("inventory.bin.lifecycle.accepted", "bin lifecycle updated", input.commandMetadata, {
      action: "TRANSITION_BIN_LIFECYCLE",
      tenantId: input.tenantId,
      entityType: "Bin",
      entityId: input.binId,
      priorVersion: current.version,
      resultingVersion: updated.version,
      success: true,
    });
    return structuredClone(updated);
  }

  async updateBinMetadata(input: {
    tenantId: TenantId;
    binId: BinId;
    expectedVersion: ExpectedVersion;
    metadata: InventoryMetadata;
    publishedIdentifier?: BinContract["publishedIdentifier"];
    commandMetadata: CommandMetadata;
  }): Promise<BinContract> {
    const binKey = key([input.tenantId, input.binId]);
    const current = this.state.bins.get(binKey);
    if (!current) {
      throw new InventoryDomainError("INVALID_BIN_PARENT", "bin not found", false);
    }
    assertExpectedVersionMatches(current.version, input.expectedVersion);
    if (input.publishedIdentifier) {
      assertImmutableIdentity(current.publishedIdentifier, input.publishedIdentifier, "publishedIdentifier");
    }

    const version = nextVersion(current.version);
    const updated: BinContract = {
      ...current,
      metadata: metadataOrEmpty(input.metadata),
      version,
      versionIdentifier: toVersionIdentifier(version),
    };
    this.state.bins.set(binKey, updated);
    await this.audit.record("inventory.bin.metadata.accepted", "bin metadata updated", input.commandMetadata, {
      action: "UPDATE_BIN_METADATA",
      tenantId: input.tenantId,
      entityType: "Bin",
      entityId: input.binId,
      priorVersion: current.version,
      resultingVersion: updated.version,
      success: true,
    });
    return structuredClone(updated);
  }
}

export class InventoryBalanceService {
  constructor(
    private readonly state: FoundationState,
    private readonly audit: InventoryAuditRecorder,
    private readonly warehouseValidator: InventoryWarehouseReferenceValidator,
    private readonly locationValidator: InventoryStorageLocationReferenceValidator,
    private readonly binValidator: InventoryBinReferenceValidator,
  ) {}

  buildDimensionalKey(input: {
    tenantId: TenantId;
    inventoryItemId: InventoryItemId;
    warehouseId: WarehouseId;
    storageLocationId?: StorageLocationId;
    binId?: BinId;
    status?: InventoryBalanceStatus;
  }): string {
    return key([
      input.tenantId,
      input.inventoryItemId,
      input.warehouseId,
      input.storageLocationId,
      input.binId,
      input.status ?? "ACTIVE",
      "lot:deferred",
      "serial:deferred",
    ]);
  }

  async initializeInventoryBalance(input: InventoryBalanceInitializationInput): Promise<InventoryBalanceContract> {
    const item = this.state.inventoryItems.get(key([input.tenantId, input.inventoryItemId]));
    if (!item) {
      const crossTenantItem = findByIdentifier(this.state.inventoryItems.values(), "inventoryItemId", input.inventoryItemId);
      if (crossTenantItem) {
        throw new InventoryDomainError("TENANT_ISOLATION_VIOLATION", "inventory item tenant mismatch", false);
      }
      throw new InventoryDomainError("INVALID_REFERENCE", "inventory item not found", false);
    }

    try {
      this.warehouseValidator.requireWarehouse(input.tenantId, input.warehouseId);
    } catch (error) {
      const crossTenantWarehouse = findByIdentifier(this.state.warehouses.values(), "warehouseId", input.warehouseId);
      if (crossTenantWarehouse && crossTenantWarehouse.tenantId !== input.tenantId) {
        throw new InventoryDomainError("TENANT_ISOLATION_VIOLATION", "warehouse tenant mismatch", false);
      }
      throw error;
    }
    if (input.storageLocationId) {
      try {
        this.locationValidator.requireStorageLocation(input.tenantId, input.storageLocationId);
      } catch (error) {
        const crossTenantLocation = findByIdentifier(this.state.storageLocations.values(), "storageLocationId", input.storageLocationId);
        if (crossTenantLocation && crossTenantLocation.tenantId !== input.tenantId) {
          throw new InventoryDomainError("TENANT_ISOLATION_VIOLATION", "storage location tenant mismatch", false);
        }
        throw error;
      }
    }
    if (input.binId) {
      if (!input.storageLocationId) {
        throw new InventoryDomainError("INVALID_DIMENSIONAL_KEY", "bin dimension requires storage location dimension", false);
      }
      try {
        this.binValidator.requireBin(input.tenantId, input.binId);
      } catch (error) {
        const crossTenantBin = findByIdentifier(this.state.bins.values(), "binId", input.binId);
        if (crossTenantBin && crossTenantBin.tenantId !== input.tenantId) {
          throw new InventoryDomainError("TENANT_ISOLATION_VIOLATION", "bin tenant mismatch", false);
        }
        throw error;
      }
      const bin = this.state.bins.get(key([input.tenantId, input.binId]));
      if (!bin || bin.storageLocationId !== input.storageLocationId) {
        throw new InventoryDomainError("INVALID_DIMENSIONAL_KEY", "bin does not belong to storage location", false);
      }
    }

    assertTenantScope(input.tenantId, [item.tenantId]);
    const quantity = createQuantityModel({
      onHandQuantity: input.initialQuantities?.onHandQuantity ?? 0,
      reservedQuantity: input.initialQuantities?.reservedQuantity ?? 0,
      allocatedQuantity: input.initialQuantities?.allocatedQuantity ?? 0,
      nonAllocatableHoldQuantity: input.initialQuantities?.nonAllocatableHoldQuantity ?? 0,
    });
    assertQuantityInvariant(quantity);

    const dimensionalKey = this.buildDimensionalKey(input);
    for (const balance of this.state.balances.values()) {
      if (balance.dimensionalKey === dimensionalKey) {
        throw new InventoryDomainError("DUPLICATE_BALANCE", "duplicate balance dimensional key", false);
      }
    }

    const version = 1;
    const record: InventoryBalanceContract = {
      inventoryBalanceId: input.inventoryBalanceId,
      inventoryItemId: input.inventoryItemId,
      tenantId: input.tenantId,
      warehouseId: input.warehouseId,
      storageLocationId: input.storageLocationId,
      binId: input.binId,
      status: input.status ?? "ACTIVE",
      onHandQuantity: quantity.onHandQuantity,
      reservedQuantity: quantity.reservedQuantity,
      allocatedQuantity: quantity.allocatedQuantity,
      nonAllocatableHoldQuantity: quantity.nonAllocatableHoldQuantity,
      availableQuantity: quantity.availableQuantity,
      metadata: metadataOrEmpty(input.metadata),
      dimensionalKey,
      version,
      versionIdentifier: toVersionIdentifier(version),
      concurrencyToken: createConcurrencyToken(`inventory-balance:${input.inventoryBalanceId}:v${version}`),
    };
    this.state.balances.set(key([input.tenantId, input.inventoryBalanceId]), record);
    await this.audit.record("inventory.balance.initialize.accepted", "inventory balance initialized", input.commandMetadata, {
      action: "INITIALIZE_INVENTORY_BALANCE",
      tenantId: input.tenantId,
      entityType: "InventoryBalance",
      entityId: input.inventoryBalanceId,
      resultingVersion: record.version,
      success: true,
    });
    return structuredClone(record);
  }

  getInventoryBalance(tenantId: TenantId, inventoryBalanceId: InventoryBalanceId): InventoryBalanceContract | undefined {
    const found = this.state.balances.get(key([tenantId, inventoryBalanceId]));
    return found ? structuredClone(found) : undefined;
  }

  listInventoryBalances(tenantId: TenantId): InventoryBalanceContract[] {
    return sortInventoryRecords(
      [...this.state.balances.values()].filter((balance) => balance.tenantId === tenantId),
      (balance) => balance.dimensionalKey,
    ).map((balance) => structuredClone(balance));
  }

  listBalancesByInventoryItem(tenantId: TenantId, inventoryItemId: InventoryItemId): InventoryBalanceContract[] {
    return sortInventoryRecords(
      [...this.state.balances.values()].filter((balance) => balance.tenantId === tenantId && balance.inventoryItemId === inventoryItemId),
      (balance) => balance.dimensionalKey,
    ).map((balance) => structuredClone(balance));
  }

  listBalancesByWarehouse(tenantId: TenantId, warehouseId: WarehouseId): InventoryBalanceContract[] {
    return sortInventoryRecords(
      [...this.state.balances.values()].filter((balance) => balance.tenantId === tenantId && balance.warehouseId === warehouseId),
      (balance) => balance.dimensionalKey,
    ).map((balance) => structuredClone(balance));
  }

  listBalancesByLocation(tenantId: TenantId, storageLocationId: StorageLocationId): InventoryBalanceContract[] {
    return sortInventoryRecords(
      [...this.state.balances.values()].filter((balance) => balance.tenantId === tenantId && balance.storageLocationId === storageLocationId),
      (balance) => balance.dimensionalKey,
    ).map((balance) => structuredClone(balance));
  }

  getAvailability(tenantId: TenantId, inventoryBalanceId: InventoryBalanceId): number | undefined {
    return this.getInventoryBalance(tenantId, inventoryBalanceId)?.availableQuantity;
  }

  async updateInventoryBalanceMetadata(input: {
    tenantId: TenantId;
    inventoryBalanceId: InventoryBalanceId;
    expectedVersion: ExpectedVersion;
    metadata: InventoryMetadata;
    commandMetadata: CommandMetadata;
  }): Promise<InventoryBalanceContract> {
    const balanceKey = key([input.tenantId, input.inventoryBalanceId]);
    const current = this.state.balances.get(balanceKey);
    if (!current) {
      throw new InventoryDomainError("INVALID_REFERENCE", "inventory balance not found", false);
    }
    assertExpectedVersionMatches(current.version, input.expectedVersion);

    const version = nextVersion(current.version);
    const updated: InventoryBalanceContract = {
      ...current,
      metadata: metadataOrEmpty(input.metadata),
      version,
      versionIdentifier: toVersionIdentifier(version),
      concurrencyToken: createConcurrencyToken(`inventory-balance:${input.inventoryBalanceId}:v${version}`),
    };
    this.state.balances.set(balanceKey, updated);
    await this.audit.record("inventory.balance.metadata.accepted", "inventory balance metadata updated", input.commandMetadata, {
      action: "UPDATE_INVENTORY_BALANCE_METADATA",
      tenantId: input.tenantId,
      entityType: "InventoryBalance",
      entityId: input.inventoryBalanceId,
      priorVersion: current.version,
      resultingVersion: updated.version,
      success: true,
    });
    return structuredClone(updated);
  }
}

export function createInventoryFoundationServices(options: {
  dependencies: InventoryRuntimeDependencies;
  validatorRegistry: InventoryReferenceValidatorRegistry;
}): InventoryFoundationServices {
  const state = createState();
  const audit = new InventoryAuditRecorder(options.dependencies);
  const warehouseService = new WarehouseService(state, audit, options.dependencies);
  const storageLocationService = new StorageLocationService(state, audit, warehouseService, options.dependencies);
  const binService = new BinService(state, audit, storageLocationService, options.dependencies);
  const inventoryItemService = new InventoryItemService(state, audit, options.validatorRegistry, options.dependencies);
  const inventoryBalanceService = new InventoryBalanceService(state, audit, warehouseService, storageLocationService, binService);

  return {
    inventoryItemService,
    warehouseService,
    storageLocationService,
    binService,
    inventoryBalanceService,
  };
}

export function createInventoryFoundationServiceRegistrationHook(options: {
  validatorRegistry: InventoryReferenceValidatorRegistry;
  queryServiceFactory: (services: InventoryFoundationServices) => unknown;
}): InventoryServiceRegistrationHook {
  return (context: InventoryRuntimeContext) => {
    const services = createInventoryFoundationServices({
      dependencies: context.dependencies,
      validatorRegistry: options.validatorRegistry,
    });
    const queryService = options.queryServiceFactory(services);

    const registrations: InventoryRuntimeServiceRegistration[] = [
      {
        serviceId: "inventory.service.bin",
        contract: "inventory.service.bin",
        description: "Slice 3 bin foundation service.",
        value: services.binService,
      },
      {
        serviceId: "inventory.service.foundation-query",
        contract: "inventory.service.foundation-query",
        description: "Slice 3 deterministic foundation query service.",
        value: queryService,
      },
      {
        serviceId: "inventory.service.inventory-balance",
        contract: "inventory.service.inventory-balance",
        description: "Slice 3 inventory balance foundation service.",
        value: services.inventoryBalanceService,
      },
      {
        serviceId: "inventory.service.inventory-item",
        contract: "inventory.service.inventory-item",
        description: "Slice 3 inventory item foundation service.",
        value: services.inventoryItemService,
      },
      {
        serviceId: "inventory.service.reference-validator-registry",
        contract: "inventory.service.reference-validator-registry",
        description: "Slice 3 bounded reference validator registry.",
        value: options.validatorRegistry,
      },
      {
        serviceId: "inventory.service.storage-location",
        contract: "inventory.service.storage-location",
        description: "Slice 3 storage location foundation service.",
        value: services.storageLocationService,
      },
      {
        serviceId: "inventory.service.warehouse",
        contract: "inventory.service.warehouse",
        description: "Slice 3 warehouse foundation service.",
        value: services.warehouseService,
      },
    ];

    for (const registration of registrations.sort((left, right) => compareDeterministicStrings(left.serviceId, right.serviceId))) {
      context.host.registerService(registration);
    }
  };
}
