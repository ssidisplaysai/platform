import type { AppRole, PermissionAction } from "./types";

const ROLE_PERMISSION_MATRIX: Record<AppRole, readonly PermissionAction[]> = {
  platform_admin: [
    "workspace:view",
    "workspace:manage",
    "organization:switch",
    "site:switch",
    "sites:read",
    "sites:create",
    "sites:update",
    "sites:enable",
    "sites:disable",
    "sites:test_connection",
    "sites:manage_integrations",
    "sites:view_health",
    "sites:view_audit",
    "settings:view",
    "settings:manage",
    "notifications:view",
    "notifications:manage",
    "audit:view",
    "command_palette:use",
    "search:use",
  ],
  ops_manager: [
    "workspace:view",
    "organization:switch",
    "site:switch",
    "sites:read",
    "sites:create",
    "sites:update",
    "sites:enable",
    "sites:disable",
    "sites:test_connection",
    "sites:manage_integrations",
    "sites:view_health",
    "sites:view_audit",
    "settings:view",
    "notifications:view",
    "notifications:manage",
    "audit:view",
    "command_palette:use",
    "search:use",
  ],
  company_operator: [
    "workspace:view",
    "organization:switch",
    "site:switch",
    "sites:read",
    "sites:update",
    "sites:test_connection",
    "sites:view_health",
    "settings:view",
    "notifications:view",
    "command_palette:use",
    "search:use",
  ],
  analyst: [
    "workspace:view",
    "organization:switch",
    "site:switch",
    "sites:read",
    "sites:view_health",
    "sites:view_audit",
    "settings:view",
    "notifications:view",
    "audit:view",
    "search:use",
  ],
  viewer: ["workspace:view", "settings:view", "notifications:view"],
};

export function resolvePermissions(roles: readonly AppRole[]): Set<PermissionAction> {
  const permissions = new Set<PermissionAction>();

  roles.forEach((role) => {
    ROLE_PERMISSION_MATRIX[role].forEach((permission) => {
      permissions.add(permission);
    });
  });

  return permissions;
}

export function hasPermission(
  permissions: Set<PermissionAction>,
  permission: PermissionAction,
): boolean {
  return permissions.has(permission);
}

export function hasAllPermissions(
  permissions: Set<PermissionAction>,
  requiredPermissions: readonly PermissionAction[] | undefined,
): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  return requiredPermissions.every((permission) => permissions.has(permission));
}
