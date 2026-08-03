import { randomUUID } from "node:crypto";
import type { NotificationAuditRecord } from "../contracts";
import type { NotificationPersistence } from "../persistence";

export class NotificationAuditWriter {
  constructor(private readonly persistence: NotificationPersistence) {}

  async write(record: Omit<NotificationAuditRecord, "recordId" | "recordedAt">): Promise<NotificationAuditRecord> {
    const created: NotificationAuditRecord = {
      ...record,
      recordId: `naudit_${randomUUID()}`,
      recordedAt: new Date().toISOString(),
    };

    await this.persistence.audits.append(created);
    return created;
  }

  async writeMany(records: Array<Omit<NotificationAuditRecord, "recordId" | "recordedAt">>): Promise<void> {
    const now = new Date().toISOString();
    await this.persistence.audits.appendMany(records.map((record) => ({
      ...record,
      recordId: `naudit_${randomUUID()}`,
      recordedAt: now,
    })));
  }

  async list(limit = 200): Promise<NotificationAuditRecord[]> {
    return this.persistence.audits.list(limit);
  }
}
