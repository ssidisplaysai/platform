import type {
  ManufacturingPersistenceEnvelope,
  ManufacturingPersistenceManifestFile,
  ManufacturingPersistenceTenantPartition,
} from "./types";
import {
  MANUFACTURING_PERSISTENCE_PLATFORM_ID,
  MANUFACTURING_PERSISTENCE_SCHEMA_VERSION,
} from "./types";

function assertRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function assertArray(value: unknown, message: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(message);
  }
  return value;
}

export type ManufacturingPersistenceSchemaValidator = Readonly<{
  validateManifestFileOrThrow(file: ManufacturingPersistenceManifestFile): void;
  validateTenantPartitionOrThrow(partition: ManufacturingPersistenceTenantPartition): void;
  validateEnvelopeOrThrow(envelope: ManufacturingPersistenceEnvelope): void;
}>;

export function createManufacturingPersistenceSchemaValidator(): ManufacturingPersistenceSchemaValidator {
  return {
    validateManifestFileOrThrow(file): void {
      const root = assertRecord(file, "persisted manufacturing manifest file must be an object");
      const manifest = assertRecord(root.manifest, "persisted manufacturing manifest is invalid");
      if (manifest.schemaVersion !== MANUFACTURING_PERSISTENCE_SCHEMA_VERSION) {
        throw new Error(`unsupported schema version: ${String(manifest.schemaVersion)}`);
      }
      if (manifest.platformId !== MANUFACTURING_PERSISTENCE_PLATFORM_ID) {
        throw new Error(`invalid platform identifier: ${String(manifest.platformId)}`);
      }
      if (typeof manifest.runtimeId !== "string" || manifest.runtimeId.trim().length === 0) {
        throw new Error("persisted manufacturing manifest runtimeId is invalid");
      }
      assertArray(manifest.tenantIds, "persisted manufacturing manifest tenant list is invalid");
      if (typeof manifest.writtenAt !== "string") {
        throw new Error("persisted manufacturing manifest writtenAt is invalid");
      }
      if (typeof manifest.snapshotVersion !== "number") {
        throw new Error("persisted manufacturing manifest snapshotVersion is invalid");
      }
      assertRecord(root.runtimeState, "persisted manufacturing runtime state is invalid");
    },
    validateTenantPartitionOrThrow(partition): void {
      const root = assertRecord(partition, "persisted manufacturing tenant partition must be an object");
      if (typeof root.tenantId !== "string" || root.tenantId.trim().length === 0) {
        throw new Error("persisted manufacturing tenant id is invalid");
      }
      for (const key of [
        "workOrders",
        "productionRuns",
        "productionBatches",
        "executionRoutings",
        "operationExecutions",
        "materialRequirements",
        "materialIssueRequests",
        "materialReturnRecords",
        "materialConsumptionRecords",
        "productionOutputs",
        "scrapRecords",
        "reworkRecords",
        "wipStates",
        "workCenters",
        "productionCells",
        "machineAssignments",
        "toolAssignments",
        "laborAssignments",
        "downtimeRecords",
        "executionExceptions",
        "traceRecords",
      ]) {
        assertArray(root[key], `persisted manufacturing tenant collection is invalid: ${key}`);
      }
      const idempotency = assertRecord(root.idempotency, "persisted manufacturing idempotency state is invalid");
      for (const key of [
        "workOrders",
        "productionRuns",
        "productionBatches",
        "productBaselines",
        "routings",
        "operations",
        "operationInitialization",
        "materialRequirements",
        "materialIssues",
        "materialReturns",
        "materialConsumption",
        "productionOutputs",
        "scrapRecords",
        "reworkRecords",
        "workCenters",
        "productionCells",
        "machineAssignments",
        "toolAssignments",
        "laborAssignments",
        "downtimeRecords",
        "executionExceptions",
        "traceRecords",
      ]) {
        assertArray(idempotency[key], `persisted manufacturing idempotency collection is invalid: ${key}`);
      }
    },
    validateEnvelopeOrThrow(envelope): void {
      this.validateManifestFileOrThrow({ manifest: envelope.manifest, runtimeState: envelope.runtimeState });
      assertArray(envelope.tenants, "persisted manufacturing tenants are invalid");
      for (const partition of envelope.tenants) {
        this.validateTenantPartitionOrThrow(partition);
      }
    },
  };
}
