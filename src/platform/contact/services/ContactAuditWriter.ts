import { randomUUID } from "node:crypto";
import type { ContactAuditRecord, ContactId, ContactActorContext, TenantId } from "../contracts";
import { ContactError } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";

export class ContactAuditWriter {
  private records: ContactAuditRecord[] = [];

  constructor(private readonly persistence: PersistenceCoordinator) {}

  replace(records: ContactAuditRecord[]): void {
    this.records = records.map((item) => structuredClone(item));
  }

  list(limit = 500): ContactAuditRecord[] {
    return this.records.slice(-limit).map((item) => structuredClone(item));
  }

  async append(input: {
    eventType: string;
    contactId?: ContactId;
    tenantId?: TenantId;
    actor?: ContactActorContext;
    message: string;
    details?: Record<string, unknown>;
  }): Promise<ContactAuditRecord> {
    const record: ContactAuditRecord = {
      auditId: `contact_audit_${randomUUID()}`,
      eventType: input.eventType,
      contactId: input.contactId,
      tenantId: input.tenantId,
      actor: input.actor,
      message: input.message,
      details: input.details,
      recordedAt: new Date().toISOString(),
    };

    try {
      this.records.push(record);
      await this.persistence.appendAudit(record);
      return structuredClone(record);
    } catch {
      throw new ContactError("AUDIT_FAILURE", "contact audit persistence failure", true, true, "HIGH");
    }
  }
}
