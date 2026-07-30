import type { AuthorizationContext, Role } from "./AuthorizationContext";

const rolePrecedence: Record<string, number> = {
  VIEWER: 10,
  CONTRIBUTOR: 15,
  OPERATOR: 20,
  MANAGER: 30,
  WORKSPACE_ADMINISTRATOR: 35,
  ADMINISTRATOR: 40,
  DEVELOPER: 50,
  SYSTEM: 60,
};

export class RoleResolver {
  resolve(context: AuthorizationContext): Role[] {
    const collected = new Map<string, Role>();

    const addRole = (roleId: string, scope: "SYSTEM" | "WORKSPACE") => {
      const precedence = rolePrecedence[roleId] ?? 0;
      const existing = collected.get(roleId);
      if (!existing || precedence > existing.precedence) {
        collected.set(roleId, { roleId, scope, precedence });
      }
    };

    for (const roleId of context.roles) {
      addRole(roleId, "SYSTEM");
    }

    for (const membership of context.memberships) {
      if (!membership.active) {
        continue;
      }

      if (context.workspaceId && membership.workspaceId !== context.workspaceId) {
        continue;
      }

      addRole(membership.role, "WORKSPACE");
    }

    return Array.from(collected.values()).sort((left, right) => {
      if (left.precedence !== right.precedence) {
        return right.precedence - left.precedence;
      }

      return left.roleId.localeCompare(right.roleId);
    });
  }
}
