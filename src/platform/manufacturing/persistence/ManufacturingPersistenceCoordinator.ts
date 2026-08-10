import { join } from "node:path";
import { tmpdir } from "node:os";
import { compareDeterministicStrings } from "../../shared";
import { ManufacturingDomainError } from "../domain";
import type { ManufacturingAuditService } from "../services/ManufacturingAuditService";
import type { ManufacturingHealthService, ManufacturingMetricsService } from "../services/ManufacturingObservabilityService";
import type { ManufacturingReferenceFamily, ManufacturingReferenceValidationService } from "../services/ManufacturingReferenceValidationService";
import { ManufacturingFileStore } from "./ManufacturingFileStore";
import { ManufacturingRecoveryCoordinator } from "./ManufacturingRecoveryCoordinator";
import { cloneManufacturingPersistenceEnvelope, createDefaultManufacturingPersistenceEnvelope, normalizeManufacturingPersistenceEnvelope, serializeManufacturingPersistenceEnvelope } from "./serialization";
import { createManufacturingPersistenceSchemaValidator } from "./schema";
import type {
  ManufacturingPersistenceConfiguration,
  ManufacturingPersistenceEnvelope,
  ManufacturingPersistenceMapEntry,
  ManufacturingPersistenceMetrics,
  ManufacturingPersistenceRecord,
  ManufacturingPersistenceStatus,
  ManufacturingPersistenceTenantPartition,
  ManufacturingRuntimePersistenceState,
} from "./types";

function asMap<TValue>(value: unknown, key: string): Map<string, TValue> {
  const map = (value as Record<string, unknown>)[key];
  return map as Map<string, TValue>;
}

function asSet<TValue>(value: unknown, key: string): Set<TValue> {
  const set = (value as Record<string, unknown>)[key];
  return set as Set<TValue>;
}

function asMutable<TValue>(value: unknown, key: string): TValue {
  return (value as Record<string, unknown>)[key] as TValue;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableJson(entry));
  }
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(candidate).sort(compareDeterministicStrings)) {
      normalized[key] = stableJson(candidate[key]);
    }
    return normalized;
  }
  return value;
}

function stableString(value: unknown): string {
  return JSON.stringify(stableJson(value));
}

function mapEntries<T>(map: Map<string, T>, filter?: (entryKey: string, entryValue: T) => boolean): ManufacturingPersistenceMapEntry[] {
  return [...map.entries()]
    .filter(([entryKey, entryValue]) => (filter ? filter(entryKey, entryValue) : true))
    .map(([entryKey, entryValue]) => ({ key: entryKey, value: clone(entryValue) }))
    .sort((left, right) => compareDeterministicStrings(left.key, right.key));
}

function mapValues<T>(map: Map<string, T>, filter?: (entryValue: T) => boolean): ManufacturingPersistenceRecord[] {
  return [...map.values()]
    .filter((entryValue) => (filter ? filter(entryValue) : true))
    .map((entryValue) => clone(entryValue) as ManufacturingPersistenceRecord)
    .sort((left, right) => compareDeterministicStrings(stableString(left), stableString(right)));
}

function tenantKey(tenantId: string, suffix: string): string {
  return `${tenantId}:${suffix}`;
}

function readString(value: unknown, path: readonly string[]): string | undefined {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : undefined;
}

function readNumber(value: unknown, path: readonly string[]): number | undefined {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "number" ? current : undefined;
}

function readArray(value: unknown, path: readonly string[]): unknown[] {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object") {
      return [];
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return Array.isArray(current) ? current : [];
}

function requireString(value: unknown, path: readonly string[], message: string): string {
  const found = readString(value, path);
  if (!found) {
    throw new Error(message);
  }
  return found;
}

function requireNumber(value: unknown, path: readonly string[], message: string): number {
  const found = readNumber(value, path);
  if (typeof found !== "number" || Number.isNaN(found)) {
    throw new Error(message);
  }
  return found;
}

function nonNegative(value: number, message: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(message);
  }
}

function hasCycle(edges: ReadonlyMap<string, readonly string[]>): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): boolean => {
    if (visited.has(node)) {
      return false;
    }
    if (visiting.has(node)) {
      return true;
    }
    visiting.add(node);
    for (const next of edges.get(node) ?? []) {
      if (visit(next)) {
        return true;
      }
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  for (const node of edges.keys()) {
    if (visit(node)) {
      return true;
    }
  }
  return false;
}

function buildDefaultRootDir(runtimeId: string): string {
  return join(
    tmpdir(),
    "platform-gkn-1001-manufacturing",
    `${runtimeId}-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
  );
}

export type ManufacturingPersistenceCoordinatorOptions = Readonly<{
  runtimeId: string;
  persistence?: ManufacturingPersistenceConfiguration;
  clock: { now(): string };
  services: Readonly<{
    workOrders: unknown;
    runs: unknown;
    batches: unknown;
    routings: unknown;
    operations: unknown;
    productReferences: unknown;
    materials: unknown;
    issues: unknown;
    consumption: unknown;
    outputs: unknown;
    scraps: unknown;
    reworks: unknown;
    wip: unknown;
    workCenters: unknown;
    productionCells: unknown;
    machineAssignments: unknown;
    toolAssignments: unknown;
    laborAssignments: unknown;
    downtime: unknown;
    executionExceptions: unknown;
    traceability: unknown;
    audit: ManufacturingAuditService;
    referenceValidation: ManufacturingReferenceValidationService;
    metrics: ManufacturingMetricsService;
    health: ManufacturingHealthService;
  }>;
}>;

const MUTATION_METHODS: Readonly<Record<string, readonly string[]>> = {
  workOrders: [
    "createWorkOrder",
    "planWorkOrder",
    "releaseWorkOrder",
    "startWorkOrderExecution",
    "pauseWorkOrder",
    "resumeWorkOrder",
    "placeOnHoldWorkOrder",
    "releaseHoldWorkOrder",
    "cancelWorkOrder",
    "completeWorkOrder",
    "closeWorkOrder",
  ],
  runs: ["createProductionRun"],
  batches: ["createProductionBatch"],
  routings: ["createExecutionRouting"],
  operations: [
    "initializeOperations",
    "startOperation",
    "pauseOperation",
    "resumeOperation",
    "completeOperation",
    "skipOperation",
    "requestReworkTransition",
  ],
  productReferences: ["validateProductBaseline", "freezeProductBaseline"],
  materials: ["deriveMaterialRequirements"],
  issues: ["issueMaterial", "returnMaterial"],
  consumption: ["recordConsumption"],
  outputs: ["recordProductionOutput"],
  scraps: ["recordScrap"],
  reworks: ["createRework"],
  workCenters: ["registerWorkCenter", "updateWorkCenter"],
  productionCells: ["registerProductionCell", "updateProductionCell"],
  machineAssignments: ["assignMachine"],
  toolAssignments: ["assignTool"],
  laborAssignments: ["assignLabor"],
  downtime: ["startDowntime", "endDowntime"],
  executionExceptions: ["recordExecutionException", "closeExecutionException"],
  traceability: ["appendTrace", "appendWorkOrderProductBaselineTrace"],
};

export class ManufacturingPersistenceCoordinator {
  private readonly validator = createManufacturingPersistenceSchemaValidator();
  private readonly recovery: ManufacturingRecoveryCoordinator;
  private readonly store: ManufacturingFileStore;
  private readonly durablePersistenceConfigured: boolean;
  private lastSnapshotVersion = 0;
  private applyingRecovery = false;

  constructor(private readonly options: ManufacturingPersistenceCoordinatorOptions) {
    this.durablePersistenceConfigured = Boolean(options.persistence?.rootDir?.trim());
    this.recovery = new ManufacturingRecoveryCoordinator(options.runtimeId, this.durablePersistenceConfigured);
    this.store = new ManufacturingFileStore({
      rootDir: this.durablePersistenceConfigured
        ? options.persistence!.rootDir!.trim()
        : buildDefaultRootDir(options.runtimeId),
    });
  }

  getRootDir(): string {
    return this.store.getRootDir();
  }

  getStatus(): ManufacturingPersistenceStatus {
    return this.recovery.getStatus();
  }

  getMetrics(): ManufacturingPersistenceMetrics {
    return this.recovery.getMetrics();
  }

  isDurablePersistenceConfigured(): boolean {
    return this.durablePersistenceConfigured;
  }

  async initializeAndRecover(): Promise<void> {
    const now = this.options.clock.now();
    this.recovery.markInitialized();
    await this.emitAudit("manufacturing.persistence.initialized", "persistence initialized", true);

    let envelope: ManufacturingPersistenceEnvelope | undefined;
    try {
      envelope = await this.store.loadAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : "persisted state could not be read";
      if (message.includes("unsupported schema version")) {
        this.recovery.markSchemaInvalid(message);
        this.recovery.markLoad("UNSUPPORTED_SCHEMA", now, message);
        await this.emitAudit("manufacturing.persistence.unsupported-schema", message, false, "UNSUPPORTED_PERSISTENCE_SCHEMA");
        throw new ManufacturingDomainError("UNSUPPORTED_PERSISTENCE_SCHEMA", message, false);
      }
      this.recovery.markCorrupt("PERSISTENCE_READ_FAILURE", message);
      this.recovery.markLoad("CORRUPT", now, message);
      await this.emitAudit("manufacturing.persistence.read.failed", message, false, "PERSISTENCE_READ_FAILURE");
      throw new ManufacturingDomainError("PERSISTENCE_READ_FAILURE", message, false);
    }

    if (!envelope) {
      const empty = createDefaultManufacturingPersistenceEnvelope(this.options.runtimeId, now);
      this.recovery.markLoad("FIRST_RUN_EMPTY", now);
      this.recovery.markRecovery(true, now);
      await this.emitAudit("manufacturing.persistence.first-run-empty", "first-run empty manufacturing state initialized", true);
      await this.saveEnvelope(empty);
      return;
    }

    this.recovery.markLoad("LOADED", now);
    await this.emitAudit("manufacturing.recovery.started", "manufacturing recovery started", true);

    try {
      this.validator.validateEnvelopeOrThrow(envelope);
      this.validateEnvelopeInvariants(envelope);
      this.validateReferenceRecoveryPolicy();
      this.applyEnvelope(envelope);
      this.rebuildProjections();
      this.lastSnapshotVersion = envelope.manifest.snapshotVersion;
      this.recovery.markRecovery(true, this.options.clock.now());
      await this.emitAudit("manufacturing.recovery.succeeded", "manufacturing recovery succeeded", true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "manufacturing recovery failed";
      const classification = error instanceof ManufacturingDomainError ? error.classification : this.classifyRecoveryFailure(message);
      this.recovery.markCorrupt(classification, message);
      this.recovery.markRecovery(false, this.options.clock.now(), classification, message);
      await this.emitAudit("manufacturing.recovery.rejected", message, false, classification);
      throw error instanceof ManufacturingDomainError ? error : new ManufacturingDomainError(classification, message, false);
    }
  }

  enableDurability(): void {
    for (const [serviceKey, methods] of Object.entries(MUTATION_METHODS)) {
      const service = (this.options.services as Record<string, unknown>)[serviceKey];
      if (!service) {
        continue;
      }
      for (const methodName of methods) {
        const current = (service as Record<string, unknown>)[methodName];
        if (typeof current !== "function") {
          continue;
        }
        const original = current.bind(service);
        (service as Record<string, unknown>)[methodName] = async (...args: unknown[]) => {
          if (this.applyingRecovery) {
            return original(...args);
          }
          const before = this.captureEnvelope();
          try {
            const result = await original(...args);
            try {
              await this.saveCurrentState();
            } catch (saveError) {
              this.applyEnvelope(before);
              const message = saveError instanceof Error ? saveError.message : "manufacturing persistence write failed";
              throw new ManufacturingDomainError("PERSISTENCE_WRITE_FAILURE", message, false);
            }
            return result;
          } catch (error) {
            const after = this.captureEnvelope();
            if (serializeManufacturingPersistenceEnvelope(before) !== serializeManufacturingPersistenceEnvelope(after)) {
              try {
                await this.saveEnvelope(after);
              } catch (saveError) {
                this.applyEnvelope(before);
                const message = saveError instanceof Error ? saveError.message : "manufacturing persistence write failed";
                throw new ManufacturingDomainError("PERSISTENCE_WRITE_FAILURE", message, false);
              }
            }
            throw error;
          }
        };
      }
    }
  }

  async flushOnShutdown(): Promise<void> {
    await this.saveCurrentState();
  }

  async saveCurrentState(): Promise<void> {
    await this.saveEnvelope(this.captureEnvelope());
  }

  private async saveEnvelope(envelope: ManufacturingPersistenceEnvelope): Promise<void> {
    const normalized = cloneManufacturingPersistenceEnvelope({
      ...envelope,
      manifest: {
        ...envelope.manifest,
        writtenAt: this.options.clock.now(),
        snapshotVersion: this.lastSnapshotVersion + 1,
        recoveryMetadata: {
          lastLoadStatus: this.recovery.getStatus().lastLoadStatus,
          lastDurableWriteStatus: "SUCCESS",
          lastRecoveryStatus: this.recovery.getStatus().lastRecoveryStatus,
          lastRecoveryAt: this.recovery.getStatus().lastRecoveryAt,
          lastRecoveryReason: this.recovery.getStatus().lastErrorMessage,
        },
      },
    });
    try {
      await this.store.saveAll(normalized);
      this.lastSnapshotVersion = normalized.manifest.snapshotVersion;
      this.recovery.markWrite(true, normalized.manifest.writtenAt);
      await this.emitAudit(
        "manufacturing.persistence.save.succeeded",
        "manufacturing persistence save succeeded",
        true,
        undefined,
        {
          snapshotVersion: normalized.manifest.snapshotVersion,
          checkpointDurability: "POST_COMMIT_VOLATILE_UNTIL_NEXT_DURABLE_CHECKPOINT",
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "manufacturing persistence write failed";
      const classification = message.includes("rename") ? "PERSISTENCE_ATOMIC_REPLACE_FAILURE" : "PERSISTENCE_WRITE_FAILURE";
      this.recovery.markWrite(false, this.options.clock.now(), classification, message);
      await this.emitAudit("manufacturing.persistence.save.failed", message, false, classification);
      throw new ManufacturingDomainError(classification, message, false);
    }
  }

  private captureEnvelope(): ManufacturingPersistenceEnvelope {
    const tenantIds = this.collectTenantIds();
    const tenants = tenantIds.map((tenantId) => this.captureTenantPartition(tenantId));
    return normalizeManufacturingPersistenceEnvelope({
      manifest: {
        schemaVersion: "1.0.0",
        platformId: "platform.manufacturing",
        runtimeId: this.options.runtimeId,
        tenantIds,
        writtenAt: this.options.clock.now(),
        snapshotVersion: this.lastSnapshotVersion,
        recoveryMetadata: {
          lastLoadStatus: this.recovery.getStatus().lastLoadStatus,
          lastDurableWriteStatus: this.recovery.getStatus().lastDurableWriteStatus,
          lastRecoveryStatus: this.recovery.getStatus().lastRecoveryStatus,
          lastRecoveryAt: this.recovery.getStatus().lastRecoveryAt,
          lastRecoveryReason: this.recovery.getStatus().lastErrorMessage,
        },
      },
      runtimeState: this.captureRuntimeState(),
      tenants,
    });
  }

  private collectTenantIds(): TenantId[] {
    const tenants = new Set<string>();
    for (const record of mapValues(asMap(this.options.services.workOrders, "byId"))) {
      const tenantId = readString(record, ["workOrder", "tenantId"]);
      if (tenantId) {
        tenants.add(tenantId);
      }
    }
    for (const record of mapValues(asMap(this.options.services.wip, "byWorkOrder"))) {
      const tenantId = readString(record, ["tenantId"]);
      if (tenantId) {
        tenants.add(tenantId);
      }
    }
    for (const tenantId of this.options.services.audit.getKnownTenantIds()) {
      tenants.add(tenantId);
    }
    return [...tenants].sort(compareDeterministicStrings) as TenantId[];
  }

  private captureRuntimeState(): ManufacturingRuntimePersistenceState {
    const auditEvents = this.options.services.audit.listManufacturingAuditEvents() as unknown as ManufacturingPersistenceRecord[];
    const referenceService = this.options.services.referenceValidation as unknown as Record<string, unknown>;
    const lastStatusByFamily = Object.fromEntries(
      [...asMap<unknown>(referenceService, "lastStatusByFamily").entries()].sort(([left], [right]) => compareDeterministicStrings(left, right)),
    ) as Record<ManufacturingReferenceFamily, unknown>;
    return {
      auditEvents: clone(auditEvents),
      auditSequence: asMutable<number>(this.options.services.audit as unknown, "sequence"),
      referenceMetrics: clone(this.options.services.referenceValidation.getMetrics()),
      referenceLastStatusByFamily: lastStatusByFamily as ManufacturingRuntimePersistenceState["referenceLastStatusByFamily"],
    };
  }

  private captureTenantPartition(tenantId: TenantId): ManufacturingPersistenceTenantPartition {
    const workOrders = this.captureRecordsForTenant(asMap(this.options.services.workOrders, "byId"), (value) => readString(value, ["workOrder", "tenantId"]) === tenantId);
    const productionRuns = this.captureRecordsForTenant(asMap(this.options.services.runs, "byId"), (value) => readString(value, ["run", "tenantId"]) === tenantId);
    const productionBatches = this.captureRecordsForTenant(asMap(this.options.services.batches, "byId"), (value) => readString(value, ["batch", "tenantId"]) === tenantId);
    const executionRoutings = this.captureRecordsForTenant(asMap(this.options.services.routings, "byId"), (value) => readString(value, ["routing", "tenantId"]) === tenantId);
    const operationExecutions = this.captureRecordsForTenant(asMap(this.options.services.operations, "byId"), (value) => readString(value, ["execution", "tenantId"]) === tenantId);
    const materialRequirements = this.captureRecordsForTenant(asMap(this.options.services.materials, "byId"), (value) => readString(value, ["tenantId"]) === tenantId);
    const materialIssueRequests = this.captureRecordsForTenant(asMap(this.options.services.issues, "issueById"), (value) => readString(value, ["tenantId"]) === tenantId);
    const materialReturnRecords = this.captureRecordsForTenant(asMap(this.options.services.issues, "returnById"), (value) => readString(value, ["tenantId"]) === tenantId);
    const materialConsumptionRecords = this.captureRecordsForTenant(asMap(this.options.services.consumption, "byId"), (value) => readString(value, ["tenantId"]) === tenantId);
    const productionOutputs = this.captureRecordsForTenant(asMap(this.options.services.outputs, "byId"), (value) => readString(value, ["tenantId"]) === tenantId);
    const scrapRecords = this.captureRecordsForTenant(asMap(this.options.services.scraps, "byId"), (value) => readString(value, ["tenantId"]) === tenantId);
    const reworkRecords = this.captureRecordsForTenant(asMap(this.options.services.reworks, "byId"), (value) => readString(value, ["tenantId"]) === tenantId);
    const wipStates = this.captureRecordsForTenant(asMap(this.options.services.wip, "byWorkOrder"), (value) => readString(value, ["tenantId"]) === tenantId);
    const workCenters = this.captureRecordsForTenant(asMap(this.options.services.workCenters, "byId"), (value) => readString(value, ["tenantId"]) === tenantId);
    const productionCells = this.captureRecordsForTenant(asMap(this.options.services.productionCells, "byId"), (value) => readString(value, ["tenantId"]) === tenantId);
    const machineAssignments = this.captureRecordsForTenant(asMap(this.options.services.machineAssignments, "byId"), (value) => readString(value, ["tenantId"]) === tenantId);
    const toolAssignments = this.captureRecordsForTenant(asMap(this.options.services.toolAssignments, "byId"), (value) => readString(value, ["tenantId"]) === tenantId);
    const laborAssignments = this.captureRecordsForTenant(asMap(this.options.services.laborAssignments, "byId"), (value) => readString(value, ["tenantId"]) === tenantId);
    const downtimeRecords = this.captureRecordsForTenant(asMap(this.options.services.downtime, "byId"), (value) => readString(value, ["tenantId"]) === tenantId);
    const executionExceptions = this.captureRecordsForTenant(asMap(this.options.services.executionExceptions, "byId"), (value) => readString(value, ["tenantId"]) === tenantId);
    const traceRecords = this.captureRecordsForTenant(asMap(this.options.services.traceability, "byId"), (value) => readString(value, ["tenantId"]) === tenantId);

    return {
      tenantId,
      workOrders,
      productionRuns,
      productionBatches,
      executionRoutings,
      operationExecutions,
      materialRequirements,
      materialIssueRequests,
      materialReturnRecords,
      materialConsumptionRecords,
      productionOutputs,
      scrapRecords,
      reworkRecords,
      wipStates,
      workCenters,
      productionCells,
      machineAssignments,
      toolAssignments,
      laborAssignments,
      downtimeRecords,
      executionExceptions,
      traceRecords,
      idempotency: {
        workOrders: this.captureTenantEntries(asMap(this.options.services.workOrders, "idempotency"), tenantId),
        productionRuns: this.captureTenantEntries(asMap(this.options.services.runs, "idempotency"), tenantId),
        productionBatches: this.captureTenantEntries(asMap(this.options.services.batches, "idempotency"), tenantId),
        productBaselines: this.captureTenantEntries(asMap(this.options.services.productReferences, "idempotency"), tenantId),
        routings: this.captureTenantEntries(asMap(this.options.services.routings, "idempotency"), tenantId),
        operations: this.captureTenantEntries(asMap(this.options.services.operations, "idempotency"), tenantId),
        operationInitialization: this.captureTenantEntries(asMap(this.options.services.operations, "initializationIdempotency"), tenantId),
        materialRequirements: this.captureTenantEntries(asMap(this.options.services.materials, "idempotency"), tenantId),
        materialIssues: this.captureTenantEntries(asMap(this.options.services.issues, "issueIdempotency"), tenantId),
        materialReturns: this.captureTenantEntries(asMap(this.options.services.issues, "returnIdempotency"), tenantId),
        materialConsumption: this.captureTenantEntries(asMap(this.options.services.consumption, "idempotency"), tenantId),
        productionOutputs: this.captureTenantEntries(asMap(this.options.services.outputs, "idempotency"), tenantId),
        scrapRecords: this.captureTenantEntries(asMap(this.options.services.scraps, "idempotency"), tenantId),
        reworkRecords: this.captureTenantEntries(asMap(this.options.services.reworks, "idempotency"), tenantId),
        workCenters: this.captureTenantEntries(asMap(this.options.services.workCenters, "idempotency"), tenantId),
        productionCells: this.captureTenantEntries(asMap(this.options.services.productionCells, "idempotency"), tenantId),
        machineAssignments: this.captureTenantEntries(asMap(this.options.services.machineAssignments, "idempotency"), tenantId),
        toolAssignments: this.captureTenantEntries(asMap(this.options.services.toolAssignments, "idempotency"), tenantId),
        laborAssignments: this.captureTenantEntries(asMap(this.options.services.laborAssignments, "idempotency"), tenantId),
        downtimeRecords: this.captureTenantEntries(asMap(this.options.services.downtime, "idempotency"), tenantId),
        executionExceptions: this.captureTenantEntries(asMap(this.options.services.executionExceptions, "idempotency"), tenantId),
        traceRecords: this.captureTenantEntries(asMap(this.options.services.traceability, "idempotency"), tenantId),
      },
    };
  }

  private captureRecordsForTenant<T>(map: Map<string, T>, predicate: (value: T) => boolean): ManufacturingPersistenceRecord[] {
    return mapValues(map, predicate);
  }

  private captureTenantEntries<T>(map: Map<string, T>, tenantId: string): ManufacturingPersistenceMapEntry[] {
    return mapEntries(map, (entryKey) => entryKey.startsWith(`${tenantId}:`));
  }

  private applyEnvelope(envelope: ManufacturingPersistenceEnvelope): void {
    this.applyingRecovery = true;
    try {
      const services = this.options.services;
      this.resetMap(asMap(services.workOrders, "byId"), envelope.tenants.flatMap((tenant) => tenant.workOrders), (record) => requireString(record, ["workOrder", "manufacturingWorkOrderId"], "missing work order id"));
      this.resetMap(asMap(services.workOrders, "idByTenantAndNumber"), envelope.tenants.flatMap((tenant) => tenant.workOrders).map((record) => ({
        key: `${requireString(record, ["workOrder", "tenantId"], "missing work order tenant")}:${requireString(record, ["workOrder", "workOrderNumber"], "missing work order number")}`,
        value: requireString(record, ["workOrder", "manufacturingWorkOrderId"], "missing work order id"),
      })), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.workOrders, "idempotency"), envelope.tenants.flatMap((tenant) => tenant.idempotency.workOrders), (entry) => entry.key, (entry) => entry.value);

      this.restoreRecordMapWithIndex(services.runs, "byId", envelope.tenants.flatMap((tenant) => tenant.productionRuns), ["run", "productionRunId"], "idByTenantCode", ["run", "tenantId"], ["run", "runCode"], ["run", "productionRunId"]);
      this.resetMap(asMap(services.runs, "idempotency"), envelope.tenants.flatMap((tenant) => tenant.idempotency.productionRuns), (entry) => entry.key, (entry) => entry.value);
      this.restoreRecordMapWithIndex(services.batches, "byId", envelope.tenants.flatMap((tenant) => tenant.productionBatches), ["batch", "productionBatchId"], "idByTenantCode", ["batch", "tenantId"], ["batch", "batchCode"], ["batch", "productionBatchId"]);
      this.resetMap(asMap(services.batches, "idempotency"), envelope.tenants.flatMap((tenant) => tenant.idempotency.productionBatches), (entry) => entry.key, (entry) => entry.value);

      this.restoreRecordMapWithIndex(services.routings, "byId", envelope.tenants.flatMap((tenant) => tenant.executionRoutings), ["routing", "executionRoutingId"], "idByTenantAndWorkOrder", ["routing", "tenantId"], ["routing", "workOrderId"], ["routing", "executionRoutingId"]);
      this.resetMap(asMap(services.routings, "idempotency"), envelope.tenants.flatMap((tenant) => tenant.idempotency.routings), (entry) => entry.key, (entry) => entry.value);

      this.resetMap(asMap(services.operations, "byId"), envelope.tenants.flatMap((tenant) => tenant.operationExecutions), (record) => requireString(record, ["execution", "operationExecutionId"], "missing operation execution id"));
      this.resetMap(asMap(services.operations, "byRouting"), envelope.tenants.flatMap((tenant) => this.groupIds(tenant.operationExecutions, ["execution", "tenantId"], ["execution", "executionRoutingId"], ["execution", "operationExecutionId"])), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.operations, "byWorkOrder"), envelope.tenants.flatMap((tenant) => this.groupIds(tenant.operationExecutions, ["execution", "tenantId"], ["execution", "workOrderId"], ["execution", "operationExecutionId"])), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.operations, "idempotency"), envelope.tenants.flatMap((tenant) => tenant.idempotency.operations), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.operations, "initializationIdempotency"), envelope.tenants.flatMap((tenant) => tenant.idempotency.operationInitialization), (entry) => entry.key, (entry) => entry.value);

      this.resetMap(asMap(services.productReferences, "idempotency"), envelope.tenants.flatMap((tenant) => tenant.idempotency.productBaselines), (entry) => entry.key, (entry) => entry.value);

      this.resetMap(asMap(services.materials, "byId"), envelope.tenants.flatMap((tenant) => tenant.materialRequirements), (record) => requireString(record, ["materialRequirementId"], "missing material requirement id"));
      this.resetMap(asMap(services.materials, "byTenantWorkOrder"), envelope.tenants.flatMap((tenant) => this.groupIds(tenant.materialRequirements, ["tenantId"], ["workOrderId"], ["materialRequirementId"])), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.materials, "idempotency"), envelope.tenants.flatMap((tenant) => tenant.idempotency.materialRequirements), (entry) => entry.key, (entry) => entry.value);

      this.resetMap(asMap(services.issues, "issueById"), envelope.tenants.flatMap((tenant) => tenant.materialIssueRequests), (record) => requireString(record, ["materialIssueRequestId"], "missing issue id"));
      this.resetMap(asMap(services.issues, "issueByRequirement"), envelope.tenants.flatMap((tenant) => this.groupIds(tenant.materialIssueRequests, ["tenantId"], ["materialRequirementId"], ["materialIssueRequestId"])), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.issues, "issueIdempotency"), envelope.tenants.flatMap((tenant) => tenant.idempotency.materialIssues), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.issues, "returnById"), envelope.tenants.flatMap((tenant) => tenant.materialReturnRecords), (record) => requireString(record, ["materialReturnId"], "missing return id"));
      this.resetMap(asMap(services.issues, "returnByRequirement"), envelope.tenants.flatMap((tenant) => this.groupIds(tenant.materialReturnRecords, ["tenantId"], ["materialRequirementId"], ["materialReturnId"])), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.issues, "returnIdempotency"), envelope.tenants.flatMap((tenant) => tenant.idempotency.materialReturns), (entry) => entry.key, (entry) => entry.value);

      this.resetMap(asMap(services.consumption, "byId"), envelope.tenants.flatMap((tenant) => tenant.materialConsumptionRecords), (record) => requireString(record, ["materialConsumptionId"], "missing consumption id"));
      this.resetMap(asMap(services.consumption, "byRequirement"), envelope.tenants.flatMap((tenant) => this.groupIds(tenant.materialConsumptionRecords, ["tenantId"], ["materialRequirementId"], ["materialConsumptionId"])), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.consumption, "idempotency"), envelope.tenants.flatMap((tenant) => tenant.idempotency.materialConsumption), (entry) => entry.key, (entry) => entry.value);

      this.resetMap(asMap(services.outputs, "byId"), envelope.tenants.flatMap((tenant) => tenant.productionOutputs), (record) => requireString(record, ["productionOutputId"], "missing production output id"));
      this.resetMap(asMap(services.outputs, "byWorkOrder"), envelope.tenants.flatMap((tenant) => this.groupIds(tenant.productionOutputs, ["tenantId"], ["workOrderId"], ["productionOutputId"])), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.outputs, "byOperation"), envelope.tenants.flatMap((tenant) => this.groupIds(tenant.productionOutputs, ["tenantId"], ["operationExecutionId"], ["productionOutputId"])), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.outputs, "idempotency"), envelope.tenants.flatMap((tenant) => tenant.idempotency.productionOutputs), (entry) => entry.key, (entry) => entry.value);

      this.restoreRecordByWorkOrderAndOperation(services.scraps, envelope.tenants.flatMap((tenant) => tenant.scrapRecords), "scrapRecordId", "workOrderId", "operationExecutionId", envelope.tenants.flatMap((tenant) => tenant.idempotency.scrapRecords));
      this.restoreRecordByWorkOrderAndOperation(services.reworks, envelope.tenants.flatMap((tenant) => tenant.reworkRecords), "reworkRecordId", "workOrderId", "sourceOperationExecutionId", envelope.tenants.flatMap((tenant) => tenant.idempotency.reworkRecords));

      this.resetMap(asMap(services.wip, "byWorkOrder"), envelope.tenants.flatMap((tenant) => tenant.wipStates).map((record) => ({
        key: `${requireString(record, ["tenantId"], "missing wip tenant")}:${requireString(record, ["workOrderId"], "missing wip work order")}`,
        value: record,
      })), (entry) => entry.key, (entry) => entry.value);

      this.restoreRecordMapWithIndex(services.workCenters, "byId", envelope.tenants.flatMap((tenant) => tenant.workCenters), ["workCenterId"], "idByTenantCode", ["tenantId"], ["workCenterCode"], ["workCenterId"]);
      this.resetMap(asMap(services.workCenters, "idempotency"), envelope.tenants.flatMap((tenant) => tenant.idempotency.workCenters), (entry) => entry.key, (entry) => entry.value);
      this.restoreRecordMapWithIndex(services.productionCells, "byId", envelope.tenants.flatMap((tenant) => tenant.productionCells), ["productionCellId"], "idByTenantCode", ["tenantId"], ["productionCellCode"], ["productionCellId"]);
      this.resetMap(asMap(services.productionCells, "idempotency"), envelope.tenants.flatMap((tenant) => tenant.idempotency.productionCells), (entry) => entry.key, (entry) => entry.value);

      this.restoreAssignment(services.machineAssignments, envelope.tenants.flatMap((tenant) => tenant.machineAssignments), "machineAssignmentId", envelope.tenants.flatMap((tenant) => tenant.idempotency.machineAssignments));
      this.restoreAssignment(services.toolAssignments, envelope.tenants.flatMap((tenant) => tenant.toolAssignments), "toolAssignmentId", envelope.tenants.flatMap((tenant) => tenant.idempotency.toolAssignments));
      this.restoreAssignment(services.laborAssignments, envelope.tenants.flatMap((tenant) => tenant.laborAssignments), "laborAssignmentId", envelope.tenants.flatMap((tenant) => tenant.idempotency.laborAssignments));

      this.restoreRecordByWorkOrderAndOperation(services.downtime, envelope.tenants.flatMap((tenant) => tenant.downtimeRecords), "downtimeRecordId", "workOrderId", "operationExecutionId", envelope.tenants.flatMap((tenant) => tenant.idempotency.downtimeRecords));
      this.restoreRecordByWorkOrderAndOperation(services.executionExceptions, envelope.tenants.flatMap((tenant) => tenant.executionExceptions), "executionExceptionId", "workOrderId", "operationExecutionId", envelope.tenants.flatMap((tenant) => tenant.idempotency.executionExceptions));

      this.resetMap(asMap(services.traceability, "byId"), envelope.tenants.flatMap((tenant) => tenant.traceRecords), (record) => requireString(record, ["productionTraceId"], "missing trace id"));
      this.resetMap(asMap(services.traceability, "byWorkOrder"), envelope.tenants.flatMap((tenant) => this.groupIds(tenant.traceRecords, ["tenantId"], ["workOrderId"], ["productionTraceId"])), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.traceability, "byOperation"), envelope.tenants.flatMap((tenant) => this.groupIds(tenant.traceRecords, ["tenantId"], ["operationExecutionId"], ["productionTraceId"])), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.traceability, "bySource"), envelope.tenants.flatMap((tenant) => this.groupTraceEdges(tenant.traceRecords, "sourceType", "sourceId")), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.traceability, "byTarget"), envelope.tenants.flatMap((tenant) => this.groupTraceEdges(tenant.traceRecords, "targetType", "targetId")), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.traceability, "appendSequenceByTenant"), envelope.tenants.map((tenant) => ({ key: tenant.tenantId, value: this.maxSequence(tenant.traceRecords) })), (entry) => entry.key, (entry) => entry.value);
      this.resetMap(asMap(services.traceability, "idempotency"), envelope.tenants.flatMap((tenant) => tenant.idempotency.traceRecords), (entry) => entry.key, (entry) => entry.value);

      this.resetMap(asMap(services.audit as unknown, "events"), envelope.runtimeState.auditEvents, (record) => requireString(record, ["auditEventId"], "missing audit event id"));
      const tenantSet = asSet<string>(services.audit as unknown, "tenantIds");
      tenantSet.clear();
      for (const event of envelope.runtimeState.auditEvents) {
        const tenantId = readString(event, ["tenantId"]);
        if (tenantId) {
          tenantSet.add(tenantId);
        }
      }
      (services.audit as unknown as Record<string, unknown>).sequence = envelope.runtimeState.auditSequence;

      (services.referenceValidation as unknown as Record<string, unknown>).metrics = clone(envelope.runtimeState.referenceMetrics);
      const lastStatusByFamily = asMap<unknown>(services.referenceValidation as unknown, "lastStatusByFamily");
      lastStatusByFamily.clear();
      for (const [family, status] of Object.entries(envelope.runtimeState.referenceLastStatusByFamily)) {
        lastStatusByFamily.set(family, status);
      }
    } finally {
      this.applyingRecovery = false;
    }
  }

  private restoreRecordMapWithIndex(
    service: unknown,
    byIdKey: string,
    records: readonly ManufacturingPersistenceRecord[],
    idPath: readonly string[],
    indexKey: string,
    tenantPath: readonly string[],
    codePath: readonly string[],
    valuePath: readonly string[],
  ): void {
    this.resetMap(asMap(service, byIdKey), records, (record) => requireString(record, idPath, `missing record id for ${byIdKey}`));
    this.resetMap(
      asMap(service, indexKey),
      records.map((record) => ({
        key: `${requireString(record, tenantPath, `missing tenant for ${indexKey}`)}:${requireString(record, codePath, `missing code for ${indexKey}`)}`,
        value: requireString(record, valuePath, `missing value for ${indexKey}`),
      })),
      (entry) => entry.key,
      (entry) => entry.value,
    );
  }

  private restoreRecordByWorkOrderAndOperation(
    service: unknown,
    records: readonly ManufacturingPersistenceRecord[],
    idField: string,
    workOrderField: string,
    operationField: string,
    idempotency: readonly ManufacturingPersistenceMapEntry[],
  ): void {
    this.resetMap(asMap(service, "byId"), records, (record) => requireString(record, [idField], `missing ${idField}`));
    this.resetMap(asMap(service, "byWorkOrder"), this.groupIds(records, ["tenantId"], [workOrderField], [idField]), (entry) => entry.key, (entry) => entry.value);
    this.resetMap(asMap(service, "byOperation"), this.groupIds(records, ["tenantId"], [operationField], [idField]), (entry) => entry.key, (entry) => entry.value);
    this.resetMap(asMap(service, "idempotency"), idempotency, (entry) => entry.key, (entry) => entry.value);
  }

  private restoreAssignment(service: unknown, records: readonly ManufacturingPersistenceRecord[], idField: string, idempotency: readonly ManufacturingPersistenceMapEntry[]): void {
    this.resetMap(asMap(service, "byId"), records, (record) => requireString(record, [idField], `missing ${idField}`));
    this.resetMap(asMap(service, "byOperation"), this.groupIds(records, ["tenantId"], ["operationExecutionId"], [idField]), (entry) => entry.key, (entry) => entry.value);
    this.resetMap(asMap(service, "idempotency"), idempotency, (entry) => entry.key, (entry) => entry.value);
  }

  private groupIds(
    records: readonly ManufacturingPersistenceRecord[],
    tenantPath: readonly string[],
    groupPath: readonly string[],
    idPath: readonly string[],
  ): Array<{ key: string; value: readonly string[] }> {
    const grouped = new Map<string, string[]>();
    for (const record of records) {
      const tenantId = readString(record, tenantPath);
      const groupId = readString(record, groupPath);
      const recordId = readString(record, idPath);
      if (!tenantId || !groupId || !recordId) {
        continue;
      }
      const key = `${tenantId}:${groupId}`;
      grouped.set(key, [...(grouped.get(key) ?? []), recordId].sort(compareDeterministicStrings));
    }
    return [...grouped.entries()].map(([key, value]) => ({ key, value })).sort((left, right) => compareDeterministicStrings(left.key, right.key));
  }

  private groupTraceEdges(records: readonly ManufacturingPersistenceRecord[], typeField: string, idField: string): Array<{ key: string; value: readonly string[] }> {
    const grouped = new Map<string, string[]>();
    for (const record of records) {
      const tenantId = readString(record, ["tenantId"]);
      const relationType = readString(record, [typeField]);
      const relationId = readString(record, [idField]);
      const traceId = readString(record, ["productionTraceId"]);
      if (!tenantId || !relationType || !relationId || !traceId) {
        continue;
      }
      const key = `${tenantId}:${relationType}:${relationId}`;
      grouped.set(key, [...(grouped.get(key) ?? []), traceId].sort(compareDeterministicStrings));
    }
    return [...grouped.entries()].map(([key, value]) => ({ key, value })).sort((left, right) => compareDeterministicStrings(left.key, right.key));
  }

  private maxSequence(records: readonly ManufacturingPersistenceRecord[]): number {
    let max = 0;
    for (const record of records) {
      max = Math.max(max, readNumber(record, ["appendSequence"]) ?? 0);
    }
    return max;
  }

  private resetMap<TSource, TValue>(
    target: Map<string, TValue>,
    source: readonly TSource[],
    toKey: (value: TSource) => string,
    toValue?: (value: TSource) => TValue,
  ): void {
    target.clear();
    for (const value of source) {
      target.set(toKey(value), clone((toValue ? toValue(value) : (value as unknown as TValue))));
    }
  }

  private validateEnvelopeInvariants(envelope: ManufacturingPersistenceEnvelope): void {
    const allWorkOrderIds = new Set<string>();
    const allWorkOrderNumbers = new Set<string>();
    const allRoutingIds = new Set<string>();
    const allOperationIds = new Set<string>();
    const allMaterialRequirementIds = new Set<string>();
    const allOutputIds = new Set<string>();
    const allAssignmentIds = new Set<string>();
    const allTraceIds = new Set<string>();

    for (const tenant of envelope.tenants) {
      if (tenant.tenantId.trim().length === 0) {
        throw new ManufacturingDomainError("INVALID_PERSISTED_MANIFEST", "persisted tenant id is invalid", false);
      }
      for (const workOrder of tenant.workOrders) {
        const workOrderId = requireString(workOrder, ["workOrder", "manufacturingWorkOrderId"], "persisted work order id is invalid");
        const tenantId = requireString(workOrder, ["workOrder", "tenantId"], "persisted work order tenant is invalid");
        if (tenantId !== tenant.tenantId) {
          throw new ManufacturingDomainError("PERSISTED_TENANT_MISMATCH", `persisted work order tenant mismatch: ${workOrderId}`, false);
        }
        const workOrderNumber = requireString(workOrder, ["workOrder", "workOrderNumber"], "persisted work order number is invalid");
        if (allWorkOrderIds.has(workOrderId)) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `duplicate work order id: ${workOrderId}`, false);
        }
        allWorkOrderIds.add(workOrderId);
        const numberKey = `${tenantId}:${workOrderNumber}`;
        if (allWorkOrderNumbers.has(numberKey)) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `duplicate work order number: ${workOrderNumber}`, false);
        }
        allWorkOrderNumbers.add(numberKey);
        const lifecycle = requireString(workOrder, ["workOrder", "workOrderState"], `invalid work order lifecycle: ${workOrderId}`);
        if (!["DRAFT", "PLANNED", "RELEASED", "READY", "IN_PROGRESS", "PAUSED", "BLOCKED", "ON_HOLD", "PARTIALLY_COMPLETED", "COMPLETED", "CANCELLED", "CLOSED", "ARCHIVED"].includes(lifecycle)) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `invalid work order lifecycle: ${workOrderId}`, false);
        }
        for (const [path, label] of [
          [["workOrder", "requestedQuantity", "value"], "requested quantity"],
          [["workOrder", "plannedQuantity", "value"], "planned quantity"],
          [["workOrder", "completedQuantity", "value"], "completed quantity"],
          [["workOrder", "rejectedQuantity", "value"], "rejected quantity"],
          [["workOrder", "scrapQuantity", "value"], "scrap quantity"],
          [["workOrder", "reworkQuantity", "value"], "rework quantity"],
        ] as const) {
          nonNegative(requireNumber(workOrder, path, `${label} invalid for ${workOrderId}`), `${label} invalid for ${workOrderId}`);
        }
        const baselineState = requireString(workOrder, ["productBaselineState"], `invalid product baseline state: ${workOrderId}`);
        if (!["UNVALIDATED", "VALIDATED", "FROZEN"].includes(baselineState)) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `invalid product baseline state: ${workOrderId}`, false);
        }
        if (baselineState !== "UNVALIDATED" && !readString(workOrder, ["productBaselineSnapshot", "productVersionRef", "productVersionId"])) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `missing frozen product baseline snapshot: ${workOrderId}`, false);
        }
        nonNegative(requireNumber(workOrder, ["workOrder", "version"], `invalid work order version: ${workOrderId}`), `invalid work order version: ${workOrderId}`);
      }

      for (const routing of tenant.executionRoutings) {
        const routingId = requireString(routing, ["routing", "executionRoutingId"], "persisted routing id is invalid");
        if (allRoutingIds.has(routingId)) {
          throw new ManufacturingDomainError("RECOVERY_ROUTING_FAILURE", `duplicate routing id: ${routingId}`, false);
        }
        allRoutingIds.add(routingId);
        const workOrderId = requireString(routing, ["routing", "workOrderId"], `routing work order missing: ${routingId}`);
        if (!allWorkOrderIds.has(workOrderId)) {
          throw new ManufacturingDomainError("RECOVERY_ROUTING_FAILURE", `invalid work order relationship: ${routingId}`, false);
        }
        const steps = readArray(routing, ["routing", "steps"]);
        const stepIds = new Set<string>();
        const edges = new Map<string, string[]>();
        for (const step of steps) {
          const stepId = requireString(step, ["routingStepId"], `invalid routing step: ${routingId}`);
          if (stepIds.has(stepId)) {
            throw new ManufacturingDomainError("RECOVERY_ROUTING_FAILURE", `duplicate routing step id: ${stepId}`, false);
          }
          stepIds.add(stepId);
          const predecessors = readArray(step, ["predecessorStepIds"]).map((entry) => String(entry));
          const successors = readArray(step, ["successorStepIds"]).map((entry) => String(entry));
          for (const predecessor of predecessors) {
            if (!predecessors.includes(predecessor) || predecessor === stepId) {
              /* noop */
            }
          }
          edges.set(stepId, successors);
        }
        for (const step of steps) {
          const stepId = requireString(step, ["routingStepId"], `invalid routing step: ${routingId}`);
          for (const predecessor of readArray(step, ["predecessorStepIds"]).map((entry) => String(entry))) {
            if (!stepIds.has(predecessor)) {
              throw new ManufacturingDomainError("RECOVERY_ROUTING_FAILURE", `missing routing predecessor reference: ${stepId}`, false);
            }
          }
          for (const successor of readArray(step, ["successorStepIds"]).map((entry) => String(entry))) {
            if (!stepIds.has(successor)) {
              throw new ManufacturingDomainError("RECOVERY_ROUTING_FAILURE", `missing routing successor reference: ${stepId}`, false);
            }
          }
        }
        if (hasCycle(edges)) {
          throw new ManufacturingDomainError("RECOVERY_ROUTING_FAILURE", `routing structural cycle detected: ${routingId}`, false);
        }
      }

      for (const operation of tenant.operationExecutions) {
        const operationId = requireString(operation, ["execution", "operationExecutionId"], "persisted operation id is invalid");
        if (allOperationIds.has(operationId)) {
          throw new ManufacturingDomainError("RECOVERY_ROUTING_FAILURE", `duplicate operation execution id: ${operationId}`, false);
        }
        allOperationIds.add(operationId);
        const workOrderId = requireString(operation, ["execution", "workOrderId"], `operation work order missing: ${operationId}`);
        if (!allWorkOrderIds.has(workOrderId)) {
          throw new ManufacturingDomainError("RECOVERY_ROUTING_FAILURE", `invalid operation work order relationship: ${operationId}`, false);
        }
        const routingId = requireString(operation, ["execution", "executionRoutingId"], `operation routing missing: ${operationId}`);
        if (!allRoutingIds.has(routingId)) {
          throw new ManufacturingDomainError("RECOVERY_ROUTING_FAILURE", `invalid operation routing relationship: ${operationId}`, false);
        }
      }

      for (const requirement of tenant.materialRequirements) {
        const requirementId = requireString(requirement, ["materialRequirementId"], "persisted material requirement id is invalid");
        if (allMaterialRequirementIds.has(requirementId)) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `duplicate material requirement id: ${requirementId}`, false);
        }
        allMaterialRequirementIds.add(requirementId);
        const workOrderId = requireString(requirement, ["workOrderId"], `material requirement work order missing: ${requirementId}`);
        if (!allWorkOrderIds.has(workOrderId)) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `broken work order/material relationship: ${requirementId}`, false);
        }
        nonNegative(requireNumber(requirement, ["requiredQuantity", "value"], `invalid material required quantity: ${requirementId}`), `invalid material required quantity: ${requirementId}`);
      }

      for (const output of tenant.productionOutputs) {
        const outputId = requireString(output, ["productionOutputId"], "persisted output id is invalid");
        if (allOutputIds.has(outputId)) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `duplicate production output id: ${outputId}`, false);
        }
        allOutputIds.add(outputId);
        if (!allWorkOrderIds.has(requireString(output, ["workOrderId"], `output work order missing: ${outputId}`))) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `broken output work order relationship: ${outputId}`, false);
        }
        if (!allOperationIds.has(requireString(output, ["operationExecutionId"], `output operation missing: ${outputId}`))) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `broken output operation relationship: ${outputId}`, false);
        }
        nonNegative(requireNumber(output, ["quantity"], `invalid output quantity: ${outputId}`), `invalid output quantity: ${outputId}`);
      }

      const wipKeys = new Set<string>();
      for (const wip of tenant.wipStates) {
        const workOrderId = requireString(wip, ["workOrderId"], "persisted wip work order is invalid");
        if (!allWorkOrderIds.has(workOrderId)) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `broken wip relationship: ${workOrderId}`, false);
        }
        const key = `${tenant.tenantId}:${workOrderId}`;
        if (wipKeys.has(key)) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `duplicate wip state: ${workOrderId}`, false);
        }
        wipKeys.add(key);
        nonNegative(requireNumber(wip, ["quantityWaiting"], `invalid wip waiting quantity: ${workOrderId}`), `invalid wip waiting quantity: ${workOrderId}`);
        nonNegative(requireNumber(wip, ["quantityInProcess"], `invalid wip in-process quantity: ${workOrderId}`), `invalid wip in-process quantity: ${workOrderId}`);
      }

      const workCenterCodes = new Set<string>();
      for (const workCenter of tenant.workCenters) {
        const id = requireString(workCenter, ["workCenterId"], "persisted work center id is invalid");
        const codeKey = `${tenant.tenantId}:${requireString(workCenter, ["workCenterCode"], `invalid work center code: ${id}`)}`;
        if (workCenterCodes.has(codeKey)) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `duplicate work center code: ${codeKey}`, false);
        }
        workCenterCodes.add(codeKey);
      }

      const productionCellIds = new Set(tenant.productionCells.map((entry) => requireString(entry, ["productionCellId"], "invalid production cell id")));
      for (const assignment of [...tenant.machineAssignments, ...tenant.toolAssignments, ...tenant.laborAssignments]) {
        const assignmentId = requireString(assignment, [Object.keys(assignment).find((key) => key.endsWith("AssignmentId")) ?? ""], "invalid assignment id");
        if (allAssignmentIds.has(assignmentId)) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `duplicate assignment id: ${assignmentId}`, false);
        }
        allAssignmentIds.add(assignmentId);
        const operationId = requireString(assignment, ["operationExecutionId"], `invalid assignment operation: ${assignmentId}`);
        if (!allOperationIds.has(operationId)) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `broken assignment operation relationship: ${assignmentId}`, false);
        }
        const productionCellId = readString(assignment, ["productionCellId"]);
        if (productionCellId && !productionCellIds.has(productionCellId)) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `broken assignment production cell relationship: ${assignmentId}`, false);
        }
      }

      for (const downtime of tenant.downtimeRecords) {
        const downtimeId = requireString(downtime, ["downtimeRecordId"], "persisted downtime id is invalid");
        const workOrderId = requireString(downtime, ["workOrderId"], `invalid downtime work order: ${downtimeId}`);
        if (!allWorkOrderIds.has(workOrderId)) {
          throw new ManufacturingDomainError("RECOVERY_INVARIANT_FAILURE", `broken downtime work order relationship: ${downtimeId}`, false);
        }
        const duration = readNumber(downtime, ["duration"]);
        if (duration !== undefined) {
          nonNegative(duration, `invalid downtime duration: ${downtimeId}`);
        }
      }

      for (const trace of tenant.traceRecords) {
        const traceId = requireString(trace, ["productionTraceId"], "persisted trace id is invalid");
        if (allTraceIds.has(traceId)) {
          throw new ManufacturingDomainError("RECOVERY_TRACEABILITY_FAILURE", `duplicate trace id: ${traceId}`, false);
        }
        allTraceIds.add(traceId);
        if (requireString(trace, ["sourceType"], `invalid trace source type: ${traceId}`) === requireString(trace, ["targetType"], `invalid trace target type: ${traceId}`) && requireString(trace, ["sourceId"], `invalid trace source id: ${traceId}`) === requireString(trace, ["targetId"], `invalid trace target id: ${traceId}`)) {
          throw new ManufacturingDomainError("RECOVERY_TRACEABILITY_FAILURE", `invalid self trace relation: ${traceId}`, false);
        }
        const workOrderId = readString(trace, ["workOrderId"]);
        if (workOrderId && !allWorkOrderIds.has(workOrderId)) {
          throw new ManufacturingDomainError("RECOVERY_TRACEABILITY_FAILURE", `broken trace work order reference: ${traceId}`, false);
        }
      }

      this.validateIdempotencyPartition(tenant);
    }
  }

  private validateIdempotencyPartition(tenant: ManufacturingPersistenceTenantPartition): void {
    const all = [
      ...tenant.idempotency.workOrders,
      ...tenant.idempotency.productionRuns,
      ...tenant.idempotency.productionBatches,
      ...tenant.idempotency.productBaselines,
      ...tenant.idempotency.routings,
      ...tenant.idempotency.operations,
      ...tenant.idempotency.operationInitialization,
      ...tenant.idempotency.materialRequirements,
      ...tenant.idempotency.materialIssues,
      ...tenant.idempotency.materialReturns,
      ...tenant.idempotency.materialConsumption,
      ...tenant.idempotency.productionOutputs,
      ...tenant.idempotency.scrapRecords,
      ...tenant.idempotency.reworkRecords,
      ...tenant.idempotency.workCenters,
      ...tenant.idempotency.productionCells,
      ...tenant.idempotency.machineAssignments,
      ...tenant.idempotency.toolAssignments,
      ...tenant.idempotency.laborAssignments,
      ...tenant.idempotency.downtimeRecords,
      ...tenant.idempotency.executionExceptions,
      ...tenant.idempotency.traceRecords,
    ];
    const keys = new Set<string>();
    for (const entry of all) {
      if (typeof entry.key !== "string" || entry.key.trim().length === 0) {
        throw new ManufacturingDomainError("RECOVERY_IDEMPOTENCY_FAILURE", "invalid idempotency key record", false);
      }
      if (keys.has(entry.key)) {
        throw new ManufacturingDomainError("RECOVERY_IDEMPOTENCY_FAILURE", `duplicate idempotency key: ${entry.key}`, false);
      }
      keys.add(entry.key);
    }
  }

  private validateReferenceRecoveryPolicy(): void {
    const referenceHealth = this.options.services.referenceValidation.getReferenceHealth();
    if (referenceHealth.requiredFamiliesMissingValidator.length > 0) {
      throw new ManufacturingDomainError(
        "RECOVERY_REFERENCE_FAILURE",
        `mandatory reference validator missing during recovery: ${referenceHealth.requiredFamiliesMissingValidator.join(",")}`,
        false,
      );
    }
  }

  private rebuildProjections(): void {
    try {
      this.options.services.metrics.snapshot();
      void this.options.services.health.snapshot();
      const unresolvedReconciliation = this.countReconciliationRequiredRecords();
      if (unresolvedReconciliation > 0) {
        void this.emitAudit(
          "manufacturing.recovery.reconciliation-restored",
          `reconciliation evidence restored: ${unresolvedReconciliation}`,
          true,
        );
      }
      this.recovery.markProjectionRebuild(true);
      void this.emitAudit("manufacturing.recovery.projection-rebuild", "projection rebuild completed", true);
    } catch (error) {
      this.recovery.markProjectionRebuild(false);
      const message = error instanceof Error ? error.message : "projection rebuild failed";
      throw new ManufacturingDomainError("PROJECTION_REBUILD_FAILURE", message, false);
    }
  }

  private countReconciliationRequiredRecords(): number {
    let count = 0;
    for (const record of mapValues(asMap(this.options.services.outputs, "byId"))) {
      if (readString(record, ["status"]) === "RECONCILIATION_REQUIRED") {
        count += 1;
      }
    }
    for (const record of mapValues(asMap(this.options.services.issues, "issueById"))) {
      if (readString(record, ["status"]) === "RECONCILIATION_REQUIRED") {
        count += 1;
      }
    }
    for (const record of mapValues(asMap(this.options.services.consumption, "byId"))) {
      if (readString(record, ["status"]) === "RECONCILIATION_REQUIRED") {
        count += 1;
      }
    }
    return count;
  }

  private classifyRecoveryFailure(message: string): string {
    const normalized = message.toLowerCase();
    if (normalized.includes("schema version")) return "UNSUPPORTED_PERSISTENCE_SCHEMA";
    if (normalized.includes("tenant mismatch")) return "PERSISTED_TENANT_MISMATCH";
    if (normalized.includes("trace")) return "RECOVERY_TRACEABILITY_FAILURE";
    if (normalized.includes("routing") || normalized.includes("operation")) return "RECOVERY_ROUTING_FAILURE";
    if (normalized.includes("idempotency")) return "RECOVERY_IDEMPOTENCY_FAILURE";
    if (normalized.includes("version")) return "RECOVERY_VERSION_FAILURE";
    return "RECOVERY_FAILED";
  }

  private async emitAudit(
    eventType: string,
    message: string,
    success: boolean,
    resultClassification?: string,
    details?: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    try {
      await this.options.services.audit.getAuditSinkProvider().recordAudit({
        eventType,
        message,
        recordedAt: this.options.clock.now(),
        details: {
          action: eventType.toUpperCase().replaceAll(".", "_"),
          success,
          resultClassification,
          ...(details ?? {}),
        },
      });
    } catch {
      /* ignore audit sink failures during persistence bookkeeping */
    }
  }
}
