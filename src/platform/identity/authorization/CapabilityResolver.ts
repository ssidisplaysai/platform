import type { AuthorizationContext, Capability } from "./AuthorizationContext";

function dedupeSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function permissionToCapabilities(permissionId: string): string[] {
  const segments = permissionId.split(":").filter((segment) => segment.length > 0);
  if (segments.length < 2) {
    return [];
  }

  const capabilities: string[] = [];
  for (let index = 1; index < segments.length; index += 1) {
    capabilities.push(segments.slice(0, index).join(":"));
  }

  return capabilities;
}

export class CapabilityResolver {
  resolve(context: AuthorizationContext): Capability[] {
    const allPermissions = dedupeSorted([
      ...context.permissionSet.directPermissions,
      ...context.permissionSet.inheritedPermissions,
      ...context.permissionSet.workspacePermissions,
      ...context.permissionSet.resourcePermissions,
      ...context.permissionSet.capabilityPermissions,
    ]);

    const capabilityMap = new Map<string, Set<string>>();

    for (const permissionId of allPermissions) {
      for (const capabilityId of permissionToCapabilities(permissionId)) {
        if (!capabilityMap.has(capabilityId)) {
          capabilityMap.set(capabilityId, new Set<string>());
        }

        capabilityMap.get(capabilityId)!.add(permissionId);
      }
    }

    for (const explicitCapabilityId of context.capabilities) {
      if (!capabilityMap.has(explicitCapabilityId)) {
        capabilityMap.set(explicitCapabilityId, new Set<string>());
      }
    }

    return Array.from(capabilityMap.entries())
      .map(([capabilityId, permissionIds]) => ({
        capabilityId,
        permissionIds: Array.from(permissionIds).sort((left, right) => left.localeCompare(right)),
      }))
      .sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
  }
}
