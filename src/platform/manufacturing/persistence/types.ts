import type { TenantId } from "../contracts";
import type {
  ManufacturingReferenceFamily,
  ManufacturingReferenceValidationMetrics,
  ManufacturingReferenceValidationStatus,
} from "../services/ManufacturingReferenceValidationService";

export const MANUFACTURING_PERSISTENCE_SCHEMA_VERSION = "1.0.0" as const;
export const MANUFACTURING_PERSISTENCE_PLATFORM_ID = "platform.manufacturing" as const;

export type ManufacturingPersistenceSchemaVersion = typeof MANUFACTURING_PERSISTENCE_SCHEMA_VERSION;
export type ManufacturingPersistencePlatformId = typeof MANUFACTURING_PERSISTENCE_PLATFORM_ID;

export type ManufacturingPersistenceMapEntry = Readonly<{
  key: string;
  value: unknown;
}>;

export type ManufacturingPersistenceRecord = Readonly<Record<string, unknown>>;

export type ManufacturingPersistenceTenantIdempotency = Readonly<{
  workOrders: readonly ManufacturingPersistenceMapEntry[];
  productionRuns: readonly ManufacturingPersistenceMapEntry[];
  productionBatches: readonly ManufacturingPersistenceMapEntry[];
  productBaselines: readonly ManufacturingPersistenceMapEntry[];
  routings: readonly ManufacturingPersistenceMapEntry[];
  operations: readonly ManufacturingPersistenceMapEntry[];
  operationInitialization: readonly ManufacturingPersistenceMapEntry[];
  materialRequirements: readonly ManufacturingPersistenceMapEntry[];
  materialIssues: readonly ManufacturingPersistenceMapEntry[];
  materialReturns: readonly ManufacturingPersistenceMapEntry[];
  materialConsumption: readonly ManufacturingPersistenceMapEntry[];
  productionOutputs: readonly ManufacturingPersistenceMapEntry[];
  scrapRecords: readonly ManufacturingPersistenceMapEntry[];
  reworkRecords: readonly ManufacturingPersistenceMapEntry[];
  workCenters: readonly ManufacturingPersistenceMapEntry[];
  productionCells: readonly ManufacturingPersistenceMapEntry[];
  machineAssignments: readonly ManufacturingPersistenceMapEntry[];
  toolAssignments: readonly ManufacturingPersistenceMapEntry[];
  laborAssignments: readonly ManufacturingPersistenceMapEntry[];
  downtimeRecords: readonly ManufacturingPersistenceMapEntry[];
  executionExceptions: readonly ManufacturingPersistenceMapEntry[];
  traceRecords: readonly ManufacturingPersistenceMapEntry[];
}>;

export type ManufacturingPersistenceTenantPartition = Readonly<{
  tenantId: TenantId;
  workOrders: readonly ManufacturingPersistenceRecord[];
  productionRuns: readonly ManufacturingPersistenceRecord[];
  productionBatches: readonly ManufacturingPersistenceRecord[];
  executionRoutings: readonly ManufacturingPersistenceRecord[];
  operationExecutions: readonly ManufacturingPersistenceRecord[];
  materialRequirements: readonly ManufacturingPersistenceRecord[];
  materialIssueRequests: readonly ManufacturingPersistenceRecord[];
  materialReturnRecords: readonly ManufacturingPersistenceRecord[];
  materialConsumptionRecords: readonly ManufacturingPersistenceRecord[];
  productionOutputs: readonly ManufacturingPersistenceRecord[];
  scrapRecords: readonly ManufacturingPersistenceRecord[];
  reworkRecords: readonly ManufacturingPersistenceRecord[];
  wipStates: readonly ManufacturingPersistenceRecord[];
  workCenters: readonly ManufacturingPersistenceRecord[];
  productionCells: readonly ManufacturingPersistenceRecord[];
  machineAssignments: readonly ManufacturingPersistenceRecord[];
  toolAssignments: readonly ManufacturingPersistenceRecord[];
  laborAssignments: readonly ManufacturingPersistenceRecord[];
  downtimeRecords: readonly ManufacturingPersistenceRecord[];
  executionExceptions: readonly ManufacturingPersistenceRecord[];
  traceRecords: readonly ManufacturingPersistenceRecord[];
  idempotency: ManufacturingPersistenceTenantIdempotency;
}>;

export type ManufacturingRuntimePersistenceState = Readonly<{
  auditEvents: readonly ManufacturingPersistenceRecord[];
  auditSequence: number;
  referenceMetrics: ManufacturingReferenceValidationMetrics;
  referenceLastStatusByFamily: Readonly<Record<ManufacturingReferenceFamily, ManufacturingReferenceValidationStatus>>;
}>;

export type ManufacturingPersistenceStatus = Readonly<{
  initialized: boolean;
  durabilityMode: "DURABLE_CONFIGURED" | "EPHEMERAL_UNCONFIGURED";
  durablePersistenceConfigured: boolean;
  storeAvailable: boolean;
  schemaValid: boolean;
  persistedStateValid: boolean;
  lastLoadStatus:
    | "UNLOADED"
    | "FIRST_RUN_EMPTY"
    | "LOADED"
    | "CORRUPT"
    | "UNSUPPORTED_SCHEMA"
    | "TENANT_MISMATCH";
  lastDurableWriteStatus: "UNKNOWN" | "SUCCESS" | "FAILED";
  lastRecoveryStatus: "UNKNOWN" | "SUCCESS" | "FAILED";
  lastSaveAt?: string;
  lastLoadAt?: string;
  lastRecoveryAt?: string;
  lastErrorClassification?: string;
  lastErrorMessage?: string;
  projectionRebuildState: "UNKNOWN" | "REBUILT" | "FAILED";
  cleanupState: "UNKNOWN" | "CLEAN" | "RECOVERED";
}>;

export type ManufacturingPersistenceMetrics = Readonly<{
  persistenceWriteCount: number;
  persistenceWriteFailureCount: number;
  persistenceReadCount: number;
  persistenceReadFailureCount: number;
  recoveryCount: number;
  recoveryFailureCount: number;
  schemaRejectionCount: number;
  corruptStateRejectionCount: number;
  tenantMismatchRecoveryCount: number;
  projectionRebuildCount: number;
  projectionRebuildFailureCount: number;
}>;

export type ManufacturingPersistenceManifest = Readonly<{
  schemaVersion: ManufacturingPersistenceSchemaVersion;
  platformId: ManufacturingPersistencePlatformId;
  runtimeId: string;
  tenantIds: readonly TenantId[];
  writtenAt: string;
  snapshotVersion: number;
  recoveryMetadata: Readonly<{
    lastLoadStatus?: ManufacturingPersistenceStatus["lastLoadStatus"];
    lastDurableWriteStatus?: ManufacturingPersistenceStatus["lastDurableWriteStatus"];
    lastRecoveryStatus?: ManufacturingPersistenceStatus["lastRecoveryStatus"];
    lastRecoveryAt?: string;
    lastRecoveryReason?: string;
  }>;
}>;

export type ManufacturingPersistenceEnvelope = Readonly<{
  manifest: ManufacturingPersistenceManifest;
  runtimeState: ManufacturingRuntimePersistenceState;
  tenants: readonly ManufacturingPersistenceTenantPartition[];
}>;

export type ManufacturingPersistenceManifestFile = Readonly<{
  manifest: ManufacturingPersistenceManifest;
  runtimeState: ManufacturingRuntimePersistenceState;
}>;

export type ManufacturingPersistenceConfiguration = Readonly<{
  rootDir?: string;
}>;
