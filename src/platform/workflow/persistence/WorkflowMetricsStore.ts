import type { WorkflowMetrics } from "../contracts";

export interface WorkflowMetricsStore {
  save(metrics: WorkflowMetrics): Promise<void>;
  load(): Promise<WorkflowMetrics | null>;
}
