import { describe, expect, it, jest } from "@jest/globals";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
  FileScheduleClaimStore,
  MissedRunPolicyService,
  OccurrenceClaimService,
  ScheduleCalculator,
  SchedulingDataStore,
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
      findByLogicalRunKey: async (instanceId, logicalRunKey) => clone(state.occurrences.find((entry) => entry.instanceId === instanceId && entry.logicalRunKey === logicalRunKey) ?? null),
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
      snapshot: {
        definitions: clone(state.definitions),
        instances: clone(state.instances),
        occurrences: clone(state.occurrences),
        claims: clone(state.claims),
        audits: clone(state.audits),
        metrics: clone(state.metrics),
      },
      diagnostics: {
        classification: "CLEAN",
        missingFile: false,
        corruptFile: false,
        invalidDefinitions: 0,
        invalidInstances: 0,
        invalidOccurrences: 0,
        invalidClaims: 0,
        invalidAudits: 0,
        invalidMetrics: 0,
        totalInvalidRecords: 0,
      },
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
  publishImpl?: (attempt: number) => Promise<void>;
  clock?: TestClock;
  dispatchRetryLimit?: number;
  dispatchTimeoutMs?: number;
  persistence?: SchedulingPersistenceCoordinator;
  authorizer?: (input: { action: string; scheduleId: string; actorId: string }) => Promise<boolean> | boolean;
}) {
  const state = options?.state ?? createState();
  const events: Array<{ topic: string; payload: Record<string, unknown> }> = [];
  const clock = options?.clock ?? new TestClock("2026-08-03T00:00:00.000Z");
  let publishAttempts = 0;

  const engine = new SchedulingEngine({
    clock,
    authorizer: options?.authorizer,
    persistence: options?.persistence ?? createCoordinator(state),
    dispatchRetryLimit: options?.dispatchRetryLimit,
    dispatchTimeoutMs: options?.dispatchTimeoutMs,
    messaging: {
      publish: async (input) => {
        publishAttempts += 1;
        if (options?.publishImpl) {
          await options.publishImpl(publishAttempts);
        }

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

    const spring = calculator.classifyOccurrenceTime(schedule, "2026-03-08T07:00:00.000Z");
    expect(spring.isDstAmbiguous).toBe(false);

    const fallSchedule = buildDefinition({
      timezone: { ianaName: "America/New_York" },
      scheduleType: "RECURRING",
      recurring: { frequency: "DAILY", interval: 1, timeOfDay: "01:30" },
      interval: undefined,
      startAt: "2026-11-01T00:00:00.000Z",
    });
    const fallbackA = calculator.classifyOccurrenceTime(fallSchedule, "2026-11-01T05:30:00.000Z");
    const fallbackB = calculator.classifyOccurrenceTime(fallSchedule, "2026-11-01T06:30:00.000Z");
    expect(fallbackA.isDstAmbiguous).toBe(true);
    expect(fallbackB.isDstAmbiguous).toBe(true);
    expect(fallbackA.localRunKey).toBe(fallbackB.localRunKey);
    expect(fallbackA.utcOffsetMinutes).not.toBe(fallbackB.utcOffsetMinutes);
  });

  it("remains deterministic across multiple yearly DST transitions", () => {
    const calculator = new ScheduleCalculator(new TestClock("2026-01-01T00:00:00.000Z"));
    const schedule = buildDefinition({
      timezone: { ianaName: "America/New_York" },
      scheduleType: "RECURRING",
      recurring: { frequency: "DAILY", interval: 1, timeOfDay: "01:30" },
      interval: undefined,
      startAt: "2025-01-01T00:00:00.000Z",
    });

    const repeatedLocalRuns = [
      "2025-11-02T05:30:00.000Z",
      "2025-11-02T06:30:00.000Z",
      "2026-11-01T05:30:00.000Z",
      "2026-11-01T06:30:00.000Z",
      "2027-11-07T05:30:00.000Z",
      "2027-11-07T06:30:00.000Z",
    ];

    for (const dueAt of repeatedLocalRuns) {
      const classified = calculator.classifyOccurrenceTime(schedule, dueAt);
      expect(classified.isDstAmbiguous).toBe(true);
      expect(classified.localRunKey.startsWith("America/New_York:")).toBe(true);
    }
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

  it("applies deterministic fall-back duplicate prevention policy for repeated local timestamps", async () => {
    const clock = new TestClock("2026-11-01T05:20:00.000Z");
    const { engine, events } = createEngine({ clock });
    await engine.waitUntilReady();

    await engine.registerSchedule(buildDefinition({
      state: "ACTIVE",
      scheduleType: "RECURRING",
      recurring: { frequency: "DAILY", interval: 1, timeOfDay: "01:30" },
      interval: undefined,
      timezone: { ianaName: "America/New_York" },
      startAt: "2026-11-01T00:00:00.000Z",
      missedRunPolicy: { type: "CATCH_UP_ALL" },
    }));

    clock.set("2026-11-01T07:40:00.000Z");
    await engine.evaluateDueSchedules();

    const metrics = engine.getMetrics();
    expect(metrics.dstAmbiguityCount).toBeGreaterThan(0);
    expect(metrics.skippedOccurrences).toBeGreaterThan(0);
    expect(events.length).toBe(1);
    expect(engine.getAuditRecords().some((entry) => entry.eventType === "OCCURRENCE_SKIPPED")).toBe(true);
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

  it("retries transient transport failures and records retry metrics", async () => {
    let attempt = 0;
    const { engine, clock, events } = createEngine({
      publishImpl: async () => {
        attempt += 1;
        if (attempt < 2) {
          throw new Error("transport unavailable");
        }
      },
    });
    await engine.waitUntilReady();

    await engine.registerSchedule(buildDefinition({ state: "ACTIVE" }));
    clock.advanceMs(60_000);
    await engine.evaluateDueSchedules();

    expect(events.length).toBeGreaterThan(0);
    expect(engine.getMetrics().dispatchRetryCount).toBe(1);
    expect(engine.getAuditRecords().some((entry) => entry.eventType === "DISPATCH_RETRY")).toBe(true);
  });

  it("classifies dispatch timeout with retry exhaustion", async () => {
    const { engine, clock, state } = createEngine({
      dispatchRetryLimit: 2,
      dispatchTimeoutMs: 10,
      publishImpl: async () => new Promise<void>(() => {}),
    });
    await engine.waitUntilReady();

    await engine.registerSchedule(buildDefinition({ state: "ACTIVE" }));
    clock.advanceMs(60_000);
    await engine.evaluateDueSchedules();

    expect(engine.getMetrics().dispatchRetryCount).toBe(1);
    expect(engine.getMetrics().dispatchFailures).toBe(1);
    expect(state.instances[0].state).toBe("FAILED");
    expect(engine.getAuditRecords().some((entry) => entry.eventType === "DISPATCH_RETRY_EXHAUSTED")).toBe(true);
  });

  it("does not retry permanent dispatch failures", async () => {
    const { engine, clock } = createEngine({
      publishImpl: async () => {
        throw new Error("invalid payload contract");
      },
    });
    await engine.waitUntilReady();

    await engine.registerSchedule(buildDefinition({ state: "ACTIVE" }));
    clock.advanceMs(60_000);
    await engine.evaluateDueSchedules();

    expect(engine.getMetrics().dispatchRetryCount).toBe(0);
    expect(engine.getMetrics().dispatchFailures).toBe(1);
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

  it("flags corrupt persistence files and classifies recovery state", async () => {
    const basePath = join(process.cwd(), "data", `test-scheduling-corrupt-${Date.now()}`);
    await mkdir(basePath, { recursive: true });
    await writeFile(join(basePath, "scheduling-state.json"), "{ not-json", "utf8");

    const coordinator = new FileSchedulingPersistenceCoordinator(basePath);
    const result = await coordinator.loadRecoverySnapshot();
    expect(result.diagnostics.classification).toBe("CORRUPT_FILE");
    expect(result.snapshot.definitions).toEqual([]);
    expect(result.snapshot.instances).toEqual([]);
  });

  it("sanitizes partial persistence records and reports invalid counters", async () => {
    const basePath = join(process.cwd(), "data", `test-scheduling-partial-${Date.now()}`);
    await mkdir(basePath, { recursive: true });
    const valid = buildDefinition();

    await writeFile(
      join(basePath, "scheduling-state.json"),
      JSON.stringify({
        definitions: [valid, { broken: true }],
        instances: [{ invalid: true }],
        occurrences: [{ invalid: true }],
        claims: [{ invalid: true }],
        audits: [{ invalid: true }],
        metrics: { invalid: true },
      }),
      "utf8",
    );

    const coordinator = new FileSchedulingPersistenceCoordinator(basePath);
    const result = await coordinator.loadRecoverySnapshot();
    expect(result.diagnostics.classification).toBe("PARTIAL_STATE");
    expect(result.snapshot.definitions).toHaveLength(1);
    expect(result.diagnostics.invalidDefinitions).toBe(1);
    expect(result.diagnostics.invalidMetrics).toBe(1);
  });

  it("survives recovery load failures in safe degraded mode", async () => {
    const state = createState();
    const persistence = createCoordinator(state);
    persistence.loadRecoverySnapshot = async () => {
      throw new Error("recovery_load_failure");
    };

    const { engine } = createEngine({ persistence });
    await engine.waitUntilReady();

    const metrics = engine.getMetrics();
    expect(metrics.recoveryFailures).toBe(1);
    expect(engine.getAuditRecords().some((entry) => entry.eventType === "RECOVERY_FAILED")).toBe(true);
  });

  it("records audit persistence failures without crashing scheduling evaluation", async () => {
    const state = createState();
    const persistence = createCoordinator(state);
    persistence.auditStore.append = async () => {
      throw new Error("audit_store_down");
    };

    const { engine, clock } = createEngine({ persistence });
    await engine.waitUntilReady();
    await engine.registerSchedule(buildDefinition({ state: "ACTIVE" }));

    clock.advanceMs(60_000);
    await engine.evaluateDueSchedules();

    expect(engine.getMetrics().auditFailureCount).toBeGreaterThan(0);
    expect(engine.getAuditRecords().some((entry) => entry.eventType === "AUDIT_PERSISTENCE_FAILURE")).toBe(true);
  });

  it("supports atomic claim semantics with deterministic ownership and conflict rejection", async () => {
    const basePath = join(process.cwd(), "data", `test-scheduling-claims-${Date.now()}`);
    const store = new FileScheduleClaimStore(new SchedulingDataStore(basePath));
    const service = new OccurrenceClaimService(store, new TestClock("2026-08-03T00:00:00.000Z"));

    const [a, b] = await Promise.all([
      service.claim({ occurrenceId: "occ-1", owner: "node-a", idempotencyKey: "key-a", logicalRunKey: "run-1" }),
      service.claim({ occurrenceId: "occ-2", owner: "node-b", idempotencyKey: "key-b", logicalRunKey: "run-1" }),
    ]);

    const claimedCount = [a, b].filter((entry) => entry.claimed).length;
    expect(claimedCount).toBe(1);
    expect([a.reason, b.reason].includes("CONFLICT")).toBe(true);
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
    const result = await coordinator.loadRecoverySnapshot();
    expect(result.snapshot.definitions).toEqual([]);
    expect(result.snapshot.instances).toEqual([]);
    expect(result.snapshot.occurrences).toEqual([]);
    expect(result.snapshot.claims).toEqual([]);
  });

  it("surfaces health and readiness metrics for mission control observability", async () => {
    const { engine } = createEngine();
    await engine.waitUntilReady();

    const health = await engine.healthSnapshot();
    const readiness = engine.getOperationalReadiness();

    expect(health.status).toBe("HEALTHY");
    expect(readiness.durability).toBe("FILE_PERSISTED");
    expect(typeof readiness.averageSchedulingDelayMs).toBe("number");
    expect(typeof readiness.dispatchRetryCount).toBe("number");
    expect(typeof readiness.corruptPersistenceCount).toBe("number");
  });
});
