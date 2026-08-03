import { describe, expect, it, jest } from "@jest/globals";
import type {
  ScheduleAuditRecord,
  ScheduleClaimRecord,
  ScheduleDefinition,
  ScheduleInstance,
  ScheduleMetrics,
  ScheduleOccurrence,
  SchedulingPersistenceCoordinator,
} from "@/platform/scheduling";
import {
  FileSchedulingPersistenceCoordinator,
  MissedRunPolicyService,
  ScheduleCalculator,
  SchedulingEngine,
  TestClock,
  WorkflowSchedulingAdapter,
} from "@/platform/scheduling";

type MemoryState = {
  definitions: ScheduleDefinition[];
  instances: ScheduleInstance[];
  occurrences: ScheduleOccurrence[];
  claims: ScheduleClaimRecord[];
  audits: ScheduleAuditRecord[];
  metrics: ScheduleMetrics | null;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createState(): MemoryState {
  return {
    definitions: [],
    instances: [],
    occurrences: [],
    claims: [],
    audits: [],
    metrics: null,
  };
}

function createCoordinator(state: MemoryState): SchedulingPersistenceCoordinator {
  return {
    definitionStore: {
      save: async (definition) => {
        state.definitions = state.definitions.filter((entry) => !(entry.scheduleId === definition.scheduleId && entry.version.major === definition.version.major && entry.version.minor === definition.version.minor && entry.version.patch === definition.version.patch));
        state.definitions.push(clone(definition));
      },
      get: async (scheduleId) => clone(state.definitions.find((entry) => entry.scheduleId === scheduleId) ?? null),
      list: async () => clone(state.definitions),
    },
    instanceStore: {
      create: async (instance) => {
        state.instances.push(clone(instance));
      },
      update: async (instance) => {
        const index = state.instances.findIndex((entry) => entry.instanceId === instance.instanceId);
        if (index >= 0) {
          state.instances[index] = clone(instance);
        } else {
          state.instances.push(clone(instance));
        }
      },
      get: async (instanceId) => clone(state.instances.find((entry) => entry.instanceId === instanceId) ?? null),
      list: async () => clone(state.instances),
      findByScheduleId: async (scheduleId) => clone(state.instances.find((entry) => entry.scheduleId === scheduleId) ?? null),
    },
    occurrenceStore: {
      append: async (occurrence) => {
        state.occurrences.push(clone(occurrence));
      },
      update: async (occurrence) => {
        const index = state.occurrences.findIndex((entry) => entry.occurrenceId === occurrence.occurrenceId);
        if (index >= 0) {
          state.occurrences[index] = clone(occurrence);
        } else {
          state.occurrences.push(clone(occurrence));
        }
      },
      listByInstance: async (instanceId) => clone(state.occurrences.filter((entry) => entry.instanceId === instanceId)),
      listAll: async () => clone(state.occurrences),
    },
    claimStore: {
      upsert: async (claim) => {
        const index = state.claims.findIndex((entry) => entry.occurrenceId === claim.occurrenceId);
        if (index >= 0) {
          state.claims[index] = clone(claim);
        } else {
          state.claims.push(clone(claim));
        }
      },
      getByOccurrenceId: async (occurrenceId) => clone(state.claims.find((entry) => entry.occurrenceId === occurrenceId) ?? null),
      list: async () => clone(state.claims),
    },
    auditStore: {
      append: async (record) => {
        state.audits.push(clone(record));
      },
      list: async () => clone(state.audits),
    },
    metricsStore: {
      save: async (metrics) => {
        state.metrics = clone(metrics);
      },
      load: async () => clone(state.metrics),
    },
    loadRecoverySnapshot: async () => ({
      definitions: clone(state.definitions),
      instances: clone(state.instances),
      occurrences: clone(state.occurrences),
      claims: clone(state.claims),
      audits: clone(state.audits),
      metrics: clone(state.metrics),
    }),
  };
}

function buildDefinition(overrides?: Partial<ScheduleDefinition>): ScheduleDefinition {
  return {
    scheduleId: "schedule.demo",
    name: "Demo Schedule",
    scheduleType: "INTERVAL",
    version: { major: 1, minor: 0, patch: 0 },
    state: "DRAFT",
    timezone: { ianaName: "UTC" },
    interval: { intervalMs: 60_000, anchorAt: "2026-08-03T00:00:00.000Z" },
    startAt: "2026-08-03T00:00:00.000Z",
    command: {
      commandType: "DEFERRED_COMMAND",
      topic: "scheduling.dispatch",
      payload: { command: "run" },
    },
    missedRunPolicy: { type: "RUN_ONCE" },
    createdBy: "user:admin",
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    ...overrides,
  };
}

function createEngine(options?: {
  state?: MemoryState;
  publishFailure?: boolean;
  clock?: TestClock;
  authorizer?: (input: { action: string; scheduleId: string; actorId: string }) => Promise<boolean> | boolean;
}) {
  const state = options?.state ?? createState();
  const events: Array<{ topic: string; payload: Record<string, unknown> }> = [];
  const clock = options?.clock ?? new TestClock("2026-08-03T00:00:00.000Z");

  const engine = new SchedulingEngine({
    clock,
    authorizer: options?.authorizer,
    persistence: createCoordinator(state),
    messaging: {
      publish: async (input) => {
        if (options?.publishFailure) {
          throw new Error("dispatch_failure");
        }

        events.push({ topic: input.topic, payload: input.envelope.payload as Record<string, unknown> });
      },
      healthSnapshot: () => ({ status: "HEALTHY" }),
    },
  });

  return { engine, state, events, clock };
}

describe("GWS-1001 scheduling foundation", () => {
  it("calculates one-time, interval, recurring, cron, and calendar next runs", () => {
    const calculator = new ScheduleCalculator(new TestClock("2026-08-03T00:00:00.000Z"));

    const oneTime = calculator.nextRun(buildDefinition({
      scheduleType: "ONE_TIME",
      oneTime: { runAt: "2026-08-03T01:00:00.000Z" },
      interval: undefined,
    }));
    expect(oneTime.nextRunAt).toBe("2026-08-03T01:00:00.000Z");

    const interval = calculator.nextRun(buildDefinition(), new Date("2026-08-03T00:03:10.000Z"));
    expect(interval.nextRunAt).toBe("2026-08-03T00:04:00.000Z");

    const recurring = calculator.nextRun(buildDefinition({
      scheduleType: "RECURRING",
      recurring: { frequency: "DAILY", interval: 1, timeOfDay: "01:30" },
      interval: undefined,
    }), new Date("2026-08-03T00:00:00.000Z"));
    expect(recurring.nextRunAt).toBe("2026-08-03T01:30:00.000Z");

    const cron = calculator.nextRun(buildDefinition({
      scheduleType: "CRON",
      cron: { expression: "15 2 * * *" },
      interval: undefined,
    }), new Date("2026-08-03T00:00:00.000Z"));
    expect(cron.nextRunAt).toBe("2026-08-03T02:15:00.000Z");

    const calendar = calculator.nextRun(buildDefinition({
      scheduleType: "CALENDAR",
      calendar: { timeOfDay: "03:00", daysOfWeek: [1, 2, 3, 4, 5] },
      interval: undefined,
    }), new Date("2026-08-02T23:00:00.000Z"));
    expect(calendar.nextRunAt).toBe("2026-08-03T03:00:00.000Z");
  });

  it("supports timezone conversion and daylight-saving transitions", () => {
    const calculator = new ScheduleCalculator(new TestClock("2026-03-08T05:50:00.000Z"));

    const schedule = buildDefinition({
      timezone: { ianaName: "America/New_York" },
      scheduleType: "RECURRING",
      recurring: { frequency: "DAILY", interval: 1, timeOfDay: "03:00" },
      interval: undefined,
      startAt: "2026-03-08T00:00:00.000Z",
    });

    const next = calculator.nextRun(schedule, new Date("2026-03-08T05:50:00.000Z"));
    expect(next.nextRunAt).toBe("2026-03-08T07:00:00.000Z");
  });

  it("applies missed-run policies including bounded catch-up and fail", () => {
    const policy = new MissedRunPolicyService();
    const occurrences = [0, 1, 2, 3].map((index) => ({
      occurrenceId: `o-${index}`,
      instanceId: "i-1",
      scheduleId: "s-1",
      dueAt: `2026-08-03T00:0${index}:00.000Z`,
      trigger: { triggerType: index < 3 ? "MISSED_RUN_CATCH_UP" : "SCHEDULED", evaluatedAt: "2026-08-03T00:04:00.000Z" },
      status: "PENDING" as const,
    }));

    expect(policy.apply({ type: "SKIP" }, occurrences)).toHaveLength(1);
    expect(policy.apply({ type: "RUN_ONCE" }, occurrences)).toHaveLength(1);
    expect(policy.apply({ type: "CATCH_UP_ALL" }, occurrences)).toHaveLength(4);
    expect(policy.apply({ type: "CATCH_UP_LIMITED", catchUpLimit: 2 }, occurrences)).toHaveLength(3);
    expect(() => policy.apply({ type: "FAIL" }, occurrences)).toThrow("schedule_missed_run_policy_fail");
  });

  it("registers schedules, rejects duplicates, and validates definitions", async () => {
    const { engine } = createEngine();
    await engine.waitUntilReady();

    const instance = await engine.registerSchedule(buildDefinition());
    expect(instance.state).toBe("DRAFT");

    await expect(engine.registerSchedule(buildDefinition())).rejects.toThrow("schedule_duplicate");
    await expect(engine.registerSchedule(buildDefinition({ scheduleId: "bad", timezone: { ianaName: "Nope/Invalid" } }))).rejects.toThrow("schedule_invalid_time_zone");
  });

  it("enforces lifecycle transitions for activate pause resume cancel and completion", async () => {
    const { engine } = createEngine();
    await engine.waitUntilReady();

    await engine.registerSchedule(buildDefinition());
    const active = await engine.activate("schedule.demo", "user:admin");
    expect(active.state).toBe("ACTIVE");

    const paused = await engine.pause("schedule.demo", "user:admin");
    expect(paused.state).toBe("PAUSED");

    const resumed = await engine.resume("schedule.demo", "user:admin");
    expect(resumed.state).toBe("ACTIVE");

    const cancelled = await engine.cancel("schedule.demo", "user:admin");
    expect(cancelled.state).toBe("CANCELLED");

    await expect(engine.resume("schedule.demo", "user:admin")).rejects.toThrow("schedule_invalid_lifecycle_transition");
  });

  it("evaluates due occurrences, claims atomically, dispatches through messaging, and updates metrics", async () => {
    const { engine, events, clock } = createEngine();
    await engine.waitUntilReady();

    await engine.registerSchedule(buildDefinition({
      state: "ACTIVE",
      missedRunPolicy: { type: "CATCH_UP_LIMITED", catchUpLimit: 2 },
    }));

    clock.advanceMs(5 * 60_000);
    const results = await engine.evaluateDueSchedules();

    expect(results.length).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].topic).toBe("scheduling.dispatch");

    const metrics = engine.getMetrics();
    expect(metrics.dueOccurrences).toBeGreaterThan(0);
    expect(metrics.claimedOccurrences).toBeGreaterThan(0);
    expect(metrics.dispatchedOccurrences).toBeGreaterThan(0);
    expect(metrics.catchUpOccurrences).toBeGreaterThan(0);
  });

  it("prevents duplicate occurrence dispatch using claim idempotency", async () => {
    const state = createState();
    const clock = new TestClock("2026-08-03T00:00:00.000Z");
    const first = createEngine({ state, clock });
    await first.engine.waitUntilReady();

    await first.engine.registerSchedule(buildDefinition({ state: "ACTIVE" }));
    clock.advanceMs(60_000);
    await first.engine.evaluateDueSchedules();

    const second = createEngine({ state, clock });
    await second.engine.waitUntilReady();
    const before = second.events.length;
    await second.engine.evaluateDueSchedules();
    expect(second.events.length).toBe(before);
  });

  it("handles dispatch failures, marks schedule failed, and records audit", async () => {
    const { engine, state, clock } = createEngine({ publishFailure: true });
    await engine.waitUntilReady();

    await engine.registerSchedule(buildDefinition({ state: "ACTIVE" }));
    clock.advanceMs(60_000);
    await engine.evaluateDueSchedules();

    const instance = state.instances[0];
    expect(instance.state).toBe("FAILED");
    expect(state.audits.some((entry) => entry.eventType === "SCHEDULE_FAILED")).toBe(true);
  });

  it("restores state on restart, recovers expired claims, and preserves audit continuity", async () => {
    const state = createState();
    const clock = new TestClock("2026-08-03T00:00:00.000Z");
    const first = createEngine({ state, clock });
    await first.engine.waitUntilReady();
    await first.engine.registerSchedule(buildDefinition({ state: "ACTIVE" }));

    clock.advanceMs(90_000);
    await first.engine.evaluateDueSchedules();

    const second = createEngine({ state, clock });
    await second.engine.waitUntilReady();

    expect(second.engine.getMetrics().recoveryCount).toBeGreaterThan(0);
    expect(second.engine.getAuditRecords().length).toBeGreaterThan(0);
  });

  it("enforces authorization boundary through injected authorizer", async () => {
    const authorizer = jest.fn(async () => false);
    const { engine } = createEngine({ authorizer });
    await engine.waitUntilReady();

    await expect(engine.registerSchedule(buildDefinition())).rejects.toThrow("schedule_authorization_denied");
    expect(authorizer).toHaveBeenCalled();
  });

  it("keeps workflow integration contract-first and transport-neutral", () => {
    const adapter = new WorkflowSchedulingAdapter();
    const schedule = buildDefinition();
    const command = adapter.buildWorkflowTimerCommand({
      schedule,
      reference: { workflowId: "wf-1", workflowInstanceId: "wf-inst-1", stepId: "s-1" },
    });

    expect(command.topic).toBe("workflow.timer");
    expect(command.commandType).toBe("WORKFLOW_TIMER");
    expect(command.workflowInstanceId).toBe("wf-inst-1");
  });

  it("uses durable file persistence coordinator shape for restart safety", async () => {
    const coordinator = new FileSchedulingPersistenceCoordinator(`${process.cwd()}/data/test-scheduling-${Date.now()}`);
    const snapshot = await coordinator.loadRecoverySnapshot();
    expect(snapshot.definitions).toEqual([]);
    expect(snapshot.instances).toEqual([]);
    expect(snapshot.occurrences).toEqual([]);
    expect(snapshot.claims).toEqual([]);
  });

  it("surfaces health and readiness metrics for mission control observability", async () => {
    const { engine } = createEngine();
    await engine.waitUntilReady();

    const health = await engine.healthSnapshot();
    const readiness = engine.getOperationalReadiness();

    expect(health.status).toBe("HEALTHY");
    expect(readiness.durability).toBe("FILE_PERSISTED");
    expect(typeof readiness.averageSchedulingDelayMs).toBe("number");
  });
});
