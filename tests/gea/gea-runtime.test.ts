import { describe, expect, it } from "@jest/globals";
import { createInMemoryGeaRepository, createSeedAgent } from "@/lib/gea/agent-repository";
import { createInMemoryCapabilityRegistry } from "@/lib/gea/capability-registry";
import { createInMemoryToolRegistry } from "@/lib/gea/tool-framework";
import { createAgentRuntimeService } from "@/lib/gea/agent-runtime";
import { geaId } from "@/lib/gea/agent-models";

function setup() {
  const repository = createInMemoryGeaRepository();
  const capabilityRegistry = createInMemoryCapabilityRegistry();
  const toolRegistry = createInMemoryToolRegistry();
  const runtime = createAgentRuntimeService({ repository, capabilityRegistry, toolRegistry });

  const agent = createSeedAgent({
    agentId: geaId("geaagent"),
    capabilities: [
      { capabilityId: geaId("cap"), capabilityKey: "analytics", capabilityVersion: "gea-capability/v1", enabled: true },
      { capabilityId: geaId("cap"), capabilityKey: "workflow", capabilityVersion: "gea-capability/v1", enabled: true },
    ],
  });

  return { runtime, agent };
}

describe("gea runtime", () => {
  it("generates deterministic plans and executes with audit trail", async () => {
    const { runtime, agent } = setup();

    await runtime.registerAgent(agent);
    const plan = await runtime.createPlan({
      agentId: agent.agentId,
      workspaceId: agent.workspaceId,
      objective: "Compile governance report",
      actorId: "admin@example.com",
      references: [
        {
          memoryReferenceId: geaId("mem"),
          referenceType: "BUSINESS_GENOME",
          referenceId: "bg-node-1",
          referenceVersion: "v1",
        },
      ],
    });

    const execution = await runtime.executePlan({
      agentId: agent.agentId,
      workspaceId: agent.workspaceId,
      planId: plan.planId,
      actorId: "admin@example.com",
      role: "ADMINISTRATOR",
      allowedActions: ["capability:analytics", "capability:workflow", "tool:genesis.workflow.dispatch"],
    });

    expect(execution.state === "COMPLETED" || execution.state === "WAITING_APPROVAL").toBe(true);

    const replay = await runtime.replayExecution(execution.executionId, "admin@example.com");
    expect(replay.deterministicMatch).toBe(true);

    const audits = await runtime.listAudits(execution.executionId);
    expect(audits.length).toBeGreaterThan(0);
  });

  it("supports pause and cancel controls", async () => {
    const { runtime, agent } = setup();
    await runtime.registerAgent(agent);

    const plan = await runtime.createPlan({
      agentId: agent.agentId,
      workspaceId: agent.workspaceId,
      objective: "Run controlled execution",
      actorId: "admin@example.com",
      references: [],
    });

    const execution = await runtime.executePlan({
      agentId: agent.agentId,
      workspaceId: agent.workspaceId,
      planId: plan.planId,
      actorId: "admin@example.com",
      role: "ADMINISTRATOR",
      allowedActions: ["capability:analytics", "capability:workflow", "tool:genesis.workflow.dispatch"],
    });

    const paused = await runtime.pauseExecution(execution.executionId, "admin@example.com");
    expect(paused.state).toBe("PAUSED");

    const cancelled = await runtime.cancelExecution(execution.executionId, "admin@example.com");
    expect(cancelled.state).toBe("CANCELLED");
  });
});
