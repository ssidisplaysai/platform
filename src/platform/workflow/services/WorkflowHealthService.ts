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
    const hasOperationalWarnings =
      metrics.concurrencyConflictCount > 0 ||
      metrics.lifecyclePublishFailureCount > 0 ||
      metrics.auditPersistenceFailureCount > 0 ||
      metrics.contextPersistenceFailureCount > 0;
    const dependencyHealthy =
      input.dependencyHealth.messaging.status === "HEALTHY" && input.dependencyHealth.identity.status === "HEALTHY";

    const status: "HEALTHY" | "DEGRADED" = !hasFailures && !hasOperationalWarnings && dependencyHealthy
      ? "HEALTHY"
      : "DEGRADED";

    return {
      status,
      checks: [
        {
          name: "workflow-execution",
          status: hasFailures ? "WARN" : "PASS",
          detail: `active=${metrics.activeWorkflowInstances}; failed=${metrics.failedInstances}; timedOut=${metrics.timedOutInstances}`,
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
        {
          name: "orchestration-safety",
          status: hasOperationalWarnings ? "WARN" : "PASS",
          detail: `conflicts=${metrics.concurrencyConflictCount}; duplicateCommands=${metrics.duplicateCommandCount}; publishFailures=${metrics.lifecyclePublishFailureCount}`,
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}
