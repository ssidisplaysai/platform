import { join } from "node:path";
import type { AuditStore } from "./AuditStore";
import type { DeadLetterStore } from "./DeadLetterStore";
import { FileAuditStore } from "./FileAuditStore";
import { FileDeadLetterStore } from "./FileDeadLetterStore";
import { FileMessageStore } from "./FileMessageStore";
import { FileMetricsStore } from "./FileMetricsStore";
import { FileRetryStore } from "./FileRetryStore";
import type { MessageStore } from "./MessageStore";
import type { MetricsStore } from "./MetricsStore";
import type { RetryStore } from "./RetryStore";
import type { RecoverySnapshot } from "./types";

export interface PersistenceCoordinator {
  readonly messageStore: MessageStore;
  readonly retryStore: RetryStore;
  readonly deadLetterStore: DeadLetterStore;
  readonly auditStore: AuditStore;
  readonly metricsStore: MetricsStore;
  loadRecoverySnapshot(): Promise<RecoverySnapshot>;
}

export class FilePersistenceCoordinator implements PersistenceCoordinator {
  readonly messageStore: MessageStore;
  readonly retryStore: RetryStore;
  readonly deadLetterStore: DeadLetterStore;
  readonly auditStore: AuditStore;
  readonly metricsStore: MetricsStore;

  constructor(basePath?: string) {
    const resolvedBasePath = basePath ?? join(process.cwd(), "data", "messaging");
    this.messageStore = new FileMessageStore(resolvedBasePath);
    this.retryStore = new FileRetryStore(resolvedBasePath);
    this.deadLetterStore = new FileDeadLetterStore(resolvedBasePath);
    this.auditStore = new FileAuditStore(resolvedBasePath);
    this.metricsStore = new FileMetricsStore(resolvedBasePath);
  }

  async loadRecoverySnapshot(): Promise<RecoverySnapshot> {
    const [pendingMessages, retryRecords, deadLetters, auditRecords, metrics] = await Promise.all([
      this.messageStore.listPending(),
      this.retryStore.list(),
      this.deadLetterStore.list(),
      this.auditStore.list(),
      this.metricsStore.load(),
    ]);

    return {
      pendingMessages,
      retryRecords,
      deadLetters,
      auditRecords,
      metrics,
    };
  }
}
