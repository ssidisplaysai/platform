export type Branded<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type TenantId = Branded<string, "TenantId">;

export type InventoryItemId = Branded<string, "InventoryItemId">;
export type InventoryBalanceId = Branded<string, "InventoryBalanceId">;
export type WarehouseId = Branded<string, "WarehouseId">;
export type StorageLocationId = Branded<string, "StorageLocationId">;
export type BinId = Branded<string, "BinId">;
export type ReservationId = Branded<string, "ReservationId">;
export type AllocationId = Branded<string, "AllocationId">;
export type MovementId = Branded<string, "MovementId">;
export type LedgerEntryId = Branded<string, "LedgerEntryId">;
export type LotId = Branded<string, "LotId">;
export type SerialNumberId = Branded<string, "SerialNumberId">;
export type ExpirationRecordId = Branded<string, "ExpirationRecordId">;
export type ReorderPolicyId = Branded<string, "ReorderPolicyId">;

export type ProductReferenceId = Branded<string, "ProductReferenceId">;
export type ProductVariantReferenceId = Branded<string, "ProductVariantReferenceId">;
export type OrganizationReferenceId = Branded<string, "OrganizationReferenceId">;
export type DocumentReferenceId = Branded<string, "DocumentReferenceId">;
export type KnowledgeReferenceId = Branded<string, "KnowledgeReferenceId">;
export type AssetReferenceId = Branded<string, "AssetReferenceId">;
export type CommerceOrderReferenceId = Branded<string, "CommerceOrderReferenceId">;
export type ManufacturingWorkOrderReferenceId = Branded<string, "ManufacturingWorkOrderReferenceId">;
export type FinanceClassificationReferenceId = Branded<string, "FinanceClassificationReferenceId">;

export type VersionIdentifier = Branded<string, "VersionIdentifier">;
export type InventorySchemaVersion = Branded<string, "InventorySchemaVersion">;
export type ConcurrencyToken = Branded<string, "ConcurrencyToken">;
export type IdempotencyKey = Branded<string, "IdempotencyKey">;
export type ExpectedVersion = Branded<number, "ExpectedVersion">;

export type InventoryMetadataValue = string | number | boolean | null;
export type InventoryMetadata = Readonly<Record<string, InventoryMetadataValue>>;
export type InventoryLocationType = "RECEIVING" | "STORAGE" | "PICKING" | "STAGING" | "QUARANTINE" | "TRANSFER" | "VIRTUAL";
export type InventoryBalanceStatus = "ACTIVE" | "INACTIVE" | "QUARANTINED";

export type InventoryLifecycleState =
  | "DRAFT"
  | "ACTIVE"
  | "RESTRICTED"
  | "SUSPENDED"
  | "ARCHIVED";

export type MovementType =
  | "RECEIVE"
  | "PUT_AWAY"
  | "PICK"
  | "PACK"
  | "SHIP"
  | "CONSUME"
  | "RETURN"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "ADJUST_INCREASE"
  | "ADJUST_DECREASE"
  | "RECONCILE"
  | "INTERNAL_MOVE"
  | "QUARANTINE"
  | "RELEASE_FROM_QUARANTINE"
  | "EXPIRE"
  | "WRITE_OFF"
  | "DISPOSE";

export type InventoryMovementReason = string;
export type InventoryLedgerEntryType = "SOURCE" | "DESTINATION" | "ADJUSTMENT" | "WRITE_OFF" | "QUARANTINE" | "RELEASE";

export type ReservationStatus =
  | "PENDING"
  | "ACTIVE"
  | "PARTIALLY_RELEASED"
  | "RELEASED"
  | "EXPIRED"
  | "CANCELLED"
  | "FULFILLED";

export type AllocationStatus =
  | "PENDING"
  | "ACTIVE"
  | "PARTIALLY_RELEASED"
  | "RELEASED"
  | "CANCELLED"
  | "FULFILLED"
  ;

export type WarehouseStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type LocationStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "RECEIVING"
  | "PICKING"
  | "STAGING"
  | "QUARANTINE"
  | "ARCHIVED";

export type LotStatus = "CREATED" | "ACTIVE" | "QUARANTINED" | "EXPIRED" | "DISPOSED";
export type LotQuantityTrackingMode = "BALANCE_SCOPED" | "LOCATION_SCOPED";

export type SerialStatus =
  | "CREATED"
  | "ACTIVE"
  | "QUARANTINED"
  | "RESERVED"
  | "ALLOCATED"
  | "SHIPPED_OR_CONSUMED"
  | "RETIRED";

export type ExpirationState = "VALID" | "NEAR_EXPIRY" | "EXPIRED" | "QUARANTINED" | "RETIRED";

export type InventoryFailureClassification =
  | "INVALID_COMMAND"
  | "INVALID_RESERVATION_COMMAND"
  | "INVALID_ALLOCATION_COMMAND"
  | "INVALID_LOT_COMMAND"
  | "INVALID_SERIAL_COMMAND"
  | "INVALID_QUANTITY"
  | "INVALID_RELEASE_QUANTITY"
  | "INVALID_CONVERSION_QUANTITY"
  | "INVALID_REFERENCE"
  | "INVALID_MOVEMENT_COMMAND"
  | "INVALID_MOVEMENT_TYPE"
  | "INVALID_WAREHOUSE"
  | "INVALID_BIN_PARENT"
  | "INVALID_LOCATION_PARENT"
  | "INVALID_DIMENSIONAL_KEY"
  | "INVALID_BALANCE"
  | "INVALID_RESERVATION"
  | "INVALID_ALLOCATION"
  | "CONCURRENCY_CONFLICT"
  | "STALE_EXPECTED_VERSION"
  | "STALE_RESERVATION_VERSION"
  | "STALE_ALLOCATION_VERSION"
  | "STALE_BALANCE_VERSION"
  | "MISSING_REQUIRED_VALIDATOR"
  | "DUPLICATE_IDEMPOTENCY_KEY"
  | "CONFLICTING_IDEMPOTENCY_PAYLOAD"
  | "DUPLICATE_MOVEMENT"
  | "DUPLICATE_MOVEMENT_ID"
  | "DUPLICATE_LEDGER_ID"
  | "DUPLICATE_INVENTORY_ITEM"
  | "DUPLICATE_PRODUCT_REFERENCE"
  | "INVALID_PRODUCT_REFERENCE"
  | "DUPLICATE_WAREHOUSE_CODE"
  | "DUPLICATE_LOCATION_CODE"
  | "DUPLICATE_BIN_CODE"
  | "DUPLICATE_BALANCE"
  | "DUPLICATE_RESERVATION_ID"
  | "DUPLICATE_ALLOCATION_ID"
  | "DUPLICATE_LOT_ID"
  | "DUPLICATE_LOT_CODE"
  | "DUPLICATE_SERIAL_ID"
  | "DUPLICATE_SERIAL_CODE"
  | "INVENTORY_ITEM_MISMATCH"
  | "INVALID_LOT_SERIAL_ASSOCIATION"
  | "SERIAL_ALREADY_ACTIVE_ELSEWHERE"
  | "INVALID_EXPIRATION_DATES"
  | "EXPIRED_ENTITY_RELEASE_PROHIBITED"
  | "QUANTITY_INCONSISTENCY"
  | "PROHIBITED_SELF_MOVEMENT"
  | "INSUFFICIENT_QUANTITY"
  | "INSUFFICIENT_RESERVABLE_QUANTITY"
  | "INSUFFICIENT_ALLOCATABLE_QUANTITY"
  | "OVER_RESERVATION"
  | "OVER_ALLOCATION"
  | "LEDGER_INTEGRITY_VIOLATION"
  | "APPEND_ONLY_VIOLATION"
  | "ATOMICITY_FAILURE"
  | "INSUFFICIENT_AVAILABILITY"
  | "RESERVATION_CONFLICT"
  | "ALLOCATION_CONFLICT"
  | "EXPIRED_RESERVATION"
  | "TERMINAL_RESERVATION_MUTATION"
  | "TERMINAL_ALLOCATION_MUTATION"
  | "INVALID_LOCATION"
  | "INVALID_LOT"
  | "INVALID_SERIAL"
  | "EXPIRED_STOCK"
  | "TENANT_ISOLATION_VIOLATION"
  | "UNIQUE_CONSTRAINT_VIOLATION"
  | "IMMUTABLE_IDENTITY_VIOLATION"
  | "VERSION_MONOTONICITY_VIOLATION"
  | "LEDGER_APPEND_ONLY_VIOLATION"
  | "RECURSIVE_CONTAINMENT_VIOLATION";

export type CommandMetadata = Readonly<{
  commandId: Branded<string, "CommandId">;
  correlationId?: Branded<string, "CorrelationId">;
  causationId?: Branded<string, "CausationId">;
  expectedVersion: ExpectedVersion;
  idempotencyKey: IdempotencyKey;
  requestedAt: string;
}>;

export type AuditMetadata = Readonly<{
  actorId: Branded<string, "ActorId">;
  source?: string;
  reason?: string;
  occurredAt: string;
}>;

export type InventoryHealthModel = Readonly<{
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  generatedAt: string;
  checks: ReadonlyArray<
    Readonly<{
      name:
        | "runtime"
        | "persistence"
        | "references"
        | "invariants"
        | "concurrency"
        | "idempotency"
        | "observability";
      status: "PASS" | "WARN" | "FAIL";
      detail: string;
    }>
  >;
}>;

export type InventoryMetricsModel = Readonly<{
  commandsAccepted: number;
  commandsRejected: number;
  movementCount: number;
  reservationCount: number;
  allocationCount: number;
  lowStockCount: number;
  expiredStockCount: number;
  quarantinedStockCount: number;
  concurrencyConflictCount: number;
  idempotencyRejectionCount: number;
  failedReferenceCount: number;
}>;

export type InventoryItemContract = Readonly<{
  inventoryItemId: InventoryItemId;
  tenantId: TenantId;
  productReferenceId: ProductReferenceId;
  productVariantReferenceId?: ProductVariantReferenceId;
  lifecycleState: InventoryLifecycleState;
  unitOfMeasure: string;
  metadata: InventoryMetadata;
  version: number;
  publishedIdentifier: Branded<string, "InventoryItemPublishedIdentifier">;
  versionIdentifier: VersionIdentifier;
}>;

export type InventoryBalanceContract = Readonly<{
  inventoryBalanceId: InventoryBalanceId;
  inventoryItemId: InventoryItemId;
  tenantId: TenantId;
  warehouseId: WarehouseId;
  storageLocationId?: StorageLocationId;
  binId?: BinId;
  status: InventoryBalanceStatus;
  lotId?: LotId;
  serialNumberId?: SerialNumberId;
  onHandQuantity: number;
  reservedQuantity: number;
  allocatedQuantity: number;
  nonAllocatableHoldQuantity: number;
  availableQuantity: number;
  metadata: InventoryMetadata;
  dimensionalKey: string;
  version: number;
  versionIdentifier: VersionIdentifier;
  concurrencyToken: ConcurrencyToken;
}>;

export type WarehouseContract = Readonly<{
  warehouseId: WarehouseId;
  tenantId: TenantId;
  warehouseCode: string;
  status: WarehouseStatus;
  metadata: InventoryMetadata;
  version: number;
  publishedIdentifier: Branded<string, "WarehousePublishedIdentifier">;
  versionIdentifier: VersionIdentifier;
}>;

export type StorageLocationContract = Readonly<{
  storageLocationId: StorageLocationId;
  warehouseId: WarehouseId;
  tenantId: TenantId;
  locationCode: string;
  locationType: InventoryLocationType;
  status: LocationStatus;
  parentLocationId?: StorageLocationId;
  metadata: InventoryMetadata;
  version: number;
  publishedIdentifier: Branded<string, "StorageLocationPublishedIdentifier">;
  versionIdentifier: VersionIdentifier;
}>;

export type BinContract = Readonly<{
  binId: BinId;
  storageLocationId: StorageLocationId;
  tenantId: TenantId;
  binCode: string;
  status: LocationStatus;
  metadata: InventoryMetadata;
  version: number;
  publishedIdentifier: Branded<string, "BinPublishedIdentifier">;
  versionIdentifier: VersionIdentifier;
}>;

export type ReservationContract = Readonly<{
  reservationId: ReservationId;
  inventoryBalanceId: InventoryBalanceId;
  inventoryItemId: InventoryItemId;
  tenantId: TenantId;
  status: ReservationStatus;
  requestedQuantity: number;
  reservedQuantity: number;
  remainingQuantity: number;
  warehouseId?: WarehouseId;
  storageLocationId?: StorageLocationId;
  externalRequestReference?: string;
  idempotencyKey: IdempotencyKey;
  version: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type AllocationContract = Readonly<{
  allocationId: AllocationId;
  inventoryBalanceId: InventoryBalanceId;
  reservationId?: ReservationId;
  inventoryItemId: InventoryItemId;
  tenantId: TenantId;
  status: AllocationStatus;
  allocatedQuantity: number;
  remainingQuantity: number;
  warehouseId?: WarehouseId;
  storageLocationId?: StorageLocationId;
  binId?: BinId;
  externalRequestReference?: string;
  idempotencyKey: IdempotencyKey;
  version: number;
  createdAt: string;
  updatedAt: string;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type MovementContract = Readonly<{
  movementId: MovementId;
  tenantId: TenantId;
  movementType: MovementType;
  reason: InventoryMovementReason;
  inventoryItemId: InventoryItemId;
  quantity: number;
  sourceBalanceId?: InventoryBalanceId;
  sourceWarehouseId?: WarehouseId;
  sourceStorageLocationId?: StorageLocationId;
  sourceBinId?: BinId;
  destinationBalanceId?: InventoryBalanceId;
  destinationWarehouseId?: WarehouseId;
  destinationStorageLocationId?: StorageLocationId;
  destinationBinId?: BinId;
  lotId?: LotId;
  serialNumberId?: SerialNumberId;
  expectedSourceVersion?: ExpectedVersion;
  expectedDestinationVersion?: ExpectedVersion;
  resultingSourceVersion?: number;
  resultingDestinationVersion?: number;
  ledgerEntryIds: readonly LedgerEntryId[];
  createdAt: string;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
}>;

export type LedgerEntryContract = Readonly<{
  ledgerEntryId: LedgerEntryId;
  movementId: MovementId;
  tenantId: TenantId;
  inventoryItemId: InventoryItemId;
  affectedBalanceId: InventoryBalanceId;
  entryType: InventoryLedgerEntryType;
  sequence: number;
  orderingKey: string;
  occurredAt: string;
  movementType: MovementType;
  correlationId?: CommandMetadata["correlationId"];
  quantityDelta: number;
  onHandBefore: number;
  onHandAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  allocatedBefore: number;
  allocatedAfter: number;
  availableBefore: number;
  availableAfter: number;
  auditEventType: string;
}>;

export type LotContract = Readonly<{
  lotId: LotId;
  tenantId: TenantId;
  inventoryItemId: InventoryItemId;
  productReferenceId: ProductReferenceId;
  productVariantReferenceId?: ProductVariantReferenceId;
  lotCode: string;
  status: LotStatus;
  manufactureDate?: string;
  bestBeforeDate?: string;
  expirationDate?: string;
  quantityTrackingMode: LotQuantityTrackingMode;
  trackedQuantity: number;
  warehouseId?: WarehouseId;
  storageLocationId?: StorageLocationId;
  inventoryBalanceId?: InventoryBalanceId;
  version: number;
  createdAt: string;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
  publishedIdentifier: Branded<string, "LotPublishedIdentifier">;
  versionIdentifier: VersionIdentifier;
}>;

export type SerialNumberContract = Readonly<{
  serialNumberId: SerialNumberId;
  tenantId: TenantId;
  inventoryItemId: InventoryItemId;
  serialCode: string;
  status: SerialStatus;
  inventoryBalanceId?: InventoryBalanceId;
  storageLocationId?: StorageLocationId;
  lotId?: LotId;
  version: number;
  createdAt: string;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
  lastMovementReferenceId?: MovementId;
  publishedIdentifier: Branded<string, "SerialPublishedIdentifier">;
  versionIdentifier: VersionIdentifier;
}>;

export type ExpirationRecordContract = Readonly<{
  expirationRecordId: ExpirationRecordId;
  tenantId: TenantId;
  inventoryItemId: InventoryItemId;
  lotId?: LotId;
  serialNumberId?: SerialNumberId;
  manufactureDate?: string;
  bestBeforeDate?: string;
  expirationDate?: string;
  state: ExpirationState;
  evaluatedAt: string;
  version: number;
  commandMetadata: CommandMetadata;
  auditMetadata: AuditMetadata;
  versionIdentifier: VersionIdentifier;
}>;

export type ReorderPolicyContract = Readonly<{
  reorderPolicyId: ReorderPolicyId;
  tenantId: TenantId;
  inventoryItemId: InventoryItemId;
  reorderPointQuantity: number;
  safetyStockQuantity: number;
  effectiveFrom: string;
  effectiveTo?: string;
  versionIdentifier: VersionIdentifier;
}>;
