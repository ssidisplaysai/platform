import type { AuthorizationContext, WorkspaceMembership } from "./AuthorizationContext";

export type ResolvedWorkspaceAccess = {
  member: boolean;
  owner: boolean;
  administrator: boolean;
  contributor: boolean;
  viewer: boolean;
  memberships: WorkspaceMembership[];
};

export class WorkspaceResolver {
  resolve(context: AuthorizationContext): ResolvedWorkspaceAccess {
    const relevantMemberships = context.memberships.filter((membership) => {
      if (!membership.active) {
        return false;
      }

      if (!context.workspaceId) {
        return true;
      }

      return membership.workspaceId === context.workspaceId
        || membership.inheritedFromWorkspaceId === context.workspaceId;
    });

    const hasRole = (targetRole: string) => relevantMemberships.some((membership) => membership.role === targetRole);

    return {
      member: relevantMemberships.length > 0,
      owner: hasRole("SYSTEM") || hasRole("ADMINISTRATOR"),
      administrator: hasRole("WORKSPACE_ADMINISTRATOR") || hasRole("ADMINISTRATOR") || hasRole("SYSTEM"),
      contributor: hasRole("CONTRIBUTOR") || hasRole("OPERATOR") || hasRole("MANAGER"),
      viewer: hasRole("VIEWER"),
      memberships: relevantMemberships,
    };
  }
}
