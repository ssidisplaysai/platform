export class RuntimeScheduler {
  private readonly jobs = new Set<string>();

  registerStartupJob(jobId: string): void {
    this.jobs.add(`startup:${jobId}`);
  }

  registerBackgroundJob(jobId: string): void {
    this.jobs.add(`background:${jobId}`);
  }

  registerTimer(jobId: string): void {
    this.jobs.add(`timer:${jobId}`);
  }

  registerWorkflowExecution(workflowId: string): void {
    this.jobs.add(`workflow:${workflowId}`);
  }

  registerMaintenance(jobId: string): void {
    this.jobs.add(`maintenance:${jobId}`);
  }

  registerHealthPolling(jobId: string): void {
    this.jobs.add(`health:${jobId}`);
  }

  list(): readonly string[] {
    return Object.freeze([...this.jobs].sort((a, b) => a.localeCompare(b)));
  }
}
