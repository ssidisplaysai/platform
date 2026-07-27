import { describe, expect, it } from "@jest/globals";
import { createInMemoryToolFrameworkRepository } from "@/lib/gea/tool-repository";
import { createToolRegistryService } from "@/lib/gea/tool-registry-service";
import { createExecutionCoordinator } from "@/lib/gea/tool-execution-engine";
import { createToolAuthorizationEngine } from "@/lib/gea/tool-authorization";

async function setup() {
  const repository = createInMemoryToolFrameworkRepository();
  const registry = createToolRegistryService(repository);
  const execution = createExecutionCoordinator({
    repository,
    registry,
    authorizationEngine: createToolAuthorizationEngine(),
  });

  const tool = await registry.registerTool({
    workspaceId: "glw-led-display-warehouse",
    organizationId: "genesis",
    toolKey: "genesis.execution.tool",
    name: "Execution Tool",
    description: "Execution test tool",
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
    retryLimit: 1,
    replaySupported: true,
    deterministic: true,
    compatibilityPolicy: "STRICT",
    versionTag: "v1",
    actorId: "admin@example.com",
  });

  return { repository, registry, execution, tool };
}

describe("gea tool execution", () => {
  it("executes and records immutable lineage and health", async () => {
    const { execution, tool } = await setup();

    const result = await execution.executeTool({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      actorId: "admin@example.com",
      role: "ADMINISTRATOR",
      agentId: "agent-1",
      agentVersion: "v1",
      toolIdentifier: tool.definition.toolKey,
      input: { payload: "ok" },
      runtimeState: "RUNNING",
      capabilityPermissions: ["capability:workflow"],
      permissionActions: ["gea:tools:execute"],
    });

    expect(result.state).toBe("COMPLETED");
    expect(result.immutableLineage.length).toBeGreaterThan(10);

    const health = await execution.listHealth();
    expect(health.length).toBeGreaterThan(0);
  });

  it("defaults to deny when authorization requirements are missing", async () => {
    const { execution, tool } = await setup();

    const result = await execution.executeTool({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      actorId: "admin@example.com",
      role: "ADMINISTRATOR",
      agentId: "agent-1",
      agentVersion: "v1",
      toolIdentifier: tool.definition.toolKey,
      input: { payload: "ok" },
      runtimeState: "RUNNING",
      capabilityPermissions: [],
      permissionActions: [],
    });

    expect(result.state).toBe("FAILED");
    expect(result.error).toContain("Default deny");
  });

  it("replays deterministic executions and records replay context", async () => {
    const { execution, tool } = await setup();

    const run = await execution.executeTool({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      actorId: "admin@example.com",
      role: "ADMINISTRATOR",
      agentId: "agent-1",
      agentVersion: "v1",
      toolIdentifier: tool.definition.toolKey,
      input: { payload: "ok" },
      runtimeState: "RUNNING",
      capabilityPermissions: ["capability:workflow"],
      permissionActions: ["gea:tools:execute"],
    });

    const replay = await execution.replayExecution(run.executionId, "admin@example.com", "v1");
    expect(replay.deterministicSupported).toBe(true);
    expect(replay.deterministicMatch).toBe(true);
  });

  it("enforces workspace isolation on execution", async () => {
    const { execution, tool } = await setup();

    await expect(execution.executeTool({
      workspaceId: "different-workspace",
      organizationId: "genesis",
      actorId: "admin@example.com",
      role: "ADMINISTRATOR",
      agentId: "agent-1",
      agentVersion: "v1",
      toolIdentifier: tool.definition.toolKey,
      input: { payload: "ok" },
      runtimeState: "RUNNING",
      capabilityPermissions: ["capability:workflow"],
      permissionActions: ["gea:tools:execute"],
    })).rejects.toThrow("Workspace isolation violation");
  });
});
