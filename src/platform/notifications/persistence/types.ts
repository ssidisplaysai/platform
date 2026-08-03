import type {
  DeadLetterRecord,
  DeliveryAttempt,
  NotificationAuditRecord,
  NotificationDefinition,
  NotificationMetrics,
  NotificationRequest,
  NotificationRequestId,
  NotificationState,
  SuppressionRule,
  TemplateDefinition,
} from "../contracts";

export type NotificationRequestRecord = {
  request: NotificationRequest;
  state: NotificationState;
  updatedAt: string;
  lastError?: string;
  deferredUntil?: string;
};

export type NotificationRecoveryDiagnostic = {
  scope:
    | "definitions"
    | "templates"
    | "suppression"
    | "requests"
    | "attempts"
    | "deadLetters"
    | "audits"
    | "metrics";
  severity: "WARN" | "ERROR";
  message: string;
};

export type NotificationRecoverySnapshot = {
  diagnostics: NotificationRecoveryDiagnostic[];
  recoveredAt: string;
};

export interface NotificationDefinitionStore {
  list(): Promise<NotificationDefinition[]>;
  upsert(definition: NotificationDefinition): Promise<void>;
  findById(notificationId: string): Promise<NotificationDefinition | null>;
}

export interface NotificationTemplateStore {
  list(): Promise<TemplateDefinition[]>;
  upsert(template: TemplateDefinition): Promise<void>;
  findById(templateId: string): Promise<TemplateDefinition | null>;
}

export interface NotificationSuppressionStore {
  list(): Promise<SuppressionRule[]>;
  upsert(rule: SuppressionRule): Promise<void>;
}

export interface NotificationRequestStore {
  list(): Promise<NotificationRequestRecord[]>;
  findByRequestId(requestId: NotificationRequestId): Promise<NotificationRequestRecord | null>;
  upsert(record: NotificationRequestRecord): Promise<void>;
  listPending(nowIso: string): Promise<NotificationRequestRecord[]>;
}

export interface NotificationAttemptStore {
  listByRequestId(requestId: NotificationRequestId): Promise<DeliveryAttempt[]>;
  append(attempt: DeliveryAttempt): Promise<void>;
  update(attempt: DeliveryAttempt): Promise<void>;
}

export interface NotificationDeadLetterStore {
  list(): Promise<DeadLetterRecord[]>;
  append(record: DeadLetterRecord): Promise<void>;
}

export interface NotificationAuditStore {
  list(limit?: number): Promise<NotificationAuditRecord[]>;
  append(record: NotificationAuditRecord): Promise<void>;
  appendMany(records: NotificationAuditRecord[]): Promise<void>;
}

export interface NotificationMetricsStore {
  load(): Promise<NotificationMetrics | null>;
  save(metrics: NotificationMetrics): Promise<void>;
}

export interface NotificationPersistence {
  definitions: NotificationDefinitionStore;
  templates: NotificationTemplateStore;
  suppression: NotificationSuppressionStore;
  requests: NotificationRequestStore;
  attempts: NotificationAttemptStore;
  deadLetters: NotificationDeadLetterStore;
  audits: NotificationAuditStore;
  metrics: NotificationMetricsStore;
  recover(): Promise<NotificationRecoverySnapshot>;
}
