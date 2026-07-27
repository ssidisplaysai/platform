import type { GenesisMetric } from "./contracts";
import type { GenesisEventStore } from "./event-store";

export type GenesisEventDerivedMetrics = {
  jobsCreated: number;
  jobsStarted: number;
  jobsCompleted: number;
  jobsFailed: number;
  jobsTimedOut: number;
  jobsCancelled: number;
  averageRuntimeMs: number;
  successRate: number;
  failureRate: number;
  activeJobs: number;
  queueDepth: number;
};

export function reduceEventsToMetrics(events: Array<{ eventType: string; status: string | null; jobId: string; durationMs: number | null }>): GenesisEventDerivedMetrics {
  const seenCreated = new Set<string>();
  const seenStarted = new Set<string>();
  const seenCompleted = new Set<string>();
  const seenFailed = new Set<string>();
  const seenTimedOut = new Set<string>();
  const seenCancelled = new Set<string>();
  const latestByJob = new Map<string, string | null>();
  const durations: number[] = [];

  for (const event of events) {
    const type = event.eventType.toUpperCase();
    latestByJob.set(event.jobId, event.status);

    if (type === "JOB_CREATED" || type === "QUEUED") {
      seenCreated.add(event.jobId);
    }

    if (type === "STARTED") {
      seenStarted.add(event.jobId);
    }

    if (type === "SUCCEEDED" || event.status === "COMPLETE") {
      seenCompleted.add(event.jobId);
      if (typeof event.durationMs === "number" && event.durationMs > 0) {
        durations.push(event.durationMs);
      }
    }

    if (type === "FAILED" || event.status === "FAILED") {
      seenFailed.add(event.jobId);
    }

    if (type === "TIMED_OUT" || event.status === "TIMED_OUT") {
      seenTimedOut.add(event.jobId);
    }

    if (type === "CANCELLED" || event.status === "CANCELLED") {
      seenCancelled.add(event.jobId);
    }
  }

  const totalCompleted = seenCompleted.size;
  const totalFailed = seenFailed.size + seenTimedOut.size + seenCancelled.size;
  const totalTerminal = totalCompleted + totalFailed;
  const successRate = totalTerminal > 0 ? Number((totalCompleted / totalTerminal).toFixed(4)) : 0;
  const failureRate = totalTerminal > 0 ? Number((totalFailed / totalTerminal).toFixed(4)) : 0;
  const averageRuntimeMs = durations.length > 0
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : 0;

  let activeJobs = 0;
  let queueDepth = 0;

  for (const status of latestByJob.values()) {
    if (status === "QUEUED" || status === "STARTING") {
      queueDepth += 1;
      activeJobs += 1;
      continue;
    }

    if (status && !(status === "COMPLETE" || status === "FAILED" || status === "TIMED_OUT" || status === "CANCELLED" || status === "ARCHIVED")) {
      activeJobs += 1;
    }
  }

  return {
    jobsCreated: seenCreated.size,
    jobsStarted: seenStarted.size,
    jobsCompleted: seenCompleted.size,
    jobsFailed: seenFailed.size,
    jobsTimedOut: seenTimedOut.size,
    jobsCancelled: seenCancelled.size,
    averageRuntimeMs,
    successRate,
    failureRate,
    activeJobs,
    queueDepth,
  };
}

export function metricsFromDerived(derived: GenesisEventDerivedMetrics): GenesisMetric[] {
  return [
    { metricId: "jobs_created", label: "Jobs Created", value: String(derived.jobsCreated) },
    { metricId: "jobs_started", label: "Jobs Started", value: String(derived.jobsStarted) },
    { metricId: "jobs_completed", label: "Jobs Completed", value: String(derived.jobsCompleted) },
    { metricId: "jobs_failed", label: "Jobs Failed", value: String(derived.jobsFailed) },
    { metricId: "jobs_timed_out", label: "Jobs Timed Out", value: String(derived.jobsTimedOut) },
    { metricId: "jobs_cancelled", label: "Jobs Cancelled", value: String(derived.jobsCancelled) },
    { metricId: "average_runtime_ms", label: "Average Runtime", value: String(derived.averageRuntimeMs) },
    { metricId: "success_rate", label: "Success Rate", value: String(derived.successRate) },
    { metricId: "failure_rate", label: "Failure Rate", value: String(derived.failureRate) },
    { metricId: "active_jobs", label: "Active Jobs", value: String(derived.activeJobs) },
    { metricId: "queue_depth", label: "Queue Depth", value: String(derived.queueDepth) },
  ];
}

export async function computeMetricsForJob(store: GenesisEventStore, jobId: string): Promise<GenesisMetric[]> {
  const events = await store.listEventsForJob(jobId);
  const derived = reduceEventsToMetrics(events.map((event) => ({
    eventType: event.eventType,
    status: event.status,
    jobId: event.jobId,
    durationMs: event.durationMs,
  })));

  return metricsFromDerived(derived);
}
