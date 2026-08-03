import type { ScheduleMetrics } from "../contracts";

export interface ScheduleMetricsStore {
  save(metrics: ScheduleMetrics): Promise<void>;
  load(): Promise<ScheduleMetrics | null>;
}
