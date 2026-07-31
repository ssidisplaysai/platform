import type { WorkflowMetrics } from "../contracts";

export class WorkflowMetricsService {
  private readonly metrics: WorkflowMetrics = {
    registeredWorkflows: 0,
    createdInstances: 0,
    runningInstances: 0,
    pausedInstances: 0,
    completedInstances: 0,
    failedInstances: 0,
    cancelledInstances: 0,
    timedOutInstances: 0,
    retriedSteps: 0,
    compensatedInstances: 0,
    auditRecords: 0,
  };

  trackRegisteredWorkflow(): void {
    this.metrics.registeredWorkflows += 1;
  }

  trackCreatedInstance(): void {
    this.metrics.createdInstances += 1;
  }

  trackRunningInstance(): void {
    this.metrics.runningInstances += 1;
  }

  trackPausedInstance(): void {
    this.metrics.pausedInstances += 1;
  }

  trackCompletedInstance(): void {
    this.metrics.completedInstances += 1;
  }

  trackFailedInstance(): void {
    this.metrics.failedInstances += 1;
  }

  trackCancelledInstance(): void {
    this.metrics.cancelledInstances += 1;
  }

  trackTimedOutInstance(): void {
    this.metrics.timedOutInstances += 1;
  }

  trackRetriedStep(): void {
    this.metrics.retriedSteps += 1;
  }

  trackCompensatedInstance(): void {
    this.metrics.compensatedInstances += 1;
  }

  trackAuditRecord(): void {
    this.metrics.auditRecords += 1;
  }

  snapshot(): WorkflowMetrics {
    return { ...this.metrics };
  }
}
