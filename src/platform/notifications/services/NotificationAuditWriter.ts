import { randomUUID } from "node:crypto";
import type { NotificationAuditFailureRecord, NotificationAuditRecord, NotificationAuditWriterError } from "../contracts";
import type { NotificationPersistence } from "../persistence";

function createAuditWriterError(stage: string, message: string, retryable: boolean, severity: "WARN" | "ERROR"): NotificationAuditWriterError {
  const error = new Error(message) as NotificationAuditWriterError;
  error.name = "NotificationAuditWriterError";
  error.retryable = retryable;
  error.severity = severity;
  error.stage = stage;
  return error;
}

export class NotificationAuditWriter {
  private readonly failureEvents: NotificationAuditFailureRecord[] = [];

  constructor(private readonly persistence: NotificationPersistence) {}

  async write(record: Omit<NotificationAuditRecord, "recordId" | "recordedAt">): Promise<NotificationAuditRecord> {
    const created: NotificationAuditRecord = {
      ...record,
      recordId: `naudit_${randomUUID()}`,
      recordedAt: new Date().toISOString(),
    };

    try {
      await this.persistence.audits.append(created);
      return created;
    } catch (error) {
      const retryable = this.isRetryable(error);
      this.publishFailure({
        stage: record.eventType,
        retryable,
        severity: retryable ? "WARN" : "ERROR",
        message: error instanceof Error ? error.message : "audit append failed",
        record: created,
      });
      throw createAuditWriterError(record.eventType, error instanceof Error ? error.message : "audit append failed", retryable, retryable ? "WARN" : "ERROR");
    }
  }

  async writeMany(records: Array<Omit<NotificationAuditRecord, "recordId" | "recordedAt">>): Promise<void> {
    const now = new Date().toISOString();
    const created = records.map((record) => ({
      ...record,
      recordId: `naudit_${randomUUID()}`,
      recordedAt: now,
    }));

    try {
      await this.persistence.audits.appendMany(created);
    } catch (error) {
      const retryable = this.isRetryable(error);
      this.publishFailure({
        stage: "BATCH",
        retryable,
        severity: retryable ? "WARN" : "ERROR",
        message: error instanceof Error ? error.message : "audit appendMany failed",
        record: created[0],
      });
      throw createAuditWriterError("BATCH", error instanceof Error ? error.message : "audit appendMany failed", retryable, retryable ? "WARN" : "ERROR");
    }
  }

  async list(limit = 200): Promise<NotificationAuditRecord[]> {
    return this.persistence.audits.list(limit);
  }

  listFailures(limit = 200): NotificationAuditFailureRecord[] {
    return this.failureEvents.slice(-limit).map((event) => ({ ...event }));
  }

  private publishFailure(failure: Omit<NotificationAuditFailureRecord, "failureId" | "occurredAt">): void {
    this.failureEvents.push({
      ...failure,
      failureId: `nafailure_${randomUUID()}`,
      occurredAt: new Date().toISOString(),
    });
  }

  private isRetryable(error: unknown): boolean {
    if (typeof error === "object" && error !== null && "retryable" in error && typeof (error as { retryable?: unknown }).retryable === "boolean") {
      return (error as { retryable: boolean }).retryable;
    }

    const message = error instanceof Error ? error.message.toLowerCase() : "";
    return message.includes("timeout") || message.includes("temporar") || message.includes("unavailable") || message.includes("enoent");
  }
}
