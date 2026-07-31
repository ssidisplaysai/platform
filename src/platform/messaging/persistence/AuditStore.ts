import type { MessageAuditRecord } from "../services/AuditWriter";

export interface AuditStore {
  saveAll(records: MessageAuditRecord[]): Promise<void>;
  list(): Promise<MessageAuditRecord[]>;
}
