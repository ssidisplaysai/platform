import { join } from "node:path";
import { JsonFileStore } from "./JsonFileStore";
import type { AuditStore } from "./AuditStore";
import type { MessageAuditRecord } from "../services/AuditWriter";

export class FileAuditStore implements AuditStore {
  private readonly store: JsonFileStore<MessageAuditRecord[]>;

  constructor(basePath: string) {
    this.store = new JsonFileStore(join(basePath, "audit-records.json"), []);
  }

  async saveAll(records: MessageAuditRecord[]): Promise<void> {
    await this.store.write(records.map((record) => ({ ...record })));
  }

  async list(): Promise<MessageAuditRecord[]> {
    return this.store.read();
  }
}
