import type { RuntimeHostMetrics } from "./types";

export class HostTelemetry {
  private readonly counters = new Map<string, number>();

  increment(counter: string, amount = 1): void {
    this.counters.set(counter, (this.counters.get(counter) ?? 0) + amount);
  }

  snapshot(metrics: RuntimeHostMetrics): { counters: Readonly<Record<string, number>>; metrics: RuntimeHostMetrics } {
    return Object.freeze({
      counters: Object.freeze(Object.fromEntries([...this.counters.entries()].sort((a, b) => a[0].localeCompare(b[0])))),
      metrics,
    });
  }
}
