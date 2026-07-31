import { join } from "node:path";
import { JsonFileStore } from "./JsonFileStore";
import type { DeadLetterStore } from "./DeadLetterStore";
import type { DeadLetterEntry } from "../services/DeadLetterService";

export class FileDeadLetterStore implements DeadLetterStore {
  private readonly store: JsonFileStore<DeadLetterEntry[]>;

  constructor(basePath: string) {
    this.store = new JsonFileStore(join(basePath, "dead-letters.json"), []);
  }

  async append(entry: DeadLetterEntry): Promise<void> {
    const items = await this.store.read();
    items.push(entry);
    await this.store.write(items);
  }

  async list(): Promise<DeadLetterEntry[]> {
    return this.store.read();
  }

  async depth(): Promise<number> {
    const items = await this.store.read();
    return items.length;
  }
}
