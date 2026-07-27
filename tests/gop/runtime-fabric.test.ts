import { describe, expect, it } from "@jest/globals";
import { createGenesisOrchestrationRuntime, createGenesisQueueManager } from "@/platform/gop";

function seedJobs(runtime: ReturnType<typeof createGenesisOrchestrationRuntime>, count: number): void {
  for (let index = 0; index < count; index += 1) {
    runtime.createGlwExecutionForJob({
      jobId: `job_fabric_${index}`,
      jobType: "PAGE_GENERATION",
      title: `Fabric Job ${index}`,
      siteId: "led-display-warehouse",
    });
  }
}

function registerWorkers(runtime: ReturnType<typeof createGenesisOrchestrationRuntime>, count: number): void {
  for (let index = 0; index < count; index += 1) {
    runtime.workers.register({
      workerId: `worker.fabric.${index}`,
      name: `Fabric Worker ${index}`,
      workerType: "ai",
      capabilities: ["content.generate", "seo.optimize"],
      maxCapacity: 1,
      protocolVersion: "gop-worker/v1",
      tokenId: `token_${index}`,
      authMode: "SIGNED_TOKEN",
    });
  }
}

describe("gop runtime fabric", () => {
  it.each([5, 10, 50, 100])("dispatches deterministically with %i workers and no duplicate execution", (workerCount) => {
    const runtime = createGenesisOrchestrationRuntime({ bootstrapDefaultWorkers: false });
    const executionCount = workerCount * 2;

    seedJobs(runtime, executionCount);
    registerWorkers(runtime, workerCount);

    const dispatches = runtime.dispatchPending(executionCount);
    const executionIds = dispatches.map((entry) => entry.execution.executionId);
    const uniqueExecutionIds = new Set(executionIds);

    expect(dispatches.length).toBe(workerCount);
    expect(uniqueExecutionIds.size).toBe(dispatches.length);

    const activeLeases = runtime.listExecutionLeases().filter((lease) => lease.leaseState === "ACTIVE");
    const activeExecutionIds = new Set(activeLeases.map((lease) => lease.executionId));
    expect(activeExecutionIds.size).toBe(activeLeases.length);
  });

  it("reassigns work after lease expiration and worker crash", () => {
    const queue = createGenesisQueueManager();

    const item = queue.enqueue({
      executionId: "gexec_expire_1",
      workspaceId: "glw-led-display-warehouse",
      moduleId: "glw.core",
      workerType: "ai",
      executionClass: "AUTOMATED",
      priority: "HIGH",
      requiredCapabilities: ["content.generate"],
      maxAttempts: 3,
    });

    const acquired = queue.acquireLease({
      workerId: "worker_a",
      workerType: "ai",
      workerCapabilities: ["content.generate"],
      workerCurrentLoad: 0,
      workerMaxCapacity: 1,
      now: Date.now(),
      leaseTtlMs: 1000,
      heartbeatWindowMs: 500,
    });

    expect(acquired?.item.executionId).toBe(item.executionId);

    const expired = queue.expireLeases(Date.now() + 2500);
    expect(expired.length).toBe(1);
    expect(expired[0].leaseState).toBe("EXPIRED");

    const reassigned = queue.acquireLease({
      workerId: "worker_b",
      workerType: "ai",
      workerCapabilities: ["content.generate"],
      workerCurrentLoad: 0,
      workerMaxCapacity: 1,
      now: Date.now() + 2600,
    });

    expect(reassigned?.item.executionId).toBe("gexec_expire_1");
  });

  it("moves exhausted executions to dead-letter and supports manual retry", () => {
    const queue = createGenesisQueueManager();

    queue.enqueue({
      executionId: "gexec_dlq_1",
      workspaceId: "glw-led-display-warehouse",
      moduleId: "glw.core",
      workerType: "ai",
      executionClass: "AUTOMATED",
      priority: "NORMAL",
      maxAttempts: 1,
    });

    const lease = queue.acquireLease({
      workerId: "worker_dlq",
      workerType: "ai",
      workerCapabilities: [],
      workerCurrentLoad: 0,
      workerMaxCapacity: 1,
    });

    expect(lease).not.toBeNull();

    queue.releaseLease({
      leaseId: lease!.lease.leaseId,
      workerId: "worker_dlq",
      outcome: "RETRY",
      reason: "Transient failure repeated",
    });

    const deadLetters = queue.listDeadLetters();
    expect(deadLetters.length).toBe(1);
    expect(deadLetters[0].item.executionId).toBe("gexec_dlq_1");

    const retried = queue.retryDeadLetter("gexec_dlq_1");
    expect(retried?.executionId).toBe("gexec_dlq_1");
    expect(queue.listDeadLetters().length).toBe(0);
  });

  it("records fabric metrics for queue and lease utilization", async () => {
    const runtime = createGenesisOrchestrationRuntime({ bootstrapDefaultWorkers: false });
    seedJobs(runtime, 3);

    runtime.workers.register({
      workerId: "worker.metrics.1",
      name: "Metrics Worker",
      workerType: "ai",
      capabilities: ["content.generate"],
      maxCapacity: 2,
      protocolVersion: "gop-worker/v1",
      tokenId: "metrics_token",
      authMode: "SIGNED_TOKEN",
    });

    runtime.dispatchPending(2);

    const snapshot = await runtime.buildOperationsSnapshot("glw-led-display-warehouse");
    expect(snapshot.fabricMetrics).toBeDefined();
    expect(snapshot.queue.leasedDepth).toBeGreaterThanOrEqual(1);
    expect(snapshot.fabricMetrics?.workerUtilization.length).toBeGreaterThan(0);
  });
});
