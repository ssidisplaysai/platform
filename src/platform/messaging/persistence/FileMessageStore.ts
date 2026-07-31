import { join } from "node:path";
import { JsonFileStore } from "./JsonFileStore";
import type { MessageStore } from "./MessageStore";
import type { PendingMessageRecord } from "./types";

export class FileMessageStore implements MessageStore {
  private readonly store: JsonFileStore<PendingMessageRecord[]>;

  constructor(basePath: string) {
    this.store = new JsonFileStore(join(basePath, "pending-messages.json"), []);
  }

  async enqueue(record: PendingMessageRecord): Promise<void> {
    const items = await this.store.read();
    const filtered = items.filter((item) => item.envelope.messageId !== record.envelope.messageId);
    filtered.push(record);
    await this.store.write(filtered);
  }

  async remove(messageId: string): Promise<void> {
    const items = await this.store.read();
    await this.store.write(items.filter((item) => item.envelope.messageId !== messageId));
  }

  async listPending(): Promise<PendingMessageRecord[]> {
    return this.store.read();
  }

  async oldestPendingTimestamp(): Promise<string | null> {
    const items = await this.store.read();
    if (items.length === 0) {
      return null;
    }

    const sorted = [...items].sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
    return sorted[0].enqueuedAt;
  }
}
