import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  ScheduleAuditRecord,
  ScheduleDefinition,
  ScheduleInstance,
  ScheduleMetrics,
  ScheduleOccurrence,
} from "../contracts";
import type { ScheduleAuditStore } from "./ScheduleAuditStore";
import type { ScheduleClaimStore } from "./ScheduleClaimStore";
import type { ScheduleDefinitionStore } from "./ScheduleDefinitionStore";
import type { ScheduleInstanceStore } from "./ScheduleInstanceStore";
import type { ScheduleMetricsStore } from "./ScheduleMetricsStore";
import type { ScheduleOccurrenceStore } from "./ScheduleOccurrenceStore";
import type {
  AtomicClaimInput,
  AtomicClaimResult,
  ScheduleClaimRecord,
  SchedulingRecoveryDiagnostics,
  SchedulingRecoverySnapshotResult,
} from "./types";

type SchedulingData = {
  definitions: ScheduleDefinition[];
  instances: ScheduleInstance[];
  occurrences: ScheduleOccurrence[];
  claims: ScheduleClaimRecord[];
  audits: ScheduleAuditRecord[];
  metrics: ScheduleMetrics | null;
};

const defaultSchedulingData: SchedulingData = {
  definitions: [],
  instances: [],
  occurrences: [],
  claims: [],
  audits: [],
  metrics: null,
};

const emptyDiagnostics: SchedulingRecoveryDiagnostics = {
  classification: "CLEAN",
  missingFile: false,
  corruptFile: false,
  invalidDefinitions: 0,
  invalidInstances: 0,
  invalidOccurrences: 0,
  invalidClaims: 0,
  invalidAudits: 0,
  invalidMetrics: 0,
  totalInvalidRecords: 0,
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isScheduleDefinition(value: unknown): value is ScheduleDefinition {
  if (!isObject(value)) {
    return false;
  }

  const version = value.version;
  const timezone = value.timezone;
  const command = value.command;

  return typeof value.scheduleId === "string"
    && typeof value.name === "string"
    && typeof value.scheduleType === "string"
    && isObject(version)
    && isFiniteNumber(version.major)
    && isFiniteNumber(version.minor)
    && isFiniteNumber(version.patch)
    && typeof value.state === "string"
    && isObject(timezone)
    && typeof timezone.ianaName === "string"
    && isObject(command)
    && typeof command.topic === "string"
    && typeof command.commandType === "string"
    && isObject(value.missedRunPolicy)
    && typeof value.createdBy === "string"
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string";
}

function isScheduleInstance(value: unknown): value is ScheduleInstance {
  if (!isObject(value)) {
    return false;
  }

  const version = value.scheduleVersion;
  return typeof value.instanceId === "string"
    && typeof value.scheduleId === "string"
    && isObject(version)
    && isFiniteNumber(version.major)
    && isFiniteNumber(version.minor)
    && isFiniteNumber(version.patch)
    && typeof value.state === "string"
    && (typeof value.nextRunAt === "string" || value.nextRunAt === null)
    && (typeof value.lastRunAt === "string" || value.lastRunAt === null)
    && isFiniteNumber(value.occurrenceCount)
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string";
}

function isScheduleOccurrence(value: unknown): value is ScheduleOccurrence {
  if (!isObject(value) || !isObject(value.trigger)) {
    return false;
  }

  return typeof value.occurrenceId === "string"
    && typeof value.instanceId === "string"
    && typeof value.scheduleId === "string"
    && typeof value.dueAt === "string"
    && typeof value.trigger.triggerType === "string"
    && typeof value.trigger.evaluatedAt === "string"
    && typeof value.status === "string";
}

function isScheduleClaim(value: unknown): value is ScheduleClaimRecord {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.claimId === "string"
    && typeof value.occurrenceId === "string"
    && typeof value.idempotencyKey === "string"
    && typeof value.status === "string"
    && typeof value.claimedAt === "string"
    && typeof value.expiresAt === "string"
    && typeof value.owner === "string";
}

function isScheduleAudit(value: unknown): value is ScheduleAuditRecord {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.recordId === "string"
    && typeof value.scheduleId === "string"
    && typeof value.eventType === "string"
    && typeof value.message === "string"
    && typeof value.actorId === "string"
    && typeof value.recordedAt === "string";
}

function isScheduleMetrics(value: unknown): value is ScheduleMetrics {
  if (!isObject(value)) {
    return false;
  }

  const requiredNumberFields: Array<keyof ScheduleMetrics> = [
    "registeredSchedules",
    "activeSchedules",
    "pausedSchedules",
    "completedSchedules",
    "failedSchedules",
    "dueOccurrences",
    "claimedOccurrences",
    "dispatchedOccurrences",
    "skippedOccurrences",
    "missedOccurrences",
    "catchUpOccurrences",
    "duplicateClaimRejections",
    "claimConflicts",
    "dstAmbiguityCount",
    "corruptPersistenceCount",
    "recoveryFailures",
    "dispatchRetryCount",
    "auditFailureCount",
    "dispatchFailures",
    "recoveryCount",
    "averageSchedulingDelayMs",
    "averageDispatchLatencyMs",
  ];

  for (const field of requiredNumberFields) {
    if (!isFiniteNumber(value[field])) {
      return false;
    }
  }

  return value.oldestOverdueOccurrenceAgeMs === null || isFiniteNumber(value.oldestOverdueOccurrenceAgeMs);
}

export class SchedulingDataStore {
  private readonly filePath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(basePath?: string) {
    const root = basePath ?? join(process.cwd(), "data", "scheduling");
    this.filePath = join(root, "scheduling-state.json");
  }

  read(): Promise<SchedulingData> {
    return this.readWithDiagnostics().then((result) => result.snapshot);
  }

  write(data: SchedulingData): Promise<void> {
    return this.updateWithLock(async () => clone(data));
  }

  async updateWithLock(mutator: (data: SchedulingData) => SchedulingData | Promise<SchedulingData>): Promise<void> {
    const operation = async (): Promise<void> => {
      const current = await this.read();
      const updated = await mutator(current);
      await this.persist(updated);
    };

    const result = this.writeQueue.then(operation, operation);
    this.writeQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  async readWithDiagnostics(): Promise<SchedulingRecoverySnapshotResult> {
    const diagnostics = clone(emptyDiagnostics);

    let rawData: unknown = null;
    try {
      const raw = await readFile(this.filePath, "utf8");
      rawData = JSON.parse(raw) as unknown;
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: string }).code
        : undefined;
      if (code === "ENOENT") {
        diagnostics.classification = "MISSING_FILE";
        diagnostics.missingFile = true;
      } else {
        diagnostics.classification = "CORRUPT_FILE";
        diagnostics.corruptFile = true;
      }

      return {
        snapshot: clone(defaultSchedulingData),
        diagnostics,
      };
    }

    if (!isObject(rawData)) {
      diagnostics.classification = "INVALID_STATE";
      diagnostics.corruptFile = true;
      return {
        snapshot: clone(defaultSchedulingData),
        diagnostics,
      };
    }

    const definitions = asArray(rawData.definitions);
    const instances = asArray(rawData.instances);
    const occurrences = asArray(rawData.occurrences);
    const claims = asArray(rawData.claims);
    const audits = asArray(rawData.audits);

    const sanitized: SchedulingData = {
      definitions: definitions.filter((entry) => {
        const valid = isScheduleDefinition(entry);
        if (!valid) {
          diagnostics.invalidDefinitions += 1;
        }
        return valid;
      }),
      instances: instances.filter((entry) => {
        const valid = isScheduleInstance(entry);
        if (!valid) {
          diagnostics.invalidInstances += 1;
        }
        return valid;
      }),
      occurrences: occurrences.filter((entry) => {
        const valid = isScheduleOccurrence(entry);
        if (!valid) {
          diagnostics.invalidOccurrences += 1;
        }
        return valid;
      }),
      claims: claims.filter((entry) => {
        const valid = isScheduleClaim(entry);
        if (!valid) {
          diagnostics.invalidClaims += 1;
        }
        return valid;
      }),
      audits: audits.filter((entry) => {
        const valid = isScheduleAudit(entry);
        if (!valid) {
          diagnostics.invalidAudits += 1;
        }
        return valid;
      }),
      metrics: isScheduleMetrics(rawData.metrics) ? clone(rawData.metrics) : null,
    };

    if (rawData.metrics !== null && rawData.metrics !== undefined && sanitized.metrics === null) {
      diagnostics.invalidMetrics += 1;
    }

    diagnostics.totalInvalidRecords = diagnostics.invalidDefinitions
      + diagnostics.invalidInstances
      + diagnostics.invalidOccurrences
      + diagnostics.invalidClaims
      + diagnostics.invalidAudits
      + diagnostics.invalidMetrics;

    if (diagnostics.totalInvalidRecords > 0 && diagnostics.classification === "CLEAN") {
      diagnostics.classification = "PARTIAL_STATE";
    }

    return {
      snapshot: sanitized,
      diagnostics,
    };
  }

  private async persist(data: SchedulingData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }
}

export class FileScheduleDefinitionStore implements ScheduleDefinitionStore {
  constructor(private readonly dataStore: SchedulingDataStore) {}

  async save(definition: ScheduleDefinition): Promise<void> {
    const data = await this.dataStore.read();
    data.definitions = data.definitions.filter((entry) => !(entry.scheduleId === definition.scheduleId && entry.version.major === definition.version.major && entry.version.minor === definition.version.minor && entry.version.patch === definition.version.patch));
    data.definitions.push(structuredClone(definition));
    await this.dataStore.write(data);
  }

  async get(scheduleId: string): Promise<ScheduleDefinition | null> {
    const data = await this.dataStore.read();
    const candidates = data.definitions.filter((entry) => entry.scheduleId === scheduleId);
    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => (a.version.major - b.version.major) || (a.version.minor - b.version.minor) || (a.version.patch - b.version.patch));
    return structuredClone(candidates[candidates.length - 1]);
  }

  async list(): Promise<ScheduleDefinition[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.definitions);
  }
}

export class FileScheduleInstanceStore implements ScheduleInstanceStore {
  constructor(private readonly dataStore: SchedulingDataStore) {}

  async create(instance: ScheduleInstance): Promise<void> {
    const data = await this.dataStore.read();
    data.instances = data.instances.filter((entry) => entry.instanceId !== instance.instanceId);
    data.instances.push(structuredClone(instance));
    await this.dataStore.write(data);
  }

  async update(instance: ScheduleInstance): Promise<void> {
    const data = await this.dataStore.read();
    const index = data.instances.findIndex((entry) => entry.instanceId === instance.instanceId);
    if (index >= 0) {
      data.instances[index] = structuredClone(instance);
    } else {
      data.instances.push(structuredClone(instance));
    }
    await this.dataStore.write(data);
  }

  async get(instanceId: string): Promise<ScheduleInstance | null> {
    const data = await this.dataStore.read();
    const found = data.instances.find((entry) => entry.instanceId === instanceId);
    return found ? structuredClone(found) : null;
  }

  async list(): Promise<ScheduleInstance[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.instances);
  }

  async findByScheduleId(scheduleId: string): Promise<ScheduleInstance | null> {
    const data = await this.dataStore.read();
    const found = data.instances.find((entry) => entry.scheduleId === scheduleId);
    return found ? structuredClone(found) : null;
  }
}

export class FileScheduleOccurrenceStore implements ScheduleOccurrenceStore {
  constructor(private readonly dataStore: SchedulingDataStore) {}

  async append(occurrence: ScheduleOccurrence): Promise<void> {
    await this.dataStore.updateWithLock((data) => {
      data.occurrences.push(clone(occurrence));
      return data;
    });
  }

  async update(occurrence: ScheduleOccurrence): Promise<void> {
    await this.dataStore.updateWithLock((data) => {
      const index = data.occurrences.findIndex((entry) => entry.occurrenceId === occurrence.occurrenceId);
      if (index >= 0) {
        data.occurrences[index] = clone(occurrence);
      } else {
        data.occurrences.push(clone(occurrence));
      }
      return data;
    });
  }

  async listByInstance(instanceId: string): Promise<ScheduleOccurrence[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.occurrences.filter((entry) => entry.instanceId === instanceId));
  }

  async listAll(): Promise<ScheduleOccurrence[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.occurrences);
  }

  async findByLogicalRunKey(instanceId: string, logicalRunKey: string): Promise<ScheduleOccurrence | null> {
    const data = await this.dataStore.read();
    const found = data.occurrences.find((entry) => entry.instanceId === instanceId && entry.logicalRunKey === logicalRunKey);
    return found ? clone(found) : null;
  }
}

export class FileScheduleClaimStore implements ScheduleClaimStore {
  constructor(private readonly dataStore: SchedulingDataStore) {}

  async upsert(claim: ScheduleClaimRecord): Promise<void> {
    await this.dataStore.updateWithLock((data) => {
      const index = data.claims.findIndex((entry) => entry.occurrenceId === claim.occurrenceId);
      if (index >= 0) {
        data.claims[index] = clone(claim);
      } else {
        data.claims.push(clone(claim));
      }
      return data;
    });
  }

  async getByOccurrenceId(occurrenceId: string): Promise<ScheduleClaimRecord | null> {
    const data = await this.dataStore.read();
    const found = data.claims.find((entry) => entry.occurrenceId === occurrenceId);
    return found ? structuredClone(found) : null;
  }

  async list(): Promise<ScheduleClaimRecord[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.claims);
  }

  async claimAtomic(input: AtomicClaimInput): Promise<AtomicClaimResult> {
    let result: AtomicClaimResult = { claimed: false, reason: "CONFLICT" };

    await this.dataStore.updateWithLock((data) => {
      const nowMs = new Date(input.claimedAt).getTime();
      const byOccurrence = data.claims.find((entry) => entry.occurrenceId === input.occurrenceId) ?? null;
      const byLogicalRun = input.logicalRunKey
        ? data.claims.find((entry) => entry.logicalRunKey === input.logicalRunKey)
        : null;
      const existing = byOccurrence ?? byLogicalRun;

      if (existing) {
        const expired = existing.status === "CLAIMED" && new Date(existing.expiresAt).getTime() <= nowMs;
        if (!expired) {
          result = {
            claimed: false,
            reason: existing.idempotencyKey === input.idempotencyKey ? "ALREADY_CLAIMED" : "CONFLICT",
            claim: clone(existing),
          };
          return data;
        }

        existing.status = "EXPIRED";
        existing.expiresAt = input.claimedAt;
      }

      const claim: ScheduleClaimRecord = {
        claimId: input.claimId,
        occurrenceId: input.occurrenceId,
        idempotencyKey: input.idempotencyKey,
        logicalRunKey: input.logicalRunKey,
        status: "CLAIMED",
        claimedAt: input.claimedAt,
        expiresAt: input.expiresAt,
        owner: input.owner,
      };

      const index = data.claims.findIndex((entry) => entry.occurrenceId === claim.occurrenceId);
      if (index >= 0) {
        data.claims[index] = clone(claim);
      } else {
        data.claims.push(clone(claim));
      }

      result = { claimed: true, claim: clone(claim) };
      return data;
    });

    return result;
  }
}

export class FileScheduleAuditStore implements ScheduleAuditStore {
  constructor(private readonly dataStore: SchedulingDataStore) {}

  async append(record: ScheduleAuditRecord): Promise<void> {
    const data = await this.dataStore.read();
    data.audits.push(structuredClone(record));
    await this.dataStore.write(data);
  }

  async list(): Promise<ScheduleAuditRecord[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.audits);
  }
}

export class FileScheduleMetricsStore implements ScheduleMetricsStore {
  constructor(private readonly dataStore: SchedulingDataStore) {}

  async save(metrics: ScheduleMetrics): Promise<void> {
    const data = await this.dataStore.read();
    data.metrics = structuredClone(metrics);
    await this.dataStore.write(data);
  }

  async load(): Promise<ScheduleMetrics | null> {
    const data = await this.dataStore.read();
    return data.metrics ? structuredClone(data.metrics) : null;
  }
}
