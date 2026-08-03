import type { ScheduleHealth } from "../contracts";
import type { SchedulingMetricsService } from "./SchedulingMetricsService";

export class SchedulingHealthService {
  snapshot(input: {
    metrics: SchedulingMetricsService;
    dependencyHealth: {
      messaging: { status: string };
      persistence: { status: string };
      clock: { status: string };
      calculator: { status: string };
      claiming: { status: string };
      recovery: { status: string };
      configuration: { status: string };
    };
  }): ScheduleHealth {
    const checks: ScheduleHealth["checks"] = [
      { name: "registry", status: "PASS", detail: `registered=${input.metrics.snapshot().registeredSchedules}` },
      {
        name: "persistence",
        status: this.mapStatus(input.dependencyHealth.persistence.status),
        detail: `status=${input.dependencyHealth.persistence.status}`,
      },
      { name: "clock", status: this.mapStatus(input.dependencyHealth.clock.status), detail: `status=${input.dependencyHealth.clock.status}` },
      {
        name: "calculator",
        status: this.mapStatus(input.dependencyHealth.calculator.status),
        detail: `status=${input.dependencyHealth.calculator.status}`,
      },
      {
        name: "claiming",
        status: this.mapStatus(input.dependencyHealth.claiming.status),
        detail: `status=${input.dependencyHealth.claiming.status}`,
      },
      {
        name: "dispatch",
        status: this.mapStatus(input.dependencyHealth.messaging.status),
        detail: `status=${input.dependencyHealth.messaging.status}`,
      },
      {
        name: "recovery",
        status: this.mapStatus(input.dependencyHealth.recovery.status),
        detail: `status=${input.dependencyHealth.recovery.status}`,
      },
      {
        name: "configuration",
        status: this.mapStatus(input.dependencyHealth.configuration.status),
        detail: `status=${input.dependencyHealth.configuration.status}`,
      },
    ];

    return {
      status: checks.some((entry) => entry.status === "FAIL") ? "DEGRADED" : "HEALTHY",
      checks,
      generatedAt: new Date().toISOString(),
    };
  }

  private mapStatus(value: string): "PASS" | "WARN" | "FAIL" {
    if (value === "HEALTHY") {
      return "PASS";
    }

    if (value === "DEGRADED") {
      return "WARN";
    }

    return "FAIL";
  }
}
