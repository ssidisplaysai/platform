import { describe, expect, it, jest } from "@jest/globals";
import type { WorkflowDefinition } from "@/platform/workflow";
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

type CapturedEvent = { topic: string; payload: Record<string, unknown> };

function createEngine(): { engine: WorkflowEngine; events: CapturedEvent[] } {
  const events: CapturedEvent[] = [];
  const engine = new WorkflowEngine({
    messaging: {
      publish: async (input) => {
        events.push({ topic: input.topic, payload: input.envelope.payload as Record<string, unknown> });
      },
      healthSnapshot: () => ({ status: "HEALTHY" }),
    },
  });

  return { engine, events };
}

function buildDefinition(overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    id: "workflow.orders",
    name: "Orders Workflow",
    version: { major: 1, minor: 0, patch: 0 },
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

describe("GWF-1001 workflow platform foundation", () => {
  it("registers workflow definitions", () => {
    const { engine } = createEngine();
    engine.registerWorkflow(buildDefinition());

    expect(engine.getMetrics().registeredWorkflows).toBe(1);
  });

  it("creates workflow instances", () => {
    const { engine } = createEngine();
    engine.registerWorkflow(buildDefinition());

    const instance = engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", initiatedBy: "actor-1", variables: { orderId: "A1" } },
    });

    expect(instance.state).toBe("CREATED");
    expect(instance.currentStepId).toBe("start");
  });

  it("executes workflow through step transitions", async () => {
    const { engine } = createEngine();
    engine.registerWorkflow(buildDefinition());
    const instance = engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });

    const finished = await engine.execute(instance.instanceId);

    expect(finished.state).toBe("COMPLETED");
    expect(finished.context.variables.done).toBe(true);
    expect(finished.executedStepIds).toEqual(["start", "end"]);
  });

  it("pauses a running workflow", () => {
    const { engine } = createEngine();
    engine.registerWorkflow(buildDefinition());
    const instance = engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });

    const paused = engine.pause(instance.instanceId, "manual");
    expect(paused.state).toBe("PAUSED");
  });

  it("resumes a paused workflow", async () => {
    const { engine } = createEngine();
    engine.registerWorkflow(buildDefinition());
    const instance = engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });
    engine.pause(instance.instanceId, "operator");

    const resumed = await engine.resume(instance.instanceId);
    expect(resumed.state).toBe("COMPLETED");
  });

  it("cancels workflow execution", () => {
    const { engine } = createEngine();
    engine.registerWorkflow(buildDefinition());
    const instance = engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });

    const cancelled = engine.cancel(instance.instanceId, "request_withdrawn");
    expect(cancelled.state).toBe("CANCELLED");
  });

  it("handles step failures", async () => {
    const { engine } = createEngine();
    engine.registerWorkflow(buildDefinition({
      steps: [
        {
          id: "start",
          name: "Start",
          action: async () => ({ status: "FAILURE", error: "boom" }),
        },
      ],
    }));

    const instance = engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });

    const failed = await engine.execute(instance.instanceId);
    expect(failed.state).toBe("FAILED");
    expect(failed.failureReason).toContain("boom");
  });

  it("runs compensation on failure after progress", async () => {
    const { engine } = createEngine();
    let compensated = false;

    engine.registerWorkflow(buildDefinition({
      steps: [
        {
          id: "start",
          name: "Start",
          action: async () => ({ status: "SUCCESS" }),
          compensationAction: async () => {
            compensated = true;
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

    const instance = engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });

    const failed = await engine.execute(instance.instanceId);
    expect(failed.state).toBe("FAILED");
    expect(compensated).toBe(true);
  });

  it("retries failing steps within policy", async () => {
    const { engine } = createEngine();
    let attempts = 0;

    engine.registerWorkflow(buildDefinition({
      steps: [
        {
          id: "start",
          name: "Start",
          retryPolicy: { maxAttempts: 3 },
          action: async () => {
            attempts += 1;
            if (attempts < 3) {
              return { status: "FAILURE", error: "transient" };
            }

            return { status: "SUCCESS", outputVariables: { recovered: true } };
          },
        },
      ],
    }));

    const instance = engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });

    const completed = await engine.execute(instance.instanceId);
    expect(completed.state).toBe("COMPLETED");
    expect(completed.context.variables.recovered).toBe(true);
    expect(engine.getMetrics().retriedSteps).toBe(2);
  });

  it("propagates context variables between steps", async () => {
    const { engine } = createEngine();

    engine.registerWorkflow(buildDefinition({
      steps: [
        {
          id: "start",
          name: "Start",
          action: async () => ({ status: "SUCCESS", outputVariables: { subtotal: 95, tax: 5 } }),
          transitions: [{ id: "to-compute", toStepId: "compute" }],
        },
        {
          id: "compute",
          name: "Compute",
          action: async ({ context }) => ({
            status: "SUCCESS",
            outputVariables: { total: Number(context.variables.subtotal) + Number(context.variables.tax) },
          }),
        },
      ],
    }));

    const instance = engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });

    const completed = await engine.execute(instance.instanceId);
    expect(completed.context.variables.total).toBe(100);
  });

  it("resolves variable templates before action execution", async () => {
    const { engine } = createEngine();

    engine.registerWorkflow(buildDefinition({
      steps: [
        {
          id: "start",
          name: "Start",
          action: async ({ context }) => ({
            status: "SUCCESS",
            outputVariables: { rendered: context.variables.template },
          }),
        },
      ],
    }));

    const instance = engine.createInstance({
      definitionId: "workflow.orders",
      context: {
        tenant: "tenant-1",
        workspace: "ws-1",
        variables: { actor: "Alyx", template: "Hello {{actor}}" },
      },
    });

    const completed = await engine.execute(instance.instanceId);
    expect(completed.context.variables.rendered).toBe("Hello Alyx");
  });

  it("publishes workflow metrics and health", async () => {
    const { engine } = createEngine();
    engine.registerWorkflow(buildDefinition());
    const instance = engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });
    await engine.execute(instance.instanceId);

    const metrics = engine.getMetrics();
    const health = await engine.healthSnapshot();

    expect(metrics.createdInstances).toBe(1);
    expect(metrics.completedInstances).toBe(1);
    expect(health.status).toBe("HEALTHY");
  });

  it("records workflow audit and execution history", async () => {
    const { engine } = createEngine();
    engine.registerWorkflow(buildDefinition());
    const instance = engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });
    await engine.execute(instance.instanceId);

    const audit = engine.getAuditRecords();
    const history = engine.getExecutionHistory(instance.instanceId);

    expect(audit.length).toBeGreaterThan(0);
    expect(history).toHaveLength(2);
    expect(history[0].stepId).toBe("start");
  });

  it("publishes lifecycle events through messaging without transport ownership", async () => {
    const { engine, events } = createEngine();
    engine.registerWorkflow(buildDefinition());
    const instance = engine.createInstance({
      definitionId: "workflow.orders",
      context: { tenant: "tenant-1", workspace: "ws-1", variables: {} },
    });
    await engine.execute(instance.instanceId);

    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.topic === "workflow.lifecycle")).toBe(true);
  });
});
