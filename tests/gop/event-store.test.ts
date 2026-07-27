import { describe, expect, it } from "@jest/globals";
import { createInMemoryGenesisEventStore } from "@/platform/gop/event-store";

describe("gop event store", () => {
  it("appends and orders events by sequence", async () => {
    const store = createInMemoryGenesisEventStore();

    await store.appendEvent({
      jobId: "job-1",
      moduleId: "glw.core",
      jobType: "PAGE_GENERATION",
      type: "JOB_CREATED",
      label: "Job Created",
      occurredAt: "2026-07-26T10:00:00.000Z",
      status: "QUEUED",
    });

    await store.appendEvent({
      jobId: "job-1",
      moduleId: "glw.core",
      jobType: "PAGE_GENERATION",
      type: "STARTED",
      label: "Started",
      occurredAt: "2026-07-26T10:00:01.000Z",
      status: "RUNNING",
    });

    const events = await store.listEventsForJob("job-1");
    expect(events.map((event) => event.sequence)).toEqual([1, 2]);
  });

  it("is idempotent with idempotency key", async () => {
    const store = createInMemoryGenesisEventStore();

    const first = await store.appendEventIdempotently({
      jobId: "job-2",
      moduleId: "glw.core",
      jobType: "PAGE_GENERATION",
      type: "JOB_CREATED",
      label: "Job Created",
      occurredAt: "2026-07-26T10:00:00.000Z",
      status: "QUEUED",
      idempotencyKey: "job-2:create",
    });

    const second = await store.appendEventIdempotently({
      jobId: "job-2",
      moduleId: "glw.core",
      jobType: "PAGE_GENERATION",
      type: "JOB_CREATED",
      label: "Job Created",
      occurredAt: "2026-07-26T10:00:01.000Z",
      status: "QUEUED",
      idempotencyKey: "job-2:create",
    });

    expect(first.eventId).toBe(second.eventId);
    const events = await store.listEventsForJob("job-2");
    expect(events).toHaveLength(1);
  });

  it("rejects duplicate event ids on non-idempotent append", async () => {
    const store = createInMemoryGenesisEventStore();

    await store.appendEvent({
      eventId: "evt_fixed",
      jobId: "job-dup",
      moduleId: "glw.core",
      jobType: "PAGE_GENERATION",
      type: "JOB_CREATED",
      label: "Job Created",
      occurredAt: "2026-07-26T10:00:00.000Z",
      status: "QUEUED",
    });

    await expect(store.appendEvent({
      eventId: "evt_fixed",
      jobId: "job-dup",
      moduleId: "glw.core",
      jobType: "PAGE_GENERATION",
      type: "STARTED",
      label: "Started",
      occurredAt: "2026-07-26T10:01:00.000Z",
      status: "RUNNING",
    })).rejects.toThrow(/duplicate key/);
  });

  it("replays timeline and detects terminal state", async () => {
    const store = createInMemoryGenesisEventStore();

    await store.appendEvent({
      jobId: "job-3",
      moduleId: "glw.core",
      jobType: "PAGE_GENERATION",
      type: "STARTED",
      label: "Started",
      occurredAt: "2026-07-26T10:00:00.000Z",
      status: "RUNNING",
    });

    await store.appendEvent({
      jobId: "job-3",
      moduleId: "glw.core",
      jobType: "PAGE_GENERATION",
      type: "SUCCEEDED",
      label: "Succeeded",
      occurredAt: "2026-07-26T10:00:10.000Z",
      status: "COMPLETE",
      durationMs: 10000,
    });

    const timeline = await store.replayTimeline("job-3");
    expect(timeline.length).toBe(2);

    const summary = await store.summarizeProgress("job-3");
    expect(summary.terminal).toBe(true);
    expect(summary.status).toBe("COMPLETE");

    const terminal = await store.hasTerminalState("job-3");
    expect(terminal).toBe(true);
  });
});
