import type { AuthorizationContext, PermissionSet } from "./AuthorizationContext";
import type { Role } from "./AuthorizationContext";

const rolePermissionMap: Record<string, string[]> = {
  VIEWER: ["read", "module:view", "route:view", "workspace:view", "notifications:view"],
  CONTRIBUTOR: ["read", "write", "module:view", "route:view", "workspace:view"],
  OPERATOR: ["read", "write", "job:view", "job:retry", "job:duplicate", "metrics:view", "workspace:view"],
  MANAGER: ["read", "write", "admin", "metrics:view", "workspace:view"],
  WORKSPACE_ADMINISTRATOR: ["read", "write", "admin", "module.manage", "metrics:view", "workspace:view"],
  ADMINISTRATOR: ["read", "write", "admin", "module.manage", "metrics:view", "workspace:view"],
  DEVELOPER: ["read", "write", "metrics", "module.manage", "metrics:view", "workspace:view"],
  SYSTEM: ["*"],
};

function dedupeSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export class PermissionResolver {
  resolve(context: AuthorizationContext, roles: Role[]): PermissionSet {
    const inheritedPermissions = roles
      .flatMap((role) => rolePermissionMap[role.roleId] ?? [])
      .filter((permissionId) => permissionId.length > 0);

    const workspacePermissions = context.memberships
      .filter((membership) => membership.active && (!context.workspaceId || membership.workspaceId === context.workspaceId))
      .flatMap((membership) => membership.permissions);

    const resourcePermissions = context.resource.ownerActorId === context.principalId
      ? ["resource:owner"]
      : [];

    const capabilityPermissions = context.permissionSet.capabilityPermissions;

    return {
      directPermissions: dedupeSorted(context.permissionSet.directPermissions),
      inheritedPermissions: dedupeSorted(inheritedPermissions),
      capabilityPermissions: dedupeSorted(capabilityPermissions),
      workspacePermissions: dedupeSorted(workspacePermissions),
      resourcePermissions: dedupeSorted(resourcePermissions),
    };
  }
}
