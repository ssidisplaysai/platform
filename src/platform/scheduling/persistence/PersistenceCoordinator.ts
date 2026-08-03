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
import type { SchedulingRecoverySnapshot } from "./types";

export interface SchedulingPersistenceCoordinator {
  readonly definitionStore: ScheduleDefinitionStore;
  readonly instanceStore: ScheduleInstanceStore;
  readonly occurrenceStore: ScheduleOccurrenceStore;
  readonly claimStore: ScheduleClaimStore;
  readonly auditStore: ScheduleAuditStore;
  readonly metricsStore: ScheduleMetricsStore;
  loadRecoverySnapshot(): Promise<SchedulingRecoverySnapshot>;
}

export class FileSchedulingPersistenceCoordinator implements SchedulingPersistenceCoordinator {
  readonly definitionStore: ScheduleDefinitionStore;
  readonly instanceStore: ScheduleInstanceStore;
  readonly occurrenceStore: ScheduleOccurrenceStore;
  readonly claimStore: ScheduleClaimStore;
  readonly auditStore: ScheduleAuditStore;
  readonly metricsStore: ScheduleMetricsStore;

  constructor(basePath?: string) {
    const dataStore = new SchedulingDataStore(basePath);
    this.definitionStore = new FileScheduleDefinitionStore(dataStore);
    this.instanceStore = new FileScheduleInstanceStore(dataStore);
    this.occurrenceStore = new FileScheduleOccurrenceStore(dataStore);
    this.claimStore = new FileScheduleClaimStore(dataStore);
    this.auditStore = new FileScheduleAuditStore(dataStore);
    this.metricsStore = new FileScheduleMetricsStore(dataStore);
  }

  async loadRecoverySnapshot(): Promise<SchedulingRecoverySnapshot> {
    const [definitions, instances, occurrences, claims, audits, metrics] = await Promise.all([
      this.definitionStore.list(),
      this.instanceStore.list(),
      this.occurrenceStore.listAll(),
      this.claimStore.list(),
      this.auditStore.list(),
      this.metricsStore.load(),
    ]);

    return {
      definitions,
      instances,
      occurrences,
      claims,
      audits,
      metrics,
    };
  }
}
