import type {
  WorkflowAuditStore,
} from "./WorkflowAuditStore";
import type { WorkflowCheckpointStore } from "./WorkflowCheckpointStore";
import type { WorkflowCommandStore } from "./WorkflowCommandStore";
import type { WorkflowCompensationStore } from "./WorkflowCompensationStore";
import type { WorkflowDefinitionStore } from "./WorkflowDefinitionStore";
import type { WorkflowExecutionHistoryStore } from "./WorkflowExecutionHistoryStore";
import {
  FileWorkflowAuditStore,
  FileWorkflowCheckpointStore,
  FileWorkflowCommandStore,
  FileWorkflowCompensationStore,
  FileWorkflowDefinitionStore,
  FileWorkflowExecutionHistoryStore,
  FileWorkflowInstanceStore,
  FileWorkflowMetricsStore,
  FileWorkflowRetryStore,
  FileWorkflowTimeoutStore,
  WorkflowDataStore,
} from "./FileStores";
import type { WorkflowInstanceStore } from "./WorkflowInstanceStore";
import type { WorkflowMetricsStore } from "./WorkflowMetricsStore";
import type { WorkflowRetryStore } from "./WorkflowRetryStore";
import type { WorkflowTimeoutStore } from "./WorkflowTimeoutStore";
import type { WorkflowRecoverySnapshot } from "./types";

export interface WorkflowPersistenceCoordinator {
  readonly definitionStore: WorkflowDefinitionStore;
  readonly instanceStore: WorkflowInstanceStore;
  readonly checkpointStore: WorkflowCheckpointStore;
  readonly executionHistoryStore: WorkflowExecutionHistoryStore;
  readonly retryStore: WorkflowRetryStore;
  readonly timeoutStore: WorkflowTimeoutStore;
  readonly compensationStore: WorkflowCompensationStore;
  readonly auditStore: WorkflowAuditStore;
  readonly metricsStore: WorkflowMetricsStore;
  readonly commandStore: WorkflowCommandStore;
  loadRecoverySnapshot(): Promise<WorkflowRecoverySnapshot>;
}

export class FileWorkflowPersistenceCoordinator implements WorkflowPersistenceCoordinator {
  readonly definitionStore: WorkflowDefinitionStore;
  readonly instanceStore: WorkflowInstanceStore;
  readonly checkpointStore: WorkflowCheckpointStore;
  readonly executionHistoryStore: WorkflowExecutionHistoryStore;
  readonly retryStore: WorkflowRetryStore;
  readonly timeoutStore: WorkflowTimeoutStore;
  readonly compensationStore: WorkflowCompensationStore;
  readonly auditStore: WorkflowAuditStore;
  readonly metricsStore: WorkflowMetricsStore;
  readonly commandStore: WorkflowCommandStore;

  constructor(basePath?: string) {
    const dataStore = new WorkflowDataStore(basePath);
    this.definitionStore = new FileWorkflowDefinitionStore(dataStore);
    this.instanceStore = new FileWorkflowInstanceStore(dataStore);
    this.checkpointStore = new FileWorkflowCheckpointStore(dataStore);
    this.executionHistoryStore = new FileWorkflowExecutionHistoryStore(dataStore);
    this.retryStore = new FileWorkflowRetryStore(dataStore);
    this.timeoutStore = new FileWorkflowTimeoutStore(dataStore);
    this.compensationStore = new FileWorkflowCompensationStore(dataStore);
    this.auditStore = new FileWorkflowAuditStore(dataStore);
    this.metricsStore = new FileWorkflowMetricsStore(dataStore);
    this.commandStore = new FileWorkflowCommandStore(dataStore);
  }

  async loadRecoverySnapshot(): Promise<WorkflowRecoverySnapshot> {
    const [
      definitions,
      instances,
      checkpoints,
      executionHistory,
      retries,
      timeouts,
      compensations,
      audits,
      metrics,
      commands,
    ] = await Promise.all([
      this.definitionStore.list(),
      this.instanceStore.list(),
      this.checkpointStore.listAll(),
      this.executionHistoryStore.listAll(),
      this.retryStore.list(),
      this.timeoutStore.list(),
      this.compensationStore.list(),
      this.auditStore.list(),
      this.metricsStore.load(),
      this.commandStore.list(),
    ]);

    return {
      definitions,
      instances,
      checkpoints,
      executionHistory,
      retries,
      timeouts,
      compensations,
      audits,
      metrics,
      commands,
    };
  }
}
