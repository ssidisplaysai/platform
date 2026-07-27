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
  createInMemoryOrchestrationApiDependencies,
  handleCancelOrchestration,
  handleOrchestrationApprovals,
  handleOrchestrationHealth,
  handleOrchestrationTimeline,
  handleOrchestrations,
  handlePauseOrchestration,
  handleReplayOrchestration,
  handleResumeOrchestration,
  handleStartOrchestration,
  handleWorkflows,
} from "@/lib/gea/orchestration-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const noSessionLoader = async () => null;

describe("gea orchestration api", () => {
  it("enforces authentication", async () => {
    const deps = createInMemoryOrchestrationApiDependencies();
    const response = await handleOrchestrations(makeRequest("/api/gea/orchestrations"), {
      ...deps,
      sessionLoader: noSessionLoader,
    });

    expect(response.status).toBe(401);
  });

  it("starts, controls, replays, and reports orchestrations", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryOrchestrationApiDependencies();
    const depSet = { ...deps, sessionLoader: adminSessionLoader };

    const start = await handleStartOrchestration(makeRequest("/api/gea/orchestrations/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowKey: "api.orch.workflow",
        steps: [
          { stepKey: "s1", title: "S1", agentId: "agent-1", order: 1, requiredCapabilities: ["workflow"] },
          { stepKey: "s2", title: "S2", agentId: "agent-1", order: 2, requiredCapabilities: ["workflow"] },
        ],
      }),
    }), depSet);

    expect(start.status).toBe(201);
    const startBody = await start.json() as { execution: { executionId: string } };

    const list = await handleOrchestrations(makeRequest("/api/gea/orchestrations"), depSet);
    const workflows = await handleWorkflows(makeRequest("/api/gea/workflows"), depSet);
    expect(list.status).toBe(200);
    expect(workflows.status).toBe(200);

    const pause = await handlePauseOrchestration(makeRequest("/api/gea/orchestrations/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executionId: startBody.execution.executionId }),
    }), depSet);
    expect(pause.status).toBe(201);

    const resume = await handleResumeOrchestration(makeRequest("/api/gea/orchestrations/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executionId: startBody.execution.executionId }),
    }), depSet);
    expect(resume.status).toBe(201);

    const replay = await handleReplayOrchestration(makeRequest("/api/gea/orchestrations/replay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executionId: startBody.execution.executionId }),
    }), depSet);
    expect(replay.status).toBe(201);

    const timeline = await handleOrchestrationTimeline(makeRequest("/api/gea/orchestrations/timeline"), depSet);
    const approvals = await handleOrchestrationApprovals(makeRequest("/api/gea/orchestrations/approvals"), depSet);
    const health = await handleOrchestrationHealth(makeRequest("/api/gea/orchestrations/health"), depSet);

    expect(timeline.status).toBe(200);
    expect(approvals.status).toBe(200);
    expect(health.status).toBe(200);

    const cancel = await handleCancelOrchestration(makeRequest("/api/gea/orchestrations/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executionId: startBody.execution.executionId }),
    }), depSet);
    expect(cancel.status).toBe(201);
  });
});
