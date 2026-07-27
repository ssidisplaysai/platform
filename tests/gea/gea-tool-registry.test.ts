import { describe, expect, it } from "@jest/globals";
import { createInMemoryToolFrameworkRepository } from "@/lib/gea/tool-repository";
import { createToolRegistryService } from "@/lib/gea/tool-registry-service";

describe("gea tool registry", () => {
  it("registers, discovers, and versions tools with immutable contracts", async () => {
    const repository = createInMemoryToolFrameworkRepository();
    const registry = createToolRegistryService(repository);

    const created = await registry.registerTool({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      toolKey: "genesis.test.tool",
      name: "Test Tool",
      description: "A deterministic test tool",
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
      retryLimit: 1,
      replaySupported: true,
      deterministic: true,
      compatibilityPolicy: "STRICT",
      versionTag: "v1",
      actorId: "admin@example.com",
    });

    expect(created.definition.toolKey).toBe("genesis.test.tool");

    const catalog = await registry.discoverTools("glw-led-display-warehouse", "test");
    expect(catalog.length).toBe(1);

    const versioned = await registry.publishVersion(created.definition.toolId, {
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      toolKey: created.definition.toolKey,
      name: created.definition.name,
      description: created.definition.description,
      category: created.definition.category,
      owner: created.definition.manifest.owner,
      executionMode: created.definition.manifest.executionMode,
      capabilityRequirements: created.definition.manifest.capabilityRequirements,
      permissionRequirements: created.definition.manifest.permissionRequirements,
      inputSchema: { type: "object", required: ["payload"] },
      outputSchema: { type: "object" },
      validationRules: ["payload required"],
      errorTypes: ["VALIDATION_ERROR"],
      timeoutMs: 1000,
      retryLimit: 1,
      replaySupported: true,
      deterministic: true,
      compatibilityPolicy: "STRICT",
      versionTag: "v2",
      actorId: "admin@example.com",
    });

    expect(versioned.activeVersionTag).toBe("v2");
  });

  it("enforces workspace isolation for listed tools", async () => {
    const repository = createInMemoryToolFrameworkRepository();
    const registry = createToolRegistryService(repository);

    await registry.registerTool({
      workspaceId: "workspace-a",
      organizationId: "genesis",
      toolKey: "genesis.tool.a",
      name: "Tool A",
      description: "Tool A",
      category: "UTILITY",
      owner: "platform@genesis.local",
      executionMode: "SYNCHRONOUS",
      capabilityRequirements: [],
      permissionRequirements: [],
      inputSchema: {},
      outputSchema: {},
      validationRules: [],
      errorTypes: [],
      timeoutMs: 1000,
      retryLimit: 0,
      replaySupported: true,
      deterministic: true,
      compatibilityPolicy: "STRICT",
      versionTag: "v1",
      actorId: "admin@example.com",
    });

    const listA = await registry.listTools("workspace-a");
    const listB = await registry.listTools("workspace-b");
    expect(listA.length).toBe(1);
    expect(listB.length).toBe(0);
  });
});
