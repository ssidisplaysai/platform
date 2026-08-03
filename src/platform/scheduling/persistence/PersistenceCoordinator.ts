import {
  FileScheduleAuditStore,
  FileScheduleClaimStore,
  FileScheduleDefinitionStore,
  FileScheduleInstanceStore,
  FileScheduleMetricsStore,
  FileScheduleOccurrenceStore,
  SchedulingDataStore,
} from "./FileStores";
import type { ScheduleAuditStore } from "./ScheduleAuditStore";
import type { ScheduleClaimStore } from "./ScheduleClaimStore";
import type { ScheduleDefinitionStore } from "./ScheduleDefinitionStore";
import type { ScheduleInstanceStore } from "./ScheduleInstanceStore";
import type { ScheduleMetricsStore } from "./ScheduleMetricsStore";
import type { ScheduleOccurrenceStore } from "./ScheduleOccurrenceStore";
import type { SchedulingRecoverySnapshotResult } from "./types";

export interface SchedulingPersistenceCoordinator {
  readonly definitionStore: ScheduleDefinitionStore;
  readonly instanceStore: ScheduleInstanceStore;
  readonly occurrenceStore: ScheduleOccurrenceStore;
  readonly claimStore: ScheduleClaimStore;
  readonly auditStore: ScheduleAuditStore;
  readonly metricsStore: ScheduleMetricsStore;
  loadRecoverySnapshot(): Promise<SchedulingRecoverySnapshotResult>;
}

export class FileSchedulingPersistenceCoordinator implements SchedulingPersistenceCoordinator {
  private readonly dataStore: SchedulingDataStore;
  readonly definitionStore: ScheduleDefinitionStore;
  readonly instanceStore: ScheduleInstanceStore;
  readonly occurrenceStore: ScheduleOccurrenceStore;
  readonly claimStore: ScheduleClaimStore;
  readonly auditStore: ScheduleAuditStore;
  readonly metricsStore: ScheduleMetricsStore;

  constructor(basePath?: string) {
    this.dataStore = new SchedulingDataStore(basePath);
    this.definitionStore = new FileScheduleDefinitionStore(this.dataStore);
    this.instanceStore = new FileScheduleInstanceStore(this.dataStore);
    this.occurrenceStore = new FileScheduleOccurrenceStore(this.dataStore);
    this.claimStore = new FileScheduleClaimStore(this.dataStore);
    this.auditStore = new FileScheduleAuditStore(this.dataStore);
    this.metricsStore = new FileScheduleMetricsStore(this.dataStore);
  }

  async loadRecoverySnapshot(): Promise<SchedulingRecoverySnapshotResult> {
    return this.dataStore.readWithDiagnostics();
  }
}
