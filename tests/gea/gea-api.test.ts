import { describe, expect, it, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "mocked.session.token" }),
    set: () => undefined,
    delete: () => undefined,
  }),
}), { virtual: true });

import {
  handleCapabilities,
  handleContextPreview,
  handleCreateAgent,
  handleCreateExecution,
  handleCreatePlan,
  handleExecutionTimeline,
  handleHealth,
  handleListAgents,
  handleListExecutions,
  handleReplayExecution,
} from "@/lib/gea/agent-api";
import { createInMemoryGeaRepository } from "@/lib/gea/agent-repository";
import { createInMemoryCapabilityRegistry } from "@/lib/gea/capability-registry";
import { createInMemoryToolRegistry } from "@/lib/gea/tool-framework";
import { createAgentRuntimeService } from "@/lib/gea/agent-runtime";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const missingSessionLoader = async () => null;

function buildDeps() {
  const repository = createInMemoryGeaRepository();
  const capabilityRegistry = createInMemoryCapabilityRegistry();
  const toolRegistry = createInMemoryToolRegistry();
  const runtimeService = createAgentRuntimeService({ repository, capabilityRegistry, toolRegistry });

  return {
    sessionLoader: adminSessionLoader,
    repository,
    capabilityRegistry,
    toolRegistry,
    runtimeService,
  };
}

describe("gea api", () => {
  it("enforces authentication", async () => {
    const deps = buildDeps();

    const response = await handleListAgents(makeRequest("/api/gea/agents"), {
      ...deps,
      sessionLoader: missingSessionLoader,
    });

    expect(response.status).toBe(401);
  });

  it("creates agent, plan, execution, replay, and health responses", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = buildDeps();

    const createAgent = await handleCreateAgent(makeRequest("/api/gea/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Marketing Agent",
        capabilities: ["analytics", "workflow"],
      }),
    }), deps);

    expect(createAgent.status).toBe(201);
    const createdAgent = await createAgent.json() as { agent: { agentId: string } };

    const createPlan = await handleCreatePlan(makeRequest("/api/gea/planning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: createdAgent.agent.agentId,
        objective: "Prepare agent evidence summary",
      }),
    }), deps);

    expect(createPlan.status).toBe(201);
    const createdPlan = await createPlan.json() as { plan: { planId: string } };

    const execution = await handleCreateExecution(makeRequest("/api/gea/executions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: createdAgent.agent.agentId,
        planId: createdPlan.plan.planId,
      }),
    }), deps);

    expect(execution.status).toBe(201);
    const executionPayload = await execution.json() as { execution: { executionId: string } };

    const replay = await handleReplayExecution(makeRequest("/api/gea/replay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executionId: executionPayload.execution.executionId }),
    }), deps);

    expect(replay.status).toBe(201);

    const listExecutions = await handleListExecutions(makeRequest("/api/gea/executions"), deps);
    expect(listExecutions.status).toBe(200);

    const timeline = await handleExecutionTimeline(
      makeRequest(`/api/gea/executions/${executionPayload.execution.executionId}/timeline`),
      executionPayload.execution.executionId,
      deps,
    );
    expect(timeline.status).toBe(200);

    const capabilities = await handleCapabilities(makeRequest("/api/gea/capabilities"), deps);
    expect(capabilities.status).toBe(200);

    const contextPreview = await handleContextPreview(makeRequest("/api/gea/context/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: createdAgent.agent.agentId,
        references: [{ referenceType: "BUSINESS_GENOME", referenceId: "bg-1", referenceVersion: "v1" }],
      }),
    }), deps);
    expect(contextPreview.status).toBe(200);

    const health = await handleHealth(makeRequest("/api/gea/health"), deps);
    expect(health.status).toBe(200);
  });
});
