import { compareDeterministicStrings } from "../../shared";
import type {
  InventoryPersistenceEnvelope,
  InventoryPersistenceManifest,
  InventoryPersistenceTenantPartition,
} from "./types";
import { INVENTORY_PERSISTENCE_SCHEMA_VERSION } from "./types";

function sortTenantPartitions(partitions: readonly InventoryPersistenceTenantPartition[]): InventoryPersistenceTenantPartition[] {
  return [...partitions].sort((left, right) => compareDeterministicStrings(left.tenantId, right.tenantId));
}

export function createDefaultInventoryPersistenceEnvelope(runtimeId: string): InventoryPersistenceEnvelope {
  return {
    manifest: {
      schemaVersion: INVENTORY_PERSISTENCE_SCHEMA_VERSION,
      runtimeId,
      tenantIds: [],
    },
    tenants: [],
  };
}

export function normalizeInventoryPersistenceEnvelope(raw: unknown, runtimeId: string): InventoryPersistenceEnvelope {
  if (!raw || typeof raw !== "object") {
    throw new Error("persisted inventory envelope must be an object");
  }

  const candidate = raw as Partial<InventoryPersistenceEnvelope>;
  const manifest = candidate.manifest as Partial<InventoryPersistenceManifest> | undefined;
  if (!manifest || typeof manifest !== "object") {
    throw new Error("persisted inventory manifest is invalid");
  }
  if (manifest.schemaVersion !== INVENTORY_PERSISTENCE_SCHEMA_VERSION) {
    throw new Error(`unsupported schema version: ${manifest.schemaVersion}`);
  }
  if (typeof manifest.runtimeId !== "string") {
    throw new Error("persisted inventory manifest is invalid");
  }
  if (!Array.isArray(manifest.tenantIds)) {
    throw new Error("persisted inventory manifest tenant list is invalid");
  }
  if (!Array.isArray(candidate.tenants)) {
    throw new Error("persisted inventory tenants are invalid");
  }

  return {
    manifest: {
      schemaVersion: manifest.schemaVersion,
      runtimeId: manifest.runtimeId ?? runtimeId,
      tenantIds: [...manifest.tenantIds].sort(compareDeterministicStrings),
      lastLoadedAt: manifest.lastLoadedAt,
      lastDurableWriteAt: manifest.lastDurableWriteAt,
      lastRecoveryAt: manifest.lastRecoveryAt,
      lastRecoveryReason: manifest.lastRecoveryReason,
    },
    tenants: sortTenantPartitions(candidate.tenants as InventoryPersistenceTenantPartition[]),
  };
}

export function serializeInventoryPersistenceEnvelope(envelope: InventoryPersistenceEnvelope): string {
  return JSON.stringify(
    {
      manifest: {
        ...envelope.manifest,
        tenantIds: [...envelope.manifest.tenantIds].sort(compareDeterministicStrings),
      },
      tenants: sortTenantPartitions(envelope.tenants),
    },
    null,
    2,
  );
}

export function cloneInventoryPersistenceEnvelope(envelope: InventoryPersistenceEnvelope): InventoryPersistenceEnvelope {
  return structuredClone(envelope);
}
