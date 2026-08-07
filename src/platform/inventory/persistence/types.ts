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
  WarehouseContract,
  TenantId,
} from "../contracts";
import type { InventoryRuntimeAuditRecord } from "../integration";

export const INVENTORY_PERSISTENCE_SCHEMA_VERSION = "1.0.0" as const;

export type InventoryPersistenceSchemaVersion = typeof INVENTORY_PERSISTENCE_SCHEMA_VERSION;

export type InventoryPersistenceStatus = Readonly<{
  storeAvailable: boolean;
  schemaValid: boolean;
  lastLoadStatus: "UNLOADED" | "LOADED" | "FIRST_RUN" | "CORRUPT" | "UNSUPPORTED_SCHEMA";
  lastDurableWriteStatus: "UNKNOWN" | "SUCCESS" | "FAILED";
  lastRecoveryStatus: "UNKNOWN" | "SUCCESS" | "FAILED";
  corruptionDetected: boolean;
  temporaryArtifactCleanupState: "UNKNOWN" | "CLEAN" | "RECOVERED";
  projectionRebuildState: "UNKNOWN" | "REBUILT" | "FAILED";
  lastRecoveryReason?: string;
}>;

export type InventoryPersistenceMetrics = Readonly<{
  persistenceLoadCount: number;
  persistenceWriteCount: number;
  persistenceWriteFailureCount: number;
  recoveryCount: number;
  recoveryFailureCount: number;
  corruptStateCount: number;
  unsupportedSchemaCount: number;
  projectionRebuildCount: number;
  temporaryArtifactRecoveryCount: number;
}>;

export type InventoryFoundationStateSnapshot = Readonly<{
  inventoryItems: readonly InventoryItemContract[];
  warehouses: readonly WarehouseContract[];
  storageLocations: readonly StorageLocationContract[];
  bins: readonly BinContract[];
  balances: readonly InventoryBalanceContract[];
}>;

export type InventoryMovementStateSnapshot = Readonly<{
  movements: readonly MovementContract[];
  ledgerEntries: readonly LedgerEntryContract[];
  movementLedgerIds: Readonly<Record<string, readonly string[]>>;
  idempotency: readonly {
    tenantId: TenantId;
    idempotencyKey: string;
    fingerprint: string;
    movementId: string;
    recordedAt: string;
  }[];
  sequence: number;
}>;

export type InventorySlice5StateSnapshot = Readonly<{
  reservations: readonly ReservationContract[];
  allocations: readonly AllocationContract[];
  idempotency: readonly {
    tenantId: TenantId;
    idempotencyKey: string;
    fingerprint: string;
    replayType: "reservation" | "allocation";
    replayId: string;
    recordedAt: string;
  }[];
}>;

export type InventorySlice6StateSnapshot = Readonly<{
  lots: readonly LotContract[];
  serials: readonly SerialNumberContract[];
  expirations: readonly ExpirationRecordContract[];
  idempotency: readonly {
    tenantId: TenantId;
    idempotencyKey: string;
    fingerprint: string;
    replayType: "lot" | "serial" | "expiration";
    replayId: string;
    recordedAt: string;
  }[];
}>;

export type InventoryPersistenceTenantPartition = Readonly<{
  tenantId: TenantId;
  foundation: InventoryFoundationStateSnapshot;
  movement: InventoryMovementStateSnapshot;
  slice5: InventorySlice5StateSnapshot;
  slice6: InventorySlice6StateSnapshot;
  auditEvents: readonly InventoryRuntimeAuditRecord[];
}>;

export type InventoryPersistenceManifest = Readonly<{
  schemaVersion: InventoryPersistenceSchemaVersion;
  runtimeId: string;
  tenantIds: readonly TenantId[];
  lastLoadedAt?: string;
  lastDurableWriteAt?: string;
  lastRecoveryAt?: string;
  lastRecoveryReason?: string;
}>;

export type InventoryPersistenceEnvelope = Readonly<{
  manifest: InventoryPersistenceManifest;
  tenants: readonly InventoryPersistenceTenantPartition[];
}>;
