import { describe, expect, it } from "@jest/globals";
import {
  createGenesisExecution,
  createGenesisOrchestrationRuntime,
  createInMemoryExecutionRepository,
  transitionExecutionStatus,
} from "@/platform/gop";
import type { GenesisExecutionRepository } from "@/platform/gop/runtime/execution-repository";

function createThrowingRepository(): GenesisExecutionRepository {
  const error = new Error("database unavailable");
  return {
    saveExecution: async () => { throw error; },
    loadExecution: async () => { throw error; },
    loadExecutionByJobId: async () => { throw error; },
    updateExecution: async () => { throw error; },
    storeSnapshot: async () => { throw error; },
    loadLatestSnapshot: async () => { throw error; },
    loadSnapshots: async () => { throw error; },
    compactSnapshots: async () => { throw error; },
    replayExecution: async () => { throw error; },
    listExecutionHistory: async () => { throw error; },
    listExecutions: async () => { throw error; },
    searchExecutions: async () => { throw error; },
    archiveExecution: async () => { throw error; },
    loadRecoverableExecutions: async () => { throw error; },
  };
}

describe("gop v1 failure certification", () => {
  it("handles worker crash + lease expiration with deterministic reassignment", () => {
    const runtime = createGenesisOrchestrationRuntime({ bootstrapDefaultWorkers: false });
    runtime.createGlwExecutionForJob({
      jobId: "job_crash_1",
      jobType: "PAGE_GENERATION",
      title: "Crash Cert",
      siteId: "led-display-warehouse",
    });

    runtime.workers.register({
      workerId: "worker.crash.a",
      name: "Worker Crash A",
      workerType: "ai",
      capabilities: ["content.generate"],
      maxCapacity: 1,
      protocolVersion: "gop-worker/v1",
      tokenId: "token-a",
      authMode: "SIGNED_TOKEN",
      leaseTtlMs: 100,
      heartbeatIntervalMs: 50,
    });

    runtime.workers.register({
      workerId: "worker.crash.b",
      name: "Worker Crash B",
      workerType: "ai",
      capabilities: ["content.generate"],
      maxCapacity: 1,
      protocolVersion: "gop-worker/v1",
      tokenId: "token-b",
      authMode: "SIGNED_TOKEN",
    });

    const leased = runtime.acquireWorkLease({
      workerId: "worker.crash.a",
      workerType: "ai",
      workerCapabilities: ["content.generate"],
      protocolVersion: "gop-worker/v1",
      tokenId: "token-a",
    });

    expect(leased).not.toBeNull();
    runtime.workers.markDisconnected("worker.crash.a");

    const leaseId = leased!.lease.leaseId;
    const renew = runtime.renewExecutionLease({ leaseId, workerId: "worker.crash.a" });
    expect(renew).not.toBeNull();

    runtime.queue.expireLeases(Date.now() + 5_000);
    const reassigned = runtime.acquireWorkLease({
      workerId: "worker.crash.b",
      workerType: "ai",
      workerCapabilities: ["content.generate"],
      protocolVersion: "gop-worker/v1",
      tokenId: "token-b",
    });

    expect(reassigned).not.toBeNull();
    expect(reassigned?.execution.executionId).toBe(leased?.execution.executionId);
  });

  it("supports restart recovery from durable repository", async () => {
    const execution = transitionExecutionStatus(createGenesisExecution({
      executionId: "gexec_restart_1",
      jobId: "job_restart_1",
      executionType: "PAGE_GENERATION",
      workspaceId: "glw-led-display-warehouse",
      moduleId: "glw.core",
      jobType: "PAGE_GENERATION",
    }), "RUNNING");

    const repository = createInMemoryExecutionRepository([execution]);
    const runtime = createGenesisOrchestrationRuntime({ repository, bootstrapDefaultWorkers: false });

    await runtime.ensureRecovered();
    const recovered = runtime.getExecutionById("gexec_restart_1");
    expect(recovered?.status).toBe("WAITING");
    expect(recovered?.approvalRequired).toBe(true);
  });

  it("prevents duplicate completion from mutating execution twice", () => {
    const runtime = createGenesisOrchestrationRuntime({ bootstrapDefaultWorkers: false });
    runtime.createGlwExecutionForJob({
      jobId: "job_dup_complete_1",
      jobType: "PAGE_GENERATION",
      title: "Dup Complete",
      siteId: "led-display-warehouse",
    });

    runtime.workers.register({
      workerId: "worker.dup",
      name: "Worker Dup",
      workerType: "ai",
      capabilities: ["content.generate"],
      maxCapacity: 1,
      protocolVersion: "gop-worker/v1",
      tokenId: "token-dup",
      authMode: "SIGNED_TOKEN",
    });

    const leased = runtime.acquireWorkLease({
      workerId: "worker.dup",
      workerType: "ai",
      workerCapabilities: ["content.generate"],
      protocolVersion: "gop-worker/v1",
      tokenId: "token-dup",
    });

    expect(leased).not.toBeNull();

    const first = runtime.reportExecutionCompletion({
      leaseId: leased!.lease.leaseId,
      workerId: "worker.dup",
      output: { ok: true },
    });
    const second = runtime.reportExecutionCompletion({
      leaseId: leased!.lease.leaseId,
      workerId: "worker.dup",
      output: { ok: false },
    });

    expect(first?.status).toBe("SUCCEEDED");
    expect(second).toBeNull();
  });

  it("handles queue pause and drain without invalid dispatch", () => {
    const runtime = createGenesisOrchestrationRuntime({ bootstrapDefaultWorkers: false });
    runtime.createGlwExecutionForJob({
      jobId: "job_queue_state_1",
      jobType: "PAGE_GENERATION",
      title: "Queue Pause",
      siteId: "led-display-warehouse",
    });

    runtime.workers.register({
      workerId: "worker.queue",
      name: "Worker Queue",
      workerType: "ai",
      capabilities: ["content.generate"],
      maxCapacity: 1,
      protocolVersion: "gop-worker/v1",
      tokenId: "token-queue",
      authMode: "SIGNED_TOKEN",
    });

    runtime.queue.pause();
    expect(runtime.dispatchPending(5)).toHaveLength(0);

    runtime.queue.drain();
    expect(runtime.dispatchPending(5)).toHaveLength(0);

    runtime.queue.resume();
    expect(runtime.dispatchPending(1).length).toBeGreaterThanOrEqual(1);
  });

  it("degrades safely when database reconnect is unavailable", async () => {
    const runtime = createGenesisOrchestrationRuntime({
      repository: createThrowingRepository(),
      bootstrapDefaultWorkers: false,
    });

    await expect(runtime.ensureRecovered()).resolves.toBeUndefined();
    await expect(runtime.listDurableExecutions({ workspaceId: "glw-led-display-warehouse" })).resolves.toEqual([]);
  });
});
