import { createGeaRuntimeRegistryAuthority } from "@/lib/gea/runtime-registry-authority";
import type { CapabilityRegistry } from "@/lib/gea/capability-registry";
import type { ToolRegistry } from "@/lib/gea/tool-framework";

describe("gea runtime registry authority", () => {
  it("creates authoritative runtime registries with baseline capabilities", () => {
    const authority = createGeaRuntimeRegistryAuthority();

    const capabilityKeys = authority.capabilityRegistry
      .list()
      .map((entry) => entry.capabilityKey);

    expect(capabilityKeys).toContain("workflow");
    expect(capabilityKeys).toContain("analytics");
    expect(capabilityKeys.length).toBeGreaterThan(0);
    expect(authority.toolRegistry.list().length).toBeGreaterThan(0);
  });

  it("uses injected registries without replacing ownership", () => {
    const customCapabilityRegistry: CapabilityRegistry = {
      list: () => [],
      get: () => null,
      upsert: (definition) => ({
        capabilityId: definition.capabilityId ?? "cap-1",
        capabilityKey: definition.capabilityKey,
        capabilityVersion: definition.capabilityVersion,
        description: definition.description,
        toolKeys: definition.toolKeys,
        enabled: definition.enabled,
      }),
    };

    const customToolRegistry: ToolRegistry = {
      list: () => [],
      get: () => null,
      upsert: (tool) => ({
        toolId: tool.toolId ?? "tool-1",
        toolKey: tool.toolKey,
        toolVersion: tool.toolVersion,
        capabilityKey: tool.capabilityKey,
        riskLevel: tool.riskLevel,
        enabled: tool.enabled,
      }),
    };

    const authority = createGeaRuntimeRegistryAuthority({
      capabilityRegistry: customCapabilityRegistry,
      toolRegistry: customToolRegistry,
    });

    expect(authority.capabilityRegistry).toBe(customCapabilityRegistry);
    expect(authority.toolRegistry).toBe(customToolRegistry);
  });
});
