import { join } from "node:path";
import { JsonFileStore } from "@/platform/messaging/persistence/JsonFileStore";
import type { WorkflowAudit, WorkflowCheckpoint, WorkflowDefinition, WorkflowExecutionRecord, WorkflowInstance, WorkflowMetrics } from "../contracts";
import type { WorkflowAuditStore } from "./WorkflowAuditStore";
import type { WorkflowCheckpointStore } from "./WorkflowCheckpointStore";
import type { WorkflowCommandStore } from "./WorkflowCommandStore";
import type { WorkflowCompensationStore } from "./WorkflowCompensationStore";
import type { WorkflowDefinitionStore } from "./WorkflowDefinitionStore";
import type { WorkflowExecutionHistoryStore } from "./WorkflowExecutionHistoryStore";
import type { WorkflowInstanceStore } from "./WorkflowInstanceStore";
import type { WorkflowMetricsStore } from "./WorkflowMetricsStore";
import type { WorkflowRetryStore } from "./WorkflowRetryStore";
import type { WorkflowTimeoutStore } from "./WorkflowTimeoutStore";
import type {
  WorkflowCommandRecord,
  WorkflowCompensationRecord,
  WorkflowRetryRecord,
  WorkflowTimeoutRecord,
} from "./types";

type WorkflowData = {
  definitions: WorkflowDefinition[];
  instances: WorkflowInstance[];
  checkpoints: WorkflowCheckpoint[];
  executionHistory: WorkflowExecutionRecord[];
  retries: WorkflowRetryRecord[];
  timeouts: WorkflowTimeoutRecord[];
  compensations: WorkflowCompensationRecord[];
  audits: WorkflowAudit[];
  metrics: WorkflowMetrics | null;
  commands: WorkflowCommandRecord[];
};

const defaultWorkflowData: WorkflowData = {
  definitions: [],
  instances: [],
  checkpoints: [],
  executionHistory: [],
  retries: [],
  timeouts: [],
  compensations: [],
  audits: [],
  metrics: null,
  commands: [],
};

export class WorkflowDataStore {
  private readonly store: JsonFileStore<WorkflowData>;

  constructor(basePath?: string) {
    const root = basePath ?? join(process.cwd(), "data", "workflow");
    this.store = new JsonFileStore(join(root, "workflow-state.json"), defaultWorkflowData);
  }

  read(): Promise<WorkflowData> {
    return this.store.read();
  }

  write(data: WorkflowData): Promise<void> {
    return this.store.write(data);
  }
}

export class FileWorkflowDefinitionStore implements WorkflowDefinitionStore {
  constructor(private readonly dataStore: WorkflowDataStore) {}

  async save(definition: WorkflowDefinition): Promise<void> {
    const data = await this.dataStore.read();
    data.definitions = data.definitions.filter((item) => item.id !== definition.id);
    data.definitions.push(structuredClone(definition));
    await this.dataStore.write(data);
  }

  async get(definitionId: string): Promise<WorkflowDefinition | null> {
    const data = await this.dataStore.read();
    const found = data.definitions.find((item) => item.id === definitionId);
    return found ? structuredClone(found) : null;
  }

  async list(): Promise<WorkflowDefinition[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.definitions);
  }
}

export class FileWorkflowInstanceStore implements WorkflowInstanceStore {
  constructor(private readonly dataStore: WorkflowDataStore) {}

  async create(instance: WorkflowInstance): Promise<void> {
    const data = await this.dataStore.read();
    data.instances = data.instances.filter((item) => item.instanceId !== instance.instanceId);
    data.instances.push(structuredClone(instance));
    await this.dataStore.write(data);
  }

  async get(instanceId: string): Promise<WorkflowInstance | null> {
    const data = await this.dataStore.read();
    const found = data.instances.find((item) => item.instanceId === instanceId);
    return found ? structuredClone(found) : null;
  }

  async update(instance: WorkflowInstance, expectedVersion: number): Promise<"UPDATED" | "STALE"> {
    const data = await this.dataStore.read();
    const index = data.instances.findIndex((item) => item.instanceId === instance.instanceId);
    if (index < 0) {
      return "STALE";
    }

    const current = data.instances[index];
    if ((current.version ?? 0) !== expectedVersion) {
      return "STALE";
    }

    data.instances[index] = structuredClone(instance);
    await this.dataStore.write(data);
    return "UPDATED";
  }

  async list(): Promise<WorkflowInstance[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.instances);
  }
}

export class FileWorkflowCheckpointStore implements WorkflowCheckpointStore {
  constructor(private readonly dataStore: WorkflowDataStore) {}

  async append(checkpoint: WorkflowCheckpoint): Promise<void> {
    const data = await this.dataStore.read();
    data.checkpoints.push(structuredClone(checkpoint));
    await this.dataStore.write(data);
  }

  async list(instanceId: string): Promise<WorkflowCheckpoint[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.checkpoints.filter((item) => item.instanceId === instanceId));
  }

  async listAll(): Promise<WorkflowCheckpoint[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.checkpoints);
  }
}

export class FileWorkflowExecutionHistoryStore implements WorkflowExecutionHistoryStore {
  constructor(private readonly dataStore: WorkflowDataStore) {}

  async append(record: WorkflowExecutionRecord): Promise<void> {
    const data = await this.dataStore.read();
    data.executionHistory.push(structuredClone(record));
    await this.dataStore.write(data);
  }

  async list(instanceId: string): Promise<WorkflowExecutionRecord[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.executionHistory.filter((item) => item.instanceId === instanceId));
  }

  async listAll(): Promise<WorkflowExecutionRecord[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.executionHistory);
  }
}

export class FileWorkflowRetryStore implements WorkflowRetryStore {
  constructor(private readonly dataStore: WorkflowDataStore) {}

  async append(record: WorkflowRetryRecord): Promise<void> {
    const data = await this.dataStore.read();
    data.retries.push(structuredClone(record));
    await this.dataStore.write(data);
  }

  async clear(instanceId: string, stepId: string): Promise<void> {
    const data = await this.dataStore.read();
    data.retries = data.retries.filter((item) => item.instanceId !== instanceId || item.stepId !== stepId);
    await this.dataStore.write(data);
  }

  async list(): Promise<WorkflowRetryRecord[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.retries);
  }
}

export class FileWorkflowTimeoutStore implements WorkflowTimeoutStore {
  constructor(private readonly dataStore: WorkflowDataStore) {}

  async upsert(record: WorkflowTimeoutRecord): Promise<void> {
    const data = await this.dataStore.read();
    const index = data.timeouts.findIndex((item) => item.instanceId === record.instanceId && item.stepId === record.stepId);
    if (index >= 0) {
      data.timeouts[index] = structuredClone(record);
    } else {
      data.timeouts.push(structuredClone(record));
    }
    await this.dataStore.write(data);
  }

  async resolve(instanceId: string, stepId: string): Promise<void> {
    const data = await this.dataStore.read();
    data.timeouts = data.timeouts.map((item) => {
      if (item.instanceId === instanceId && item.stepId === stepId) {
        return { ...item, status: "RESOLVED" as const };
      }

      return item;
    });
    await this.dataStore.write(data);
  }

  async list(): Promise<WorkflowTimeoutRecord[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.timeouts);
  }
}

export class FileWorkflowCompensationStore implements WorkflowCompensationStore {
  constructor(private readonly dataStore: WorkflowDataStore) {}

  async append(record: WorkflowCompensationRecord): Promise<void> {
    const data = await this.dataStore.read();
    data.compensations.push(structuredClone(record));
    await this.dataStore.write(data);
  }

  async list(): Promise<WorkflowCompensationRecord[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.compensations);
  }
}

export class FileWorkflowAuditStore implements WorkflowAuditStore {
  constructor(private readonly dataStore: WorkflowDataStore) {}

  async append(record: WorkflowAudit): Promise<void> {
    const data = await this.dataStore.read();
    data.audits.push(structuredClone(record));
    await this.dataStore.write(data);
  }

  async list(): Promise<WorkflowAudit[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.audits);
  }
}

export class FileWorkflowMetricsStore implements WorkflowMetricsStore {
  constructor(private readonly dataStore: WorkflowDataStore) {}

  async save(metrics: WorkflowMetrics): Promise<void> {
    const data = await this.dataStore.read();
    data.metrics = structuredClone(metrics);
    await this.dataStore.write(data);
  }

  async load(): Promise<WorkflowMetrics | null> {
    const data = await this.dataStore.read();
    return data.metrics ? structuredClone(data.metrics) : null;
  }
}

export class FileWorkflowCommandStore implements WorkflowCommandStore {
  constructor(private readonly dataStore: WorkflowDataStore) {}

  async append(record: WorkflowCommandRecord): Promise<void> {
    const data = await this.dataStore.read();
    data.commands = data.commands.filter((item) => item.commandKey !== record.commandKey);
    data.commands.push(structuredClone(record));
    await this.dataStore.write(data);
  }

  async get(commandKey: string): Promise<WorkflowCommandRecord | null> {
    const data = await this.dataStore.read();
    const found = data.commands.find((item) => item.commandKey === commandKey);
    return found ? structuredClone(found) : null;
  }

  async list(): Promise<WorkflowCommandRecord[]> {
    const data = await this.dataStore.read();
    return structuredClone(data.commands);
  }
}
