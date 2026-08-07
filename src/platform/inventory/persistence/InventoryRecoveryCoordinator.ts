import { compareDeterministicStrings } from "../../shared";
import type {
  InventoryPersistenceEnvelope,
  InventoryPersistenceTenantPartition,
  InventoryPersistenceStatus,
} from "./types";
import { INVENTORY_PERSISTENCE_SCHEMA_VERSION } from "./types";

function sortPartitions(partitions: readonly InventoryPersistenceTenantPartition[]): InventoryPersistenceTenantPartition[] {
  return [...partitions].sort((left, right) => compareDeterministicStrings(left.tenantId, right.tenantId));
}

export type InventoryRecoveryCoordinatorOptions = Readonly<{
  runtimeId: string;
}>;

export class InventoryRecoveryCoordinator {
  private status: InventoryPersistenceStatus = {
    storeAvailable: true,
    schemaValid: true,
    lastLoadStatus: "UNLOADED",
    lastDurableWriteStatus: "UNKNOWN",
    lastRecoveryStatus: "UNKNOWN",
    corruptionDetected: false,
    temporaryArtifactCleanupState: "UNKNOWN",
    projectionRebuildState: "UNKNOWN",
  };

  constructor(private readonly options: InventoryRecoveryCoordinatorOptions) {}

  getStatus(): InventoryPersistenceStatus {
    return { ...this.status };
  }

  markLoaded(status: InventoryPersistenceStatus["lastLoadStatus"], reason?: string): void {
    this.status = {
      ...this.status,
      lastLoadStatus: status,
      lastRecoveryReason: reason,
    };
  }

  markRecovery(success: boolean, reason?: string): void {
    this.status = {
      ...this.status,
      lastRecoveryStatus: success ? "SUCCESS" : "FAILED",
      lastRecoveryReason: reason,
    };
  }

  markProjectionRebuild(success: boolean): void {
    this.status = {
      ...this.status,
      projectionRebuildState: success ? "REBUILT" : "FAILED",
    };
  }

  markCleanup(cleaned: boolean): void {
    this.status = {
      ...this.status,
      temporaryArtifactCleanupState: cleaned ? "RECOVERED" : "CLEAN",
    };
  }

  markDurableWrite(success: boolean): void {
    this.status = {
      ...this.status,
      lastDurableWriteStatus: success ? "SUCCESS" : "FAILED",
    };
  }

  markCorrupt(reason: string): void {
    this.status = {
      ...this.status,
      corruptionDetected: true,
      lastLoadStatus: "CORRUPT",
      lastRecoveryStatus: "FAILED",
      lastRecoveryReason: reason,
    };
  }

  createEmptyEnvelope(): InventoryPersistenceEnvelope {
    return {
      manifest: {
        schemaVersion: INVENTORY_PERSISTENCE_SCHEMA_VERSION,
        runtimeId: this.options.runtimeId,
        tenantIds: [],
      },
      tenants: [],
    };
  }

  normalizeEnvelope(envelope: InventoryPersistenceEnvelope): InventoryPersistenceEnvelope {
    return {
      manifest: {
        ...envelope.manifest,
        schemaVersion: envelope.manifest.schemaVersion ?? INVENTORY_PERSISTENCE_SCHEMA_VERSION,
        runtimeId: envelope.manifest.runtimeId ?? this.options.runtimeId,
        tenantIds: [...new Set(envelope.manifest.tenantIds)].sort(compareDeterministicStrings),
      },
      tenants: sortPartitions(envelope.tenants),
    };
  }
}
