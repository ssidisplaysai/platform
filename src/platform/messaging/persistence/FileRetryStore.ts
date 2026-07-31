import { join } from "node:path";
import { JsonFileStore } from "./JsonFileStore";
import type { RetryStore } from "./RetryStore";
import type { RetryRecord } from "./types";

export class FileRetryStore implements RetryStore {
  private readonly store: JsonFileStore<RetryRecord[]>;

  constructor(basePath: string) {
    this.store = new JsonFileStore(join(basePath, "retry-state.json"), []);
  }

  async append(record: RetryRecord): Promise<void> {
    const items = await this.store.read();
    items.push(record);
    await this.store.write(items);
  }

  async clearByMessage(messageId: string): Promise<void> {
    const items = await this.store.read();
    await this.store.write(items.filter((item) => item.messageId !== messageId));
  }

  async list(): Promise<RetryRecord[]> {
    return this.store.read();
  }

  async depth(): Promise<number> {
    const items = await this.store.read();
    return items.length;
  }
}
