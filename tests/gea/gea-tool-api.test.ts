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
  createInMemoryToolApiDependencies,
  handleListTools,
  handleToolCatalog,
  handleToolCategories,
  handleToolExecutionDetail,
  handleToolExecutions,
  handleToolExecute,
  handleToolHealth,
  handleToolReplay,
} from "@/lib/gea/tool-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const noSessionLoader = async () => null;

describe("gea tool api", () => {
  it("enforces authentication", async () => {
    const deps = createInMemoryToolApiDependencies();
    const response = await handleListTools(makeRequest("/api/gea/tools"), {
      ...deps,
      sessionLoader: noSessionLoader,
    });

    expect(response.status).toBe(401);
  });

  it("registers tools and returns catalog/categories", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryToolApiDependencies();

    const register = await handleListTools(makeRequest("/api/gea/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolKey: "genesis.api.tool",
        name: "API Tool",
        description: "Tool from API test",
        category: "UTILITY",
        owner: "platform@genesis.local",
        executionMode: "SYNCHRONOUS",
        capabilityRequirements: ["workflow"],
        permissionRequirements: ["gea:tools:execute"],
        inputSchema: { type: "object", required: ["payload"] },
        outputSchema: { type: "object" },
        validationRules: ["payload required"],
        errorTypes: ["VALIDATION_ERROR"],
        timeoutMs: 1000,
        retryLimit: 0,
        replaySupported: true,
        deterministic: true,
        compatibilityPolicy: "STRICT",
        versionTag: "v1",
      }),
    }), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(register.status).toBe(201);

    const list = await handleListTools(makeRequest("/api/gea/tools"), { ...deps, sessionLoader: adminSessionLoader });
    expect(list.status).toBe(200);

    const catalog = await handleToolCatalog(makeRequest("/api/gea/tools/catalog"), { ...deps, sessionLoader: adminSessionLoader });
    expect(catalog.status).toBe(200);

    const categories = await handleToolCategories(makeRequest("/api/gea/tools/categories"), { ...deps, sessionLoader: adminSessionLoader });
    expect(categories.status).toBe(200);
  });

  it("executes and replays through tool runtime endpoints", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryToolApiDependencies();
    const depSet = { ...deps, sessionLoader: adminSessionLoader };

    await handleListTools(makeRequest("/api/gea/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolKey: "genesis.execute.api.tool",
        name: "Exec API Tool",
        description: "Exec API Tool",
        category: "WORKFLOW",
        owner: "platform@genesis.local",
        executionMode: "SYNCHRONOUS",
        capabilityRequirements: ["workflow"],
        permissionRequirements: ["gea:tools:execute"],
        inputSchema: { type: "object", required: ["payload"] },
        outputSchema: { type: "object" },
        validationRules: ["payload required"],
        errorTypes: ["VALIDATION_ERROR"],
        timeoutMs: 1000,
        retryLimit: 0,
        replaySupported: true,
        deterministic: true,
        compatibilityPolicy: "STRICT",
        versionTag: "v1",
      }),
    }), depSet);

    const execute = await handleToolExecute(makeRequest("/api/gea/tools/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolIdentifier: "genesis.execute.api.tool",
        agentId: "agent-1",
        capabilityPermissions: ["capability:workflow"],
        input: { payload: "ok" },
      }),
    }), depSet);
    expect(execute.status).toBe(201);

    const executionPayload = await execute.json() as { execution: { executionId: string } };

    const listExecutions = await handleToolExecutions(makeRequest("/api/gea/tools/executions"), depSet);
    expect(listExecutions.status).toBe(200);

    const detail = await handleToolExecutionDetail(
      makeRequest(`/api/gea/tools/executions/${executionPayload.execution.executionId}`),
      executionPayload.execution.executionId,
      depSet,
    );
    expect(detail.status).toBe(200);

    const replay = await handleToolReplay(makeRequest("/api/gea/tools/replay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executionId: executionPayload.execution.executionId }),
    }), depSet);
    expect(replay.status).toBe(201);

    const health = await handleToolHealth(makeRequest("/api/gea/tools/health"), depSet);
    expect(health.status).toBe(200);
  });
});
