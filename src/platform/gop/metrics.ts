import type { GenesisMetric } from "./contracts";

export type GenesisMetricSample = GenesisMetric & {
  category?: string;
};

export function summarizeGenesisMetrics(samples: GenesisMetricSample[]): GenesisMetric[] {
  const byId = new Map<string, GenesisMetric>();

  for (const sample of samples) {
    byId.set(sample.metricId, {
      metricId: sample.metricId,
      label: sample.label,
      value: sample.value,
      detail: sample.detail,
      trend: sample.trend,
      updatedAt: sample.updatedAt ?? new Date().toISOString(),
      metadata: {
        ...sample.metadata,
        category: sample.category,
      },
    });
  }

  return [...byId.values()];
}
