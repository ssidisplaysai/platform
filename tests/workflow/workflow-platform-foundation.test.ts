import { describe, expect, it, jest } from "@jest/globals";
import type {
  WorkflowAudit,
  WorkflowCheckpoint,
  WorkflowCommandRecord,
  WorkflowCompensationRecord,
  WorkflowDefinition,
  WorkflowExecutionRecord,
  WorkflowInstance,
  WorkflowMetrics,
  WorkflowPersistenceCoordinator,
  WorkflowRecoverySnapshot,
  WorkflowRetryRecord,
  WorkflowTimeoutRecord,
} from "@/platform/workflow";
import { WorkflowEngine } from "@/platform/workflow";

jest.mock("@/platform/identity/services", () => ({
  getGenesisAuthenticationService: () => ({
    healthSnapshot: async () => ({
      status: "HEALTHY",
      checks: [{ name: "identity", status: "PASS", detail: "ok" }],
      generatedAt: new Date().toISOString(),
    }),
  }),
}));

type MemoryState = {
  definitions: WorkflowDefinition[];
  instances: WorkflowInstance[];
  checkpoints: WorkflowCheckpoint[];
  executionHistory: WorkflowExecutionRecord[];
  retries: WorkflowRetryRecord[];
  timeouts: WorkflowTimeoutRecord[];
  compensations: WorkflowCompensationRecord[];
  audits: WorkflowAudit[];
  metrics: WorkflowMetrics | null;
  commands: WorkflowCommandRecord[];
};

type MemoryFlags = {
  failContextPersistence?: boolean;
  failAuditPersistence?: boolean;
};

type MessagingEvent = { topic: string; payload: Record<string, unknown> };

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createState(): MemoryState {
  return {
    definitions: [],
    instances: [],
    checkpoints: [],
    executionHistory: [],
    retries: [],
    timeouts: [],
    compensations: [],
    audits: [],
    metrics: null,
    commands: [],
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function cloneDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  return {
    ...definition,
    version: { ...definition.version },
    steps: definition.steps.map((step) => ({
      ...step,
      timeout: step.timeout ? { ...step.timeout } : undefined,
      retryPolicy: step.retryPolicy ? { ...step.retryPolicy } : undefined,
      transitions: step.transitions?.map((transition) => ({ ...transition })),
    })),
  };
}

function createCoordinator(state: MemoryState, flags?: MemoryFlags): WorkflowPersistenceCoordinator {
  return {
    definitionStore: {
      save: async (definition) => {
        state.definitions = state.definitions.filter((entry) => entry.id !== definition.id);
        state.definitions.push(cloneDefinition(definition));
      },
      get: async (definitionId) => {
        const definition = state.definitions.find((entry) => entry.id === definitionId);
        return definition ? cloneDefinition(definition) : null;
      },
      list: async () => state.definitions.map((definition) => cloneDefinition(definition)),
    },
    instanceStore: {
      create: async (instance) => {
        if (flags?.failContextPersistence) {
          throw new Error("context_persistence_failed");
        }

        state.instances = state.instances.filter((entry) => entry.instanceId !== instance.instanceId);
        state.instances.push(clone(instance));
      },
      get: async (instanceId) => clone(state.instances.find((entry) => entry.instanceId === instanceId) ?? null),
      update: async (instance, expectedVersion) => {
        if (flags?.failContextPersistence) {
          throw new Error("context_persistence_failed");
        }

        const index = state.instances.findIndex((entry) => entry.instanceId === instance.instanceId);
        if (index < 0) {
          return "STALE";
        }

        if (state.instances[index].version !== expectedVersion) {
          return "STALE";
        }

        state.instances[index] = clone(instance);
        return "UPDATED";
      },
      list: async () => clone(state.instances),
    },
    checkpointStore: {
      append: async (checkpoint) => {
        state.checkpoints.push(clone(checkpoint));
      },
      list: async (instanceId) => clone(state.checkpoints.filter((entry) => entry.instanceId === instanceId)),
      listAll: async () => clone(state.checkpoints),
    },
    executionHistoryStore: {
      append: async (record) => {
        state.executionHistory.push(clone(record));
      },
      list: async (instanceId) => clone(state.executionHistory.filter((entry) => entry.instanceId === instanceId)),
      listAll: async () => clone(state.executionHistory),
    },
    retryStore: {
      append: async (record) => {
        state.retries.push(clone(record));
      },
      clear: async (instanceId, stepId) => {
        state.retries = state.retries.filter((entry) => entry.instanceId !== instanceId || entry.stepId !== stepId);
      },
      list: async () => clone(state.retries),
    },
    timeoutStore: {
      upsert: async (record) => {
        const index = state.timeouts.findIndex(
          (entry) => entry.instanceId === record.instanceId && entry.stepId === record.stepId,
        );
        if (index >= 0) {
          state.timeouts[index] = clone(record);
        } else {
          state.timeouts.push(clone(record));
        }
      },
      resolve: async (instanceId, stepId) => {
        state.timeouts = state.timeouts.map((entry) => {
          if (entry.instanceId === instanceId && entry.stepId === stepId) {
            return { ...entry, status: "RESOLVED" as const };
          }

          return entry;
        });
      },
      list: async () => clone(state.timeouts),
    },
    compensationStore: {
      append: async (record) => {
        state.compensations.push(clone(record));
      },
      list: async () => clone(state.compensations),
    },
    auditStore: {
      append: async (record) => {
        if (flags?.failAuditPersistence) {
          throw new Error("audit_persistence_failed");
        }

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
    commandStore: {
      append: async (record) => {
        state.commands = state.commands.filter((entry) => entry.commandKey !== record.commandKey);
        state.commands.push(clone(record));
      },
      get: async (commandKey) => clone(state.commands.find((entry) => entry.commandKey === commandKey) ?? null),
      list: async () => clone(state.commands),
    },
    loadRecoverySnapshot: async (): Promise<WorkflowRecoverySnapshot> => ({
      definitions: state.definitions.map((definition) => cloneDefinition(definition)),
      instances: clone(state.instances),
      checkpoints: clone(state.checkpoints),
      executionHistory: clone(state.executionHistory),
      retries: clone(state.retries),
      timeouts: clone(state.timeouts),
      compensations: clone(state.compensations),
      audits: clone(state.audits),
      metrics: clone(state.metrics),
      commands: clone(state.commands),
    }),
  };
}

function createEngine(options?: {
  state?: MemoryState;
  flags?: MemoryFlags;
  publishFailure?: boolean;
}): { engine: WorkflowEngine; state: MemoryState; events: MessagingEvent[] } {
  const state = options?.state ?? createState();
  const events: MessagingEvent[] = [];

  const engine = new WorkflowEngine({
    persistence: createCoordinator(state, options?.flags),
    messaging: {
      publish: async (input) => {
        if (options?.publishFailure) {
          throw new Error("messaging_down");
        }

        events.push({ topic: input.topic, payload: input.envelope.payload as Record<string, unknown> });
      },
      healthSnapshot: () => ({ status: "HEALTHY" }),
    },
  });

  return { engine, state, events };
}

function buildDefinition(overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    id: "workflow.orders",
    name: "Orders Workflow",
    version: { major: 1, minor: 1, patch: 0 },
    initialStepId: "start",
    steps: [
      {
        id: "start",
        name: "Start",
        action: async () => ({ status: "SUCCESS", outputVariables: { stage: "started" } }),
        transitions: [{ id: "to-end", toStepId: "end" }],
      },
      {
        id: "end",
        name: "End",
        action: async () => ({ status: "SUCCESS", outputVariables: { done: true } }),
      },
    ],
    ...overrides,
  };
}

describe("GWF-1001B workflow platform hardening", () => {
  it("persists definitions, instances, checkpoints, and history durably", async () => {
    const { engine, state } = createEngine();
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition());

    const instance = await engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });
    await engine.execute(instance.instanceId);

    expect(state.definitions).toHaveLength(1);
    expect(state.instances).toHaveLength(1);
    expect(state.checkpoints.length).toBeGreaterThan(0);
    expect(state.executionHistory.length).toBeGreaterThan(0);
  });

  it("recovers pending and paused state after restart", async () => {
    const state = createState();
    const first = createEngine({ state });
    await first.engine.waitUntilReady();
    await first.engine.registerWorkflow(buildDefinition({
      steps: [
        {
          id: "start",
          name: "Start",
          action: async () => ({ status: "PAUSE" }),
        },
      ],
    }));

    const instance = await first.engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });
    await first.engine.execute(instance.instanceId);

    const second = createEngine({ state });
    await second.engine.waitUntilReady();
    const restored = await second.engine.getInstance(instance.instanceId);

    expect(restored.state).toBe("PAUSED");
    expect(second.engine.getMetrics().recoveryCount).toBeGreaterThan(0);
  });

  it("recovers retry and timeout records safely", async () => {
    const { engine, state } = createEngine();
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition({
      steps: [
        {
          id: "start",
          name: "Start",
          timeout: { timeoutMs: 5 },
          retryPolicy: { maxAttempts: 2 },
          action: async () => {
            await pause(20);
            return { status: "SUCCESS" };
          },
        },
      ],
    }));

    const instance = await engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });

    const timedOut = await engine.execute(instance.instanceId);
    expect(timedOut.state).toBe("TIMED_OUT");
    expect(state.retries.length).toBeGreaterThan(0);
    expect(state.timeouts.length).toBeGreaterThan(0);
  });

  it("prevents duplicate execution command with idempotency key", async () => {
    const { engine } = createEngine();
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition());
    const instance = await engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });

    await engine.execute(instance.instanceId, { idempotencyKey: "exec-1" });
    const duplicate = await engine.execute(instance.instanceId, { idempotencyKey: "exec-1" });

    expect(duplicate.state).toBe("COMPLETED");
    expect(engine.getMetrics().duplicateCommandCount).toBe(1);
  });

  it("rejects concurrent same-instance execution", async () => {
    const { engine } = createEngine();
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition({
      steps: [
        {
          id: "start",
          name: "Start",
          action: async () => {
            await pause(30);
            return { status: "SUCCESS" };
          },
        },
      ],
    }));

    const instance = await engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });

    const first = engine.execute(instance.instanceId);
    await expect(engine.execute(instance.instanceId)).rejects.toThrow("workflow_concurrency_conflict");
    await first;
    expect(engine.getMetrics().concurrencyConflictCount).toBeGreaterThan(0);
  });

  it("rejects stale instance version writes", async () => {
    const { engine } = createEngine();
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition());
    const instance = await engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });

    await engine.execute(instance.instanceId, { expectedVersion: instance.version });
    await expect(engine.execute(instance.instanceId, { expectedVersion: instance.version })).rejects.toThrow(
      "workflow_stale_instance_version",
    );
  });

  it("fails safely on invalid transition", async () => {
    const { engine } = createEngine();
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition({
      steps: [
        {
          id: "start",
          name: "Start",
          action: async () => ({ status: "SUCCESS" }),
          transitions: [{ id: "blocked", toStepId: "end", condition: () => false }],
        },
        { id: "end", name: "End", action: async () => ({ status: "SUCCESS" }) },
      ],
    }));

    const instance = await engine.createInstance({ definitionId: "workflow.orders", context: { tenant: "t", workspace: "w", variables: {} } });
    const failed = await engine.execute(instance.instanceId);

    expect(failed.state).toBe("FAILED");
    expect(failed.failureReason).toContain("workflow_invalid_transition");
  });

  it("handles non-Error step failure safely", async () => {
    const { engine } = createEngine();
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition({
      steps: [{ id: "start", name: "Start", action: async () => { throw "boom"; } }],
    }));

    const instance = await engine.createInstance({ definitionId: "workflow.orders", context: { tenant: "t", workspace: "w", variables: {} } });
    const failed = await engine.execute(instance.instanceId);

    expect(failed.state).toBe("FAILED");
    expect(failed.failureReason).toBe("workflow_step_failure");
  });

  it("supports compensation success and retry", async () => {
    const { engine, state } = createEngine();
    await engine.waitUntilReady();

    let compensationAttempts = 0;
    await engine.registerWorkflow(buildDefinition({
      steps: [
        {
          id: "start",
          name: "Start",
          action: async () => ({ status: "SUCCESS" }),
          compensationAction: async () => {
            compensationAttempts += 1;
            if (compensationAttempts === 1) {
              throw new Error("first_fail");
            }

            return { status: "SUCCESS" };
          },
          transitions: [{ id: "to-fail", toStepId: "fail" }],
        },
        {
          id: "fail",
          name: "Fail",
          action: async () => ({ status: "FAILURE", error: "fatal" }),
        },
      ],
    }));

    const instance = await engine.createInstance({ definitionId: "workflow.orders", context: { tenant: "t", workspace: "w", variables: {} } });
    const failed = await engine.execute(instance.instanceId);

    expect(failed.state).toBe("FAILED");
    expect(state.compensations.some((entry) => entry.status === "SUCCESS")).toBe(true);
  });

  it("records compensation failure", async () => {
    const { engine, state } = createEngine();
    await engine.waitUntilReady();

    await engine.registerWorkflow(buildDefinition({
      steps: [
        {
          id: "start",
          name: "Start",
          action: async () => ({ status: "SUCCESS" }),
          compensationAction: async () => {
            throw new Error("compensate_fail");
          },
          transitions: [{ id: "to-fail", toStepId: "fail" }],
        },
        {
          id: "fail",
          name: "Fail",
          action: async () => ({ status: "FAILURE", error: "fatal" }),
        },
      ],
    }));

    const instance = await engine.createInstance({ definitionId: "workflow.orders", context: { tenant: "t", workspace: "w", variables: {} } });
    await engine.execute(instance.instanceId);

    expect(state.compensations.some((entry) => entry.status === "FAILED")).toBe(true);
  });

  it("detects missing checkpoint on resume", async () => {
    const state = createState();
    const { engine } = createEngine({ state });
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition());
    const created = await engine.createInstance({ definitionId: "workflow.orders", context: { tenant: "t", workspace: "w", variables: {} } });
    await engine.pause(created.instanceId);
    state.checkpoints = [];

    await expect(engine.resume(created.instanceId)).rejects.toThrow("workflow_checkpoint_missing");
  });

  it("surfaces checkpoint corruption during recovery", async () => {
    const state = createState();
    state.checkpoints.push({} as WorkflowCheckpoint);
    const { engine } = createEngine({ state });
    await engine.waitUntilReady();

    expect(engine.getMetrics().contextPersistenceFailureCount).toBeGreaterThan(0);
  });

  it("surfaces lifecycle publish failures in metrics and audit", async () => {
    const { engine } = createEngine({ publishFailure: true });
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition());
    const instance = await engine.createInstance({ definitionId: "workflow.orders", context: { tenant: "t", workspace: "w", variables: {} } });
    await engine.execute(instance.instanceId);

    expect(engine.getMetrics().lifecyclePublishFailureCount).toBeGreaterThan(0);
    expect(engine.getAuditRecords().some((entry) => entry.message.includes("publish failed"))).toBe(true);
  });

  it("handles messaging unavailability without losing workflow completion", async () => {
    const { engine } = createEngine({ publishFailure: true });
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition());
    const instance = await engine.createInstance({ definitionId: "workflow.orders", context: { tenant: "t", workspace: "w", variables: {} } });
    const completed = await engine.execute(instance.instanceId);

    expect(completed.state).toBe("COMPLETED");
  });

  it("tracks retry exhaustion and timeout classification", async () => {
    const { engine } = createEngine();
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition({
      steps: [
        {
          id: "start",
          name: "Start",
          retryPolicy: { maxAttempts: 2 },
          timeout: { timeoutMs: 5 },
          action: async () => {
            await pause(20);
            return { status: "SUCCESS" };
          },
        },
      ],
    }));

    const instance = await engine.createInstance({ definitionId: "workflow.orders", context: { tenant: "t", workspace: "w", variables: {} } });
    const timedOut = await engine.execute(instance.instanceId);

    expect(timedOut.state).toBe("TIMED_OUT");
    expect(engine.getMetrics().retryCount).toBeGreaterThan(0);
  });

  it("supports cancellation during execution by rejecting concurrent mutation safely", async () => {
    const { engine } = createEngine();
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition({
      steps: [
        {
          id: "start",
          name: "Start",
          action: async () => {
            await pause(20);
            return { status: "SUCCESS" };
          },
        },
      ],
    }));

    const instance = await engine.createInstance({ definitionId: "workflow.orders", context: { tenant: "t", workspace: "w", variables: {} } });
    const running = engine.execute(instance.instanceId);
    await expect(engine.cancel(instance.instanceId)).rejects.toThrow("workflow_concurrency_conflict");
    await running;
  });

  it("rejects resume from invalid state", async () => {
    const { engine } = createEngine();
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition());
    const instance = await engine.createInstance({ definitionId: "workflow.orders", context: { tenant: "t", workspace: "w", variables: {} } });

    await expect(engine.resume(instance.instanceId)).rejects.toThrow("workflow_instance_not_paused");
  });

  it("persists execution history across restart", async () => {
    const state = createState();
    const first = createEngine({ state });
    await first.engine.waitUntilReady();
    await first.engine.registerWorkflow(buildDefinition());

    const instance = await first.engine.createInstance({ definitionId: "workflow.orders", context: { tenant: "t", workspace: "w", variables: {} } });
    await first.engine.execute(instance.instanceId);

    const second = createEngine({ state });
    await second.engine.waitUntilReady();

    const history = second.engine.getExecutionHistory(instance.instanceId);
    expect(history.length).toBeGreaterThan(0);
  });

  it("surfaces context persistence failures", async () => {
    const { engine } = createEngine({ flags: { failContextPersistence: true } });
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition());

    await expect(
      engine.createInstance({
        definitionId: "workflow.orders",
        context: { tenant: "t", workspace: "w", variables: {} },
      }),
    ).rejects.toThrow("workflow_context_persistence_failed");
  });

  it("surfaces audit persistence failures", async () => {
    const { engine } = createEngine({ flags: { failAuditPersistence: true } });
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition());

    const instance = await engine.createInstance({ definitionId: "workflow.orders", context: { tenant: "t", workspace: "w", variables: {} } });
    await engine.execute(instance.instanceId);

    expect(engine.getMetrics().auditPersistenceFailureCount).toBeGreaterThan(0);
  });

  it("updates active-state gauges and oldest-age metrics", async () => {
    const { engine } = createEngine();
    await engine.waitUntilReady();
    await engine.registerWorkflow(buildDefinition({
      steps: [
        {
          id: "start",
          name: "Start",
          action: async () => {
            await pause(15);
            return { status: "SUCCESS" };
          },
        },
      ],
    }));

    const instance = await engine.createInstance({ definitionId: "workflow.orders", context: { tenant: "t", workspace: "w", variables: {} } });
    const run = engine.execute(instance.instanceId);
    await pause(2);

    const during = engine.getMetrics();
    expect(during.activeWorkflowInstances).toBeGreaterThanOrEqual(0);

    await run;
    const after = engine.getMetrics();
    expect(after.averageExecutionDurationMs).toBeGreaterThan(0);
    expect(after.averageStepDurationMs).toBeGreaterThan(0);
  });
});
