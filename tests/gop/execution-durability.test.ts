import { describe, expect, it } from "@jest/globals";
import {
  createGenesisExecution,
  createInMemoryExecutionRepository,
  createExecutionSnapshot,
  replayExecutionFromSnapshotAndEvents,
  createGenesisOrchestrationRuntime,
} from "@/platform/gop";
import type { GenesisPersistedEvent } from "@/platform/gop/event-store";

function createEvent(input: Partial<GenesisPersistedEvent> & { sequence: number; status: GenesisPersistedEvent["status"] }): GenesisPersistedEvent {
  return {
    eventId: input.eventId ?? `evt_${input.sequence}`,
    jobId: input.jobId ?? "job_durable_1",
    moduleId: input.moduleId ?? "glw.core",
    jobType: input.jobType ?? "PAGE_GENERATION",
    eventType: input.eventType ?? "STATE_CHANGED",
    stage: input.stage ?? null,
    status: input.status,
    message: input.message ?? null,
    source: input.source ?? "test",
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    sequence: input.sequence,
    durationMs: input.durationMs ?? null,
    metadata: input.metadata ?? null,
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
    correlationId: input.correlationId ?? null,
    causationId: input.causationId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

describe("gop execution durability", () => {
  it("stores execution records and snapshots in memory repository", async () => {
    const repository = createInMemoryExecutionRepository();
    const execution = createGenesisExecution({
      executionId: "gexec_test_repo",
      executionType: "PAGE_GENERATION",
      jobId: "job_repo_1",
      workspaceId: "glw-led-display-warehouse",
      moduleId: "glw.core",
      jobType: "PAGE_GENERATION",
      queueName: "glw-default",
    });

    await repository.saveExecution(execution);

    const loaded = await repository.loadExecution("gexec_test_repo");
    expect(loaded?.jobId).toBe("job_repo_1");

    const snapshot1 = createExecutionSnapshot({
      execution,
      snapshotSequence: 1,
      upToEventSequence: 2,
    });
    const snapshot2 = createExecutionSnapshot({
      execution: { ...execution, status: "RUNNING" },
      snapshotSequence: 2,
      upToEventSequence: 3,
    });

    await repository.storeSnapshot(snapshot1);
    await repository.storeSnapshot(snapshot2);

    const latest = await repository.loadLatestSnapshot("gexec_test_repo");
    expect(latest?.snapshotSequence).toBe(2);

    const removed = await repository.compactSnapshots("gexec_test_repo", 1);
    expect(removed).toBe(1);
  });

  it("replays execution state from snapshot and events deterministically", () => {
    const base = createGenesisExecution({
      executionId: "gexec_replay_1",
      executionType: "PAGE_GENERATION",
      jobId: "job_replay_1",
      workspaceId: "glw-led-display-warehouse",
      moduleId: "glw.core",
      jobType: "PAGE_GENERATION",
    });

    const snapshot = createExecutionSnapshot({
      execution: { ...base, status: "RUNNING", currentState: "generating" },
      snapshotSequence: 1,
      upToEventSequence: 1,
    });

    const events = [
      createEvent({ sequence: 2, status: "RUNNING", stage: "generation" }),
      createEvent({ sequence: 3, status: "COMPLETE", stage: "publish" }),
    ];

    const replayed = replayExecutionFromSnapshotAndEvents({
      baseExecution: base,
      snapshot,
      events,
    });

    expect(replayed.status).toBe("SUCCEEDED");
    expect(replayed.currentState).toBe("publish");
  });

  it("recovers in-flight durable executions on runtime startup", async () => {
    const execution = createGenesisExecution({
      executionId: "gexec_recover_1",
      executionType: "PAGE_GENERATION",
      jobId: "job_recover_1",
      workspaceId: "glw-led-display-warehouse",
      moduleId: "glw.core",
      jobType: "PAGE_GENERATION",
    });

    const repository = createInMemoryExecutionRepository([
      { ...execution, status: "RUNNING" },
    ]);

    const runtime = createGenesisOrchestrationRuntime({ repository });
    await runtime.ensureRecovered();

    const recovered = runtime.getExecutionById("gexec_recover_1");
    expect(recovered?.status).toBe("WAITING");
    expect(recovered?.approvalRequired).toBe(true);
  });
});
