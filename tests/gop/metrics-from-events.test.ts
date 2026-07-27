import { describe, expect, it } from "@jest/globals";
import { metricsFromDerived, reduceEventsToMetrics } from "@/platform/gop/metrics-from-events";

describe("gop metrics from events", () => {
  it("reduces event stream into operational metrics", () => {
    const derived = reduceEventsToMetrics([
      { eventType: "JOB_CREATED", status: "QUEUED", jobId: "1", durationMs: null },
      { eventType: "STARTED", status: "RUNNING", jobId: "1", durationMs: null },
      { eventType: "SUCCEEDED", status: "COMPLETE", jobId: "1", durationMs: 12000 },
      { eventType: "JOB_CREATED", status: "QUEUED", jobId: "2", durationMs: null },
      { eventType: "FAILED", status: "FAILED", jobId: "2", durationMs: null },
    ]);

    expect(derived.jobsCreated).toBe(2);
    expect(derived.jobsCompleted).toBe(1);
    expect(derived.jobsFailed).toBe(1);
    expect(derived.averageRuntimeMs).toBe(12000);
    expect(derived.successRate).toBe(0.5);
    expect(derived.failureRate).toBe(0.5);
  });

  it("formats derived metrics into contract payload", () => {
    const metrics = metricsFromDerived({
      jobsCreated: 2,
      jobsStarted: 2,
      jobsCompleted: 1,
      jobsFailed: 1,
      jobsTimedOut: 0,
      jobsCancelled: 0,
      averageRuntimeMs: 12000,
      successRate: 0.5,
      failureRate: 0.5,
      activeJobs: 0,
      queueDepth: 0,
    });

    expect(metrics.some((metric) => metric.metricId === "success_rate")).toBe(true);
    expect(metrics.some((metric) => metric.metricId === "queue_depth")).toBe(true);
  });
});
