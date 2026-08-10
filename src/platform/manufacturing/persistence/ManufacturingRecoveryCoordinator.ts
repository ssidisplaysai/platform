import type {
  ManufacturingPersistenceEnvelope,
  ManufacturingPersistenceMetrics,
  ManufacturingPersistenceStatus,
} from "./types";
import { createDefaultManufacturingPersistenceEnvelope } from "./serialization";

function createDefaultStatus(durablePersistenceConfigured: boolean): ManufacturingPersistenceStatus {
  return {
    initialized: false,
    durabilityMode: durablePersistenceConfigured ? "DURABLE_CONFIGURED" : "EPHEMERAL_UNCONFIGURED",
    durablePersistenceConfigured,
    storeAvailable: true,
    schemaValid: true,
    persistedStateValid: true,
    lastLoadStatus: "UNLOADED",
    lastDurableWriteStatus: "UNKNOWN",
    lastRecoveryStatus: "UNKNOWN",
    projectionRebuildState: "UNKNOWN",
    cleanupState: "UNKNOWN",
  };
}

function createDefaultMetrics(): ManufacturingPersistenceMetrics {
  return {
    persistenceWriteCount: 0,
    persistenceWriteFailureCount: 0,
    persistenceReadCount: 0,
    persistenceReadFailureCount: 0,
    recoveryCount: 0,
    recoveryFailureCount: 0,
    schemaRejectionCount: 0,
    corruptStateRejectionCount: 0,
    tenantMismatchRecoveryCount: 0,
    projectionRebuildCount: 0,
    projectionRebuildFailureCount: 0,
  };
}

export class ManufacturingRecoveryCoordinator {
  private status: ManufacturingPersistenceStatus;
  private metrics = createDefaultMetrics();

  constructor(private readonly runtimeId: string, durablePersistenceConfigured: boolean) {
    this.status = createDefaultStatus(durablePersistenceConfigured);
  }

  getStatus(): ManufacturingPersistenceStatus {
    return { ...this.status };
  }

  getMetrics(): ManufacturingPersistenceMetrics {
    return { ...this.metrics };
  }

  createFirstRunEnvelope(writtenAt: string): ManufacturingPersistenceEnvelope {
    return createDefaultManufacturingPersistenceEnvelope(this.runtimeId, writtenAt);
  }

  markInitialized(): void {
    this.status = { ...this.status, initialized: true };
  }

  markCleanup(state: ManufacturingPersistenceStatus["cleanupState"]): void {
    this.status = { ...this.status, cleanupState: state };
  }

  markLoad(status: ManufacturingPersistenceStatus["lastLoadStatus"], timestamp: string, reason?: string): void {
    this.status = {
      ...this.status,
      lastLoadStatus: status,
      lastLoadAt: timestamp,
      lastErrorMessage: reason,
    };
    this.metrics = {
      ...this.metrics,
      persistenceReadCount: this.metrics.persistenceReadCount + 1,
      persistenceReadFailureCount:
        this.metrics.persistenceReadFailureCount + (status === "CORRUPT" || status === "UNSUPPORTED_SCHEMA" || status === "TENANT_MISMATCH" ? 1 : 0),
      schemaRejectionCount: this.metrics.schemaRejectionCount + (status === "UNSUPPORTED_SCHEMA" ? 1 : 0),
      corruptStateRejectionCount: this.metrics.corruptStateRejectionCount + (status === "CORRUPT" ? 1 : 0),
      tenantMismatchRecoveryCount: this.metrics.tenantMismatchRecoveryCount + (status === "TENANT_MISMATCH" ? 1 : 0),
    };
  }

  markRecovery(success: boolean, timestamp: string, classification?: string, message?: string): void {
    this.status = {
      ...this.status,
      lastRecoveryStatus: success ? "SUCCESS" : "FAILED",
      lastRecoveryAt: timestamp,
      lastErrorClassification: classification,
      lastErrorMessage: message,
      persistedStateValid: success,
    };
    this.metrics = {
      ...this.metrics,
      recoveryCount: this.metrics.recoveryCount + 1,
      recoveryFailureCount: this.metrics.recoveryFailureCount + (success ? 0 : 1),
    };
  }

  markWrite(success: boolean, timestamp: string, classification?: string, message?: string): void {
    this.status = {
      ...this.status,
      lastDurableWriteStatus: success ? "SUCCESS" : "FAILED",
      lastSaveAt: timestamp,
      lastErrorClassification: classification,
      lastErrorMessage: message,
    };
    this.metrics = {
      ...this.metrics,
      persistenceWriteCount: this.metrics.persistenceWriteCount + (success ? 1 : 0),
      persistenceWriteFailureCount: this.metrics.persistenceWriteFailureCount + (success ? 0 : 1),
    };
  }

  markProjectionRebuild(success: boolean): void {
    this.status = {
      ...this.status,
      projectionRebuildState: success ? "REBUILT" : "FAILED",
    };
    this.metrics = {
      ...this.metrics,
      projectionRebuildCount: this.metrics.projectionRebuildCount + 1,
      projectionRebuildFailureCount: this.metrics.projectionRebuildFailureCount + (success ? 0 : 1),
    };
  }

  markSchemaInvalid(message: string): void {
    this.status = {
      ...this.status,
      schemaValid: false,
      persistedStateValid: false,
      lastErrorClassification: "UNSUPPORTED_PERSISTENCE_SCHEMA",
      lastErrorMessage: message,
    };
  }

  markCorrupt(classification: string, message: string): void {
    this.status = {
      ...this.status,
      schemaValid: false,
      persistedStateValid: false,
      lastErrorClassification: classification,
      lastErrorMessage: message,
    };
  }
}
