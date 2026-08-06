import type { MetricValue } from "../contracts";

export class MetricsService {
  private readonly values = new Map<string, MetricValue>();

  increment(name: string, by = 1): void {
    const current = this.values.get(name) ?? 0;
    this.values.set(name, current + by);
  }

  set(name: string, value: number): void {
    this.values.set(name, value);
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.values.entries());
  }
}
