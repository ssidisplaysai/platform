import { join } from "node:path";
import { JsonFileStore } from "./JsonFileStore";
import type { MetricsStore } from "./MetricsStore";
import type { MessageMetricsSnapshot } from "../services/MessageMetrics";

export class FileMetricsStore implements MetricsStore {
  private readonly store: JsonFileStore<MessageMetricsSnapshot | null>;

  constructor(basePath: string) {
    this.store = new JsonFileStore(join(basePath, "metrics.json"), null);
  }

  async save(snapshot: MessageMetricsSnapshot): Promise<void> {
    await this.store.write(snapshot);
  }

  async load(): Promise<MessageMetricsSnapshot | null> {
    return this.store.read();
  }
}
