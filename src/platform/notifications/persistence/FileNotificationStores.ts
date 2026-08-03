import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  DeadLetterRecord,
  DeliveryAttempt,
  NotificationAuditRecord,
  NotificationDefinition,
  NotificationMetrics,
  SuppressionRule,
  TemplateDefinition,
} from "../contracts";
import type {
  NotificationPersistence,
  NotificationRecoveryDiagnostic,
  NotificationRecoverySnapshot,
  NotificationRequestRecord,
} from "./types";

type StoresConfig = {
  rootDir: string;
};

type PersistedState = {
  definitions: NotificationDefinition[];
  templates: TemplateDefinition[];
  suppression: SuppressionRule[];
  requests: NotificationRequestRecord[];
  attempts: DeliveryAttempt[];
  deadLetters: DeadLetterRecord[];
  audits: NotificationAuditRecord[];
  metrics: NotificationMetrics;
};

function createDefaultMetrics(): NotificationMetrics {
  return {
    registeredNotificationDefinitions: 0,
    registeredTemplates: 0,
    requestedNotifications: 0,
    suppressedNotifications: 0,
    deferredNotifications: 0,
    queuedNotifications: 0,
    deliveredNotifications: 0,
    failedNotifications: 0,
    deadLetteredNotifications: 0,
    deliveryAttempts: 0,
    retryCount: 0,
    duplicateRequestCount: 0,
    preferenceRejections: 0,
    quietHourDeferrals: 0,
    providerFailures: 0,
    auditFailures: 0,
    auditRetries: 0,
    auditRecoveries: 0,
    auditBacklog: 0,
    auditLatencyMs: 0,
    recoveryCount: 0,
    activeQueuedNotifications: 0,
    activeDeferredNotifications: 0,
    oldestPendingNotificationAgeMs: null,
    averageDeliveryLatencyMs: 0,
    deliverySuccessRateByChannel: {},
  };
}

function defaultState(): PersistedState {
  return {
    definitions: [],
    templates: [],
    suppression: [],
    requests: [],
    attempts: [],
    deadLetters: [],
    audits: [],
    metrics: createDefaultMetrics(),
  };
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

function asArray<T>(input: unknown): T[] | null {
  return Array.isArray(input) ? (input as T[]) : null;
}

function sanitizeState(raw: unknown): { state: PersistedState; diagnostics: NotificationRecoveryDiagnostic[] } {
  const diagnostics: NotificationRecoveryDiagnostic[] = [];

  if (typeof raw !== "object" || raw === null) {
    diagnostics.push({
      scope: "metrics",
      severity: "ERROR",
      message: "notification persistence payload was not an object; recovered defaults",
    });
    return { state: defaultState(), diagnostics };
  }

  const obj = raw as Record<string, unknown>;
  const state = defaultState();

  const mapArray = <T>(key: keyof PersistedState, scope: NotificationRecoveryDiagnostic["scope"]): T[] => {
    const candidate = asArray<T>(obj[key]);
    if (candidate === null) {
      diagnostics.push({
        scope,
        severity: "WARN",
        message: `invalid ${scope} section; recovered empty array`,
      });
      return [];
    }
    return candidate;
  };

  state.definitions = mapArray<NotificationDefinition>("definitions", "definitions");
  state.templates = mapArray<TemplateDefinition>("templates", "templates");
  state.suppression = mapArray<SuppressionRule>("suppression", "suppression");
  state.requests = mapArray<NotificationRequestRecord>("requests", "requests");
  state.attempts = mapArray<DeliveryAttempt>("attempts", "attempts");
  state.deadLetters = mapArray<DeadLetterRecord>("deadLetters", "deadLetters");
  state.audits = mapArray<NotificationAuditRecord>("audits", "audits");

  if (typeof obj.metrics === "object" && obj.metrics !== null) {
    state.metrics = {
      ...createDefaultMetrics(),
      ...(obj.metrics as Partial<NotificationMetrics>),
    };
  } else {
    diagnostics.push({
      scope: "metrics",
      severity: "WARN",
      message: "invalid metrics section; recovered default metrics",
    });
  }

  return { state, diagnostics };
}

class FileNotificationPersistence implements NotificationPersistence {
  private readonly filePath: string;
  private queue: Promise<void> = Promise.resolve();
  private state: PersistedState = defaultState();
  private loaded = false;
  private diagnostics: NotificationRecoveryDiagnostic[] = [];

  constructor(config: StoresConfig) {
    this.filePath = resolve(config.rootDir, "notifications", "notifications-state.json");
  }

  private async load(): Promise<void> {
    if (this.loaded) {
      return;
    }

    try {
      const payload = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(payload) as unknown;
      const sanitized = sanitizeState(parsed);
      this.state = sanitized.state;
      this.diagnostics = sanitized.diagnostics;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOENT") {
        this.state = defaultState();
        this.diagnostics = [];
        await this.flush();
      } else {
        this.state = defaultState();
        this.diagnostics = [
          {
            scope: "metrics",
            severity: "ERROR",
            message: `failed to parse notification persistence state: ${error instanceof Error ? error.message : "unknown"}`,
          },
        ];
      }
    }

    this.loaded = true;
  }

  private async flush(): Promise<void> {
    await ensureDir(this.filePath);
    await writeFile(this.filePath, JSON.stringify(this.state, null, 2), "utf8");
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      await this.load();
    });

    let release: () => void = () => undefined;
    const blocker = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });

    this.queue = next.then(() => blocker);
    await next;

    try {
      const value = await operation();
      await this.flush();
      return value;
    } finally {
      release();
    }
  }

  readonly definitions = {
    list: async () => this.withLock(async () => this.state.definitions.map((item) => structuredClone(item))),
    upsert: async (definition: NotificationDefinition) => this.withLock(async () => {
      const idx = this.state.definitions.findIndex((item) => item.notificationId === definition.notificationId);
      if (idx === -1) {
        this.state.definitions.push(structuredClone(definition));
      } else {
        this.state.definitions[idx] = structuredClone(definition);
      }
    }),
    findById: async (notificationId: string) => this.withLock(async () => {
      const found = this.state.definitions.find((item) => item.notificationId === notificationId);
      return found ? structuredClone(found) : null;
    }),
  };

  readonly templates = {
    list: async () => this.withLock(async () => this.state.templates.map((item) => structuredClone(item))),
    upsert: async (template: TemplateDefinition) => this.withLock(async () => {
      const idx = this.state.templates.findIndex((item) => item.templateId === template.templateId);
      if (idx === -1) {
        this.state.templates.push(structuredClone(template));
      } else {
        this.state.templates[idx] = structuredClone(template);
      }
    }),
    findById: async (templateId: string) => this.withLock(async () => {
      const found = this.state.templates.find((item) => item.templateId === templateId);
      return found ? structuredClone(found) : null;
    }),
  };

  readonly suppression = {
    list: async () => this.withLock(async () => this.state.suppression.map((item) => structuredClone(item))),
    upsert: async (rule: SuppressionRule) => this.withLock(async () => {
      const idx = this.state.suppression.findIndex((item) => item.suppressionId === rule.suppressionId);
      if (idx === -1) {
        this.state.suppression.push(structuredClone(rule));
      } else {
        this.state.suppression[idx] = structuredClone(rule);
      }
    }),
  };

  readonly requests = {
    list: async () => this.withLock(async () => this.state.requests.map((item) => structuredClone(item))),
    findByRequestId: async (requestId: string) => this.withLock(async () => {
      const found = this.state.requests.find((item) => item.request.requestId === requestId);
      return found ? structuredClone(found) : null;
    }),
    upsert: async (record: NotificationRequestRecord) => this.withLock(async () => {
      const idx = this.state.requests.findIndex((item) => item.request.requestId === record.request.requestId);
      if (idx === -1) {
        this.state.requests.push(structuredClone(record));
      } else {
        this.state.requests[idx] = structuredClone(record);
      }
    }),
    listPending: async (nowIso: string) => this.withLock(async () => this.state.requests
      .filter((item) => {
        if (item.state !== "QUEUED" && item.state !== "DEFERRED") {
          return false;
        }

        if (!item.deferredUntil) {
          return true;
        }

        return item.deferredUntil <= nowIso;
      })
      .map((item) => structuredClone(item))),
  };

  readonly attempts = {
    listByRequestId: async (requestId: string) => this.withLock(async () => this.state.attempts
      .filter((item) => item.requestId === requestId)
      .map((item) => structuredClone(item))),
    append: async (attempt: DeliveryAttempt) => this.withLock(async () => {
      this.state.attempts.push(structuredClone(attempt));
    }),
    update: async (attempt: DeliveryAttempt) => this.withLock(async () => {
      const index = this.state.attempts.findIndex((item) => item.attemptId === attempt.attemptId);
      if (index >= 0) {
        this.state.attempts[index] = structuredClone(attempt);
      }
    }),
  };

  readonly deadLetters = {
    list: async () => this.withLock(async () => this.state.deadLetters.map((item) => structuredClone(item))),
    append: async (record: DeadLetterRecord) => this.withLock(async () => {
      this.state.deadLetters.push(structuredClone(record));
    }),
  };

  readonly audits = {
    list: async (limit = 200) => this.withLock(async () => this.state.audits.slice(-limit).map((item) => structuredClone(item))),
    append: async (record: NotificationAuditRecord) => this.withLock(async () => {
      this.state.audits.push(structuredClone(record));
    }),
    appendMany: async (records: NotificationAuditRecord[]) => this.withLock(async () => {
      this.state.audits.push(...records.map((record) => structuredClone(record)));
    }),
  };

  readonly metrics = {
    load: async () => this.withLock(async () => structuredClone(this.state.metrics)),
    save: async (metrics: NotificationMetrics) => this.withLock(async () => {
      this.state.metrics = structuredClone(metrics);
    }),
  };

  async recover(): Promise<NotificationRecoverySnapshot> {
    await this.load();

    if (this.diagnostics.length === 0) {
      return {
        diagnostics: [],
        recoveredAt: new Date().toISOString(),
      };
    }

    return {
      diagnostics: structuredClone(this.diagnostics),
      recoveredAt: new Date().toISOString(),
    };
  }
}

export function createFileNotificationPersistence(config: StoresConfig): NotificationPersistence {
  return new FileNotificationPersistence(config);
}
