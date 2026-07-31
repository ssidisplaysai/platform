import type { MessageMetricsSnapshot } from "../services/MessageMetrics";

export interface MetricsStore {
  save(snapshot: MessageMetricsSnapshot): Promise<void>;
  load(): Promise<MessageMetricsSnapshot | null>;
}
