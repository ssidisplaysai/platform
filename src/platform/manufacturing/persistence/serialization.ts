import { compareDeterministicStrings } from "../../shared";
import type {
  ManufacturingPersistenceEnvelope,
  ManufacturingPersistenceManifest,
  ManufacturingPersistenceManifestFile,
  ManufacturingPersistenceMapEntry,
  ManufacturingPersistenceRecord,
  ManufacturingPersistenceTenantIdempotency,
  ManufacturingPersistenceTenantPartition,
  ManufacturingRuntimePersistenceState,
} from "./types";
import {
  MANUFACTURING_PERSISTENCE_PLATFORM_ID,
  MANUFACTURING_PERSISTENCE_SCHEMA_VERSION,
} from "./types";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableValue(entry));
  }
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(candidate).sort(compareDeterministicStrings)) {
      normalized[key] = stableValue(candidate[key]);
    }
    return normalized;
  }
  return value;
}

function stableString(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function sortRecords(records: readonly ManufacturingPersistenceRecord[]): ManufacturingPersistenceRecord[] {
  return [...records].sort((left, right) => compareDeterministicStrings(stableString(left), stableString(right)));
}

function sortMapEntries(entries: readonly ManufacturingPersistenceMapEntry[]): ManufacturingPersistenceMapEntry[] {
  return [...entries]
    .map((entry) => ({ key: entry.key, value: stableValue(entry.value) }))
    .sort((left, right) => compareDeterministicStrings(left.key, right.key));
}

function normalizeIdempotency(value: ManufacturingPersistenceTenantIdempotency): ManufacturingPersistenceTenantIdempotency {
  return {
    workOrders: sortMapEntries(value.workOrders),
    productionRuns: sortMapEntries(value.productionRuns),
    productionBatches: sortMapEntries(value.productionBatches),
    productBaselines: sortMapEntries(value.productBaselines),
    routings: sortMapEntries(value.routings),
    operations: sortMapEntries(value.operations),
    operationInitialization: sortMapEntries(value.operationInitialization),
    materialRequirements: sortMapEntries(value.materialRequirements),
    materialIssues: sortMapEntries(value.materialIssues),
    materialReturns: sortMapEntries(value.materialReturns),
    materialConsumption: sortMapEntries(value.materialConsumption),
    productionOutputs: sortMapEntries(value.productionOutputs),
    scrapRecords: sortMapEntries(value.scrapRecords),
    reworkRecords: sortMapEntries(value.reworkRecords),
    workCenters: sortMapEntries(value.workCenters),
    productionCells: sortMapEntries(value.productionCells),
    machineAssignments: sortMapEntries(value.machineAssignments),
    toolAssignments: sortMapEntries(value.toolAssignments),
    laborAssignments: sortMapEntries(value.laborAssignments),
    downtimeRecords: sortMapEntries(value.downtimeRecords),
    executionExceptions: sortMapEntries(value.executionExceptions),
    traceRecords: sortMapEntries(value.traceRecords),
  };
}

export function createEmptyRuntimePersistenceState(): ManufacturingRuntimePersistenceState {
  return {
    auditEvents: [],
    auditSequence: 0,
    referenceMetrics: {
      referenceValidationCount: 0,
      referenceValidationFailureCount: 0,
      mandatoryReferenceFailureCount: 0,
      optionalReferenceFailureCount: 0,
      missingValidatorCount: 0,
      tenantMismatchCount: 0,
      staleReferenceCount: 0,
      productIntegrationFailureCount: 0,
      inventoryIntegrationFailureCount: 0,
    },
    referenceLastStatusByFamily: {
      PRODUCT: "DEFERRED",
      PRODUCT_VARIANT: "DEFERRED",
      PRODUCT_VERSION: "DEFERRED",
      PRODUCT_BOM: "DEFERRED",
      INVENTORY_ITEM: "DEFERRED",
      INVENTORY_RESERVATION: "DEFERRED",
      INVENTORY_ALLOCATION: "DEFERRED",
      INVENTORY_MOVEMENT: "DEFERRED",
      INVENTORY_LOT: "DEFERRED",
      INVENTORY_SERIAL: "DEFERRED",
      ORGANIZATION: "DEFERRED",
      PERSON_OR_CONTACT: "DEFERRED",
      ASSET: "DEFERRED",
      DOCUMENT: "DEFERRED",
      KNOWLEDGE: "DEFERRED",
      COMMERCE_ORDER: "DEFERRED",
      FINANCE_CLASSIFICATION: "DEFERRED",
      QUALITY_HOLD_REFERENCE: "DEFERRED",
    },
  };
}

export function createDefaultManufacturingPersistenceEnvelope(runtimeId: string, writtenAt: string): ManufacturingPersistenceEnvelope {
  return {
    manifest: {
      schemaVersion: MANUFACTURING_PERSISTENCE_SCHEMA_VERSION,
      platformId: MANUFACTURING_PERSISTENCE_PLATFORM_ID,
      runtimeId,
      tenantIds: [],
      writtenAt,
      snapshotVersion: 0,
      recoveryMetadata: {},
    },
    runtimeState: createEmptyRuntimePersistenceState(),
    tenants: [],
  };
}

export function normalizeTenantPartition(partition: ManufacturingPersistenceTenantPartition): ManufacturingPersistenceTenantPartition {
  return {
    tenantId: partition.tenantId,
    workOrders: sortRecords(partition.workOrders),
    productionRuns: sortRecords(partition.productionRuns),
    productionBatches: sortRecords(partition.productionBatches),
    executionRoutings: sortRecords(partition.executionRoutings),
    operationExecutions: sortRecords(partition.operationExecutions),
    materialRequirements: sortRecords(partition.materialRequirements),
    materialIssueRequests: sortRecords(partition.materialIssueRequests),
    materialReturnRecords: sortRecords(partition.materialReturnRecords),
    materialConsumptionRecords: sortRecords(partition.materialConsumptionRecords),
    productionOutputs: sortRecords(partition.productionOutputs),
    scrapRecords: sortRecords(partition.scrapRecords),
    reworkRecords: sortRecords(partition.reworkRecords),
    wipStates: sortRecords(partition.wipStates),
    workCenters: sortRecords(partition.workCenters),
    productionCells: sortRecords(partition.productionCells),
    machineAssignments: sortRecords(partition.machineAssignments),
    toolAssignments: sortRecords(partition.toolAssignments),
    laborAssignments: sortRecords(partition.laborAssignments),
    downtimeRecords: sortRecords(partition.downtimeRecords),
    executionExceptions: sortRecords(partition.executionExceptions),
    traceRecords: sortRecords(partition.traceRecords),
    idempotency: normalizeIdempotency(partition.idempotency),
  };
}

export function normalizeManifest(manifest: ManufacturingPersistenceManifest): ManufacturingPersistenceManifest {
  return {
    schemaVersion: manifest.schemaVersion,
    platformId: manifest.platformId,
    runtimeId: manifest.runtimeId,
    tenantIds: [...manifest.tenantIds].sort(compareDeterministicStrings),
    writtenAt: manifest.writtenAt,
    snapshotVersion: manifest.snapshotVersion,
    recoveryMetadata: stableValue(manifest.recoveryMetadata) as ManufacturingPersistenceManifest["recoveryMetadata"],
  };
}

export function normalizeRuntimeState(state: ManufacturingRuntimePersistenceState): ManufacturingRuntimePersistenceState {
  return {
    auditEvents: sortRecords(state.auditEvents),
    auditSequence: state.auditSequence,
    referenceMetrics: stableValue(state.referenceMetrics) as ManufacturingRuntimePersistenceState["referenceMetrics"],
    referenceLastStatusByFamily: stableValue(state.referenceLastStatusByFamily) as ManufacturingRuntimePersistenceState["referenceLastStatusByFamily"],
  };
}

export function normalizeManufacturingPersistenceEnvelope(envelope: ManufacturingPersistenceEnvelope): ManufacturingPersistenceEnvelope {
  return {
    manifest: normalizeManifest(envelope.manifest),
    runtimeState: normalizeRuntimeState(envelope.runtimeState),
    tenants: [...envelope.tenants].map(normalizeTenantPartition).sort((left, right) => compareDeterministicStrings(left.tenantId, right.tenantId)),
  };
}

export function serializeManufacturingPersistenceEnvelope(envelope: ManufacturingPersistenceEnvelope): string {
  return JSON.stringify(normalizeManufacturingPersistenceEnvelope(envelope), null, 2);
}

export function serializeManufacturingPersistenceManifestFile(file: ManufacturingPersistenceManifestFile): string {
  return JSON.stringify(
    {
      manifest: normalizeManifest(file.manifest),
      runtimeState: normalizeRuntimeState(file.runtimeState),
    },
    null,
    2,
  );
}

export function cloneManufacturingPersistenceEnvelope(envelope: ManufacturingPersistenceEnvelope): ManufacturingPersistenceEnvelope {
  return structuredClone(normalizeManufacturingPersistenceEnvelope(envelope));
}

export function parseManufacturingPersistenceJson(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}
