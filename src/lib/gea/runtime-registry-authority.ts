import { createAuthoritativeCapabilityRegistry, type CapabilityRegistry } from "./capability-registry";
import { createInMemoryToolRegistry, type ToolRegistry } from "./tool-framework";

export type GeaRuntimeRegistryAuthority = {
  capabilityRegistry: CapabilityRegistry;
  toolRegistry: ToolRegistry;
};

export function createGeaRuntimeRegistryAuthority(
  input?: Partial<GeaRuntimeRegistryAuthority>,
): GeaRuntimeRegistryAuthority {
  return {
    capabilityRegistry: input?.capabilityRegistry ?? createAuthoritativeCapabilityRegistry(),
    toolRegistry: input?.toolRegistry ?? createInMemoryToolRegistry(),
  };
}
