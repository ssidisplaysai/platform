import type { WorkflowHealth } from "../contracts";
import type { WorkflowMetricsService } from "./WorkflowMetricsService";

export class WorkflowHealthService {
  snapshot(input: {
    metrics: WorkflowMetricsService;
    dependencyHealth: {
      messaging: { status: string };
      identity: { status: string };
    };
  }): WorkflowHealth {
    const metrics = input.metrics.snapshot();
    const hasFailures = metrics.failedInstances > 0 || metrics.timedOutInstances > 0;
    const dependencyHealthy =
      input.dependencyHealth.messaging.status === "HEALTHY" && input.dependencyHealth.identity.status === "HEALTHY";

    const status: "HEALTHY" | "DEGRADED" = !hasFailures && dependencyHealthy ? "HEALTHY" : "DEGRADED";

    return {
      status,
      checks: [
        {
          name: "workflow-execution",
          status: hasFailures ? "WARN" : "PASS",
          detail: `failed=${metrics.failedInstances}; timedOut=${metrics.timedOutInstances}`,
        },
        {
          name: "messaging-dependency",
          status: input.dependencyHealth.messaging.status === "HEALTHY" ? "PASS" : "WARN",
          detail: input.dependencyHealth.messaging.status,
        },
        {
          name: "identity-dependency",
          status: input.dependencyHealth.identity.status === "HEALTHY" ? "PASS" : "WARN",
          detail: input.dependencyHealth.identity.status,
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}
