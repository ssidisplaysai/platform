import { join } from "node:path";
import { JsonFileStore } from "@/platform/messaging/persistence/JsonFileStore";
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
import type { ScheduleClaimRecord } from "./types";

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

export class SchedulingDataStore {
  private readonly store: JsonFileStore<SchedulingData>;

  constructor(basePath?: string) {
    const root = basePath ?? join(process.cwd(), "data", "scheduling");
    this.store = new JsonFileStore(join(root, "scheduling-state.json"), defaultSchedulingData);
  }

  read(): Promise<SchedulingData> {
    return this.store.read();
  }

  write(data: SchedulingData): Promise<void> {
    return this.store.write(data);
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
    const data = await this.dataStore.read();
    data.occurrences.push(structuredClone(occurrence));
    await this.dataStore.write(data);
  }

  async update(occurrence: ScheduleOccurrence): Promise<void> {
    const data = await this.dataStore.read();
    const index = data.occurrences.findIndex((entry) => entry.occurrenceId === occurrence.occurrenceId);
    if (index >= 0) {
      data.occurrences[index] = structuredClone(occurrence);
    } else {
      data.occurrences.push(structuredClone(occurrence));
    }
    await this.dataStore.write(data);
  }

  async listByInstance(instanceId: string): Promise<ScheduleOccurrence[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.occurrences.filter((entry) => entry.instanceId === instanceId));
  }

  async listAll(): Promise<ScheduleOccurrence[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.occurrences);
  }
}

export class FileScheduleClaimStore implements ScheduleClaimStore {
  constructor(private readonly dataStore: SchedulingDataStore) {}

  async upsert(claim: ScheduleClaimRecord): Promise<void> {
    const data = await this.dataStore.read();
    const index = data.claims.findIndex((entry) => entry.occurrenceId === claim.occurrenceId);
    if (index >= 0) {
      data.claims[index] = structuredClone(claim);
    } else {
      data.claims.push(structuredClone(claim));
    }
    await this.dataStore.write(data);
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
