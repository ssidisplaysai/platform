import { describe, expect, it } from "@jest/globals";
import { createInMemoryCapabilityRegistry } from "@/lib/gea/capability-registry";
import { createSeedAgent, createInMemoryGeaRepository } from "@/lib/gea/agent-repository";
import { createAgentRuntimeService } from "@/lib/gea/agent-runtime";
import type { AgentRuntimeService } from "@/lib/gea/agent-runtime";
import { geaId, nowIso } from "@/lib/gea/agent-models";
import { createInMemoryToolRegistry } from "@/lib/gea/tool-framework";
import { createInMemoryOrchestrationRepository } from "@/lib/gea/orchestration-repository";
import { createOrchestrationRuntimeService } from "@/lib/gea/orchestration-runtime";
import type { WorkflowStep } from "@/lib/gea/orchestration-models";

function makeStep(input: {
  stepKey: string;
  order: number;
  stepType?: WorkflowStep["stepType"];
  requiresApproval?: boolean;
  highRisk?: boolean;
  maxRetries?: number;
}) {
  const stepId = geaId("step");
  return {
    stepId,
    stepKey: input.stepKey,
    title: input.stepKey,
    stepType: input.stepType ?? "SEQUENTIAL",
    order: input.order,
    requiresApproval: input.requiresApproval ?? false,
    highRisk: input.highRisk ?? false,
    assignment: {
      assignmentId: geaId("assign"),
      stepId,
      agentId: "agent-1",
      agentVersion: "v1",
      requiredCapabilities: ["workflow"],
    },
    retryPolicy: {
      maxRetries: input.maxRetries ?? 1,
      backoffMs: 1,
      strategy: "FIXED" as const,
      retryOnStates: ["FAILED" as const],
    },
    compensation: {
      reversible: false,
      actionType: "NONE" as const,
    },
    input: {},
  } satisfies WorkflowStep;
}

async function setup() {
  const geaRepository = createInMemoryGeaRepository();
  const capabilityRegistry = createInMemoryCapabilityRegistry();
  const toolRegistry = createInMemoryToolRegistry();
  const seedAgent = createSeedAgent({
    agentId: "agent-1",
    workspaceId: "glw-led-display-warehouse",
    organizationId: "genesis",
    name: "Agent 1",
    identity: { workspaceId: "glw-led-display-warehouse", organizationId: "genesis", actorId: "system", role: "SYSTEM" },
    capabilities: [{ capabilityId: geaId("cap"), capabilityKey: "workflow", capabilityVersion: "gea-capability/v1", enabled: true }],
    permissions: ["gea:agents:execute", "gea:tools:execute"],
    currentVersion: {
      agentVersionId: geaId("ver"),
      agentId: "agent-1",
      versionTag: "v1",
      planVersion: "gea-plan/v1",
      contextVersion: "gea-context/v1",
      toolsetVersion: "gea-tool/v1",
      createdAt: nowIso(),
    },
  });
  await geaRepository.upsertAgent(seedAgent);

  const agentRuntime = createAgentRuntimeService({ repository: geaRepository, capabilityRegistry, toolRegistry });
  const orchestrationRepository = createInMemoryOrchestrationRepository();
  const runtime = createOrchestrationRuntimeService({ repository: orchestrationRepository, agentRuntime });

  return { runtime, orchestrationRepository, agentRuntime };
}

describe("gea orchestration runtime", () => {
  it("executes sequential and parallel workflows deterministically", async () => {
    const { runtime } = await setup();

    const steps = [
      makeStep({ stepKey: "collect", order: 1 }),
      makeStep({ stepKey: "fanout-a", order: 2, stepType: "PARALLEL" }),
      makeStep({ stepKey: "fanout-b", order: 3, stepType: "PARALLEL" }),
      makeStep({ stepKey: "join", order: 4, stepType: "FAN_IN" }),
    ];

    const compiled = await runtime.workflowCompiler.compile({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      orchestrationName: "Deterministic Orchestration",
      orchestrationDescription: "orchestration",
      workflowKey: "deterministic.workflow",
      workflowName: "deterministic.workflow",
      workflowDescription: "workflow",
      steps,
      dependencies: [
        { dependencyId: geaId("dep"), stepId: steps[1].stepId, dependsOnStepId: steps[0].stepId, dependencyType: "HARD" },
        { dependencyId: geaId("dep"), stepId: steps[2].stepId, dependsOnStepId: steps[0].stepId, dependencyType: "HARD" },
        { dependencyId: geaId("dep"), stepId: steps[3].stepId, dependsOnStepId: steps[1].stepId, dependencyType: "BARRIER" },
        { dependencyId: geaId("dep"), stepId: steps[3].stepId, dependsOnStepId: steps[2].stepId, dependencyType: "BARRIER" },
      ],
      actorId: "admin@example.com",
    });

    const execution = await runtime.executionManager.start({
      orchestrationId: compiled.orchestration.orchestrationId,
      workflowId: compiled.workflow.workflowId,
      actorId: "admin@example.com",
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
    });

    expect(execution.state).toBe("COMPLETED");

    const replay1 = await runtime.executionManager.replay(execution.executionId);
    const replay2 = await runtime.executionManager.replay(execution.executionId);
    expect(replay1.replayChecksum).toBe(replay2.replayChecksum);
  });

  it("detects dependency cycles and fails execution", async () => {
    const { runtime } = await setup();

    const a = makeStep({ stepKey: "a", order: 1 });
    const b = makeStep({ stepKey: "b", order: 2 });

    const compiled = await runtime.workflowCompiler.compile({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      orchestrationName: "Cycle Orchestration",
      orchestrationDescription: "cycle",
      workflowKey: "cycle.workflow",
      workflowName: "cycle.workflow",
      workflowDescription: "workflow",
      steps: [a, b],
      dependencies: [
        { dependencyId: geaId("dep"), stepId: a.stepId, dependsOnStepId: b.stepId, dependencyType: "HARD" },
        { dependencyId: geaId("dep"), stepId: b.stepId, dependsOnStepId: a.stepId, dependencyType: "HARD" },
      ],
      actorId: "admin@example.com",
    });

    const execution = await runtime.executionManager.start({
      orchestrationId: compiled.orchestration.orchestrationId,
      workflowId: compiled.workflow.workflowId,
      actorId: "admin@example.com",
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
    });

    expect(execution.state).toBe("FAILED");
    expect(execution.timeline.some((entry) => entry.note.includes("Dependency cycle"))).toBe(true);
  });

  it("creates approval checkpoint for high risk stage", async () => {
    const { runtime } = await setup();

    const compiled = await runtime.workflowCompiler.compile({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      orchestrationName: "Approval Orchestration",
      orchestrationDescription: "approval",
      workflowKey: "approval.workflow",
      workflowName: "approval.workflow",
      workflowDescription: "workflow",
      steps: [makeStep({ stepKey: "risk", order: 1, highRisk: true })],
      actorId: "admin@example.com",
    });

    const execution = await runtime.executionManager.start({
      orchestrationId: compiled.orchestration.orchestrationId,
      workflowId: compiled.workflow.workflowId,
      actorId: "admin@example.com",
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
    });

    expect(execution.state).toBe("WAITING_APPROVAL");
    const approvals = await runtime.listApprovals("glw-led-display-warehouse", execution.executionId);
    expect(approvals.length).toBeGreaterThan(0);
  });

  it("supports delayed scheduling and partial deterministic replay for event-driven workflows", async () => {
    const { runtime } = await setup();

    const compiled = await runtime.workflowCompiler.compile({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      orchestrationName: "Scheduled Orchestration",
      orchestrationDescription: "scheduled",
      workflowKey: "scheduled.workflow",
      workflowName: "scheduled.workflow",
      workflowDescription: "workflow",
      steps: [makeStep({ stepKey: "step", order: 1 })],
      scheduling: {
        mode: "EVENT_DRIVEN",
        delayMs: 1500,
        eventKey: "artifact.created",
      },
      actorId: "admin@example.com",
    });

    const execution = await runtime.executionManager.start({
      orchestrationId: compiled.orchestration.orchestrationId,
      workflowId: compiled.workflow.workflowId,
      actorId: "admin@example.com",
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
    });

    const replay = await runtime.executionManager.replay(execution.executionId);
    expect(replay.determinism).toBe("PARTIAL");
  });

  it("enforces workspace isolation and supports recovery", async () => {
    const { runtime, agentRuntime } = await setup();

    const failingAgentRuntime = agentRuntime as AgentRuntimeService & {
      listAgents: () => Promise<never>;
    };

    failingAgentRuntime.listAgents = async () => {
      throw new Error("agent unavailable");
    };

    const compiled = await runtime.workflowCompiler.compile({
      workspaceId: "workspace-a",
      organizationId: "genesis",
      orchestrationName: "Recovery Orchestration",
      orchestrationDescription: "recovery",
      workflowKey: "recovery.workflow",
      workflowName: "recovery.workflow",
      workflowDescription: "workflow",
      steps: [makeStep({ stepKey: "fail", order: 1, maxRetries: 0 })],
      actorId: "admin@example.com",
    });

    await expect(runtime.executionManager.start({
      orchestrationId: compiled.orchestration.orchestrationId,
      workflowId: compiled.workflow.workflowId,
      actorId: "admin@example.com",
      workspaceId: "workspace-b",
      organizationId: "genesis",
    })).rejects.toThrow("Workspace isolation violation");

    const failedExecution = await runtime.executionManager.start({
      orchestrationId: compiled.orchestration.orchestrationId,
      workflowId: compiled.workflow.workflowId,
      actorId: "admin@example.com",
      workspaceId: "workspace-a",
      organizationId: "genesis",
    });

    expect(failedExecution.state).toBe("FAILED");
    expect(failedExecution.compensationActions.length).toBeGreaterThan(0);

    const recovered = await runtime.executionManager.recover(failedExecution.executionId, "admin@example.com");
    expect(recovered.state).toBe("RECOVERING");
  });
});
