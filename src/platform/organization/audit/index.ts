import { randomUUID } from "node:crypto";
import type { OrganizationAuditRecord } from "../contracts";

export class OrganizationAuditWriter {
  private readonly records: OrganizationAuditRecord[] = [];

  append(record: Omit<OrganizationAuditRecord, "recordId" | "recordedAt">): OrganizationAuditRecord {
    const created: OrganizationAuditRecord = {
      ...record,
      recordId: `orgaudit_${randomUUID()}`,
      recordedAt: new Date().toISOString(),
    };
    this.records.push(created);
    return structuredClone(created);
  }

  list(limit = 200): OrganizationAuditRecord[] {
    return this.records.slice(-limit).map((record) => structuredClone(record));
  }

  replace(records: OrganizationAuditRecord[]): void {
    this.records.length = 0;
    this.records.push(...records.map((record) => structuredClone(record)));
  }
}
