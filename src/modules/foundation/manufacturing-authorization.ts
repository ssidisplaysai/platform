import type { AppRole } from "./types";
import { resolvePermissions } from "./permissions";
import type { ManufacturingPermissionAction } from "./manufacturing-types";

export function resolveManufacturingPermissions(
  roles: readonly AppRole[],
): Set<ManufacturingPermissionAction> {
  const permissions = resolvePermissions(roles);
  const scoped = new Set<ManufacturingPermissionAction>();

  permissions.forEach((permission) => {
    if (permission.startsWith("manufacturing:")) {
      scoped.add(permission as ManufacturingPermissionAction);
    }
  });

  return scoped;
}

export function hasManufacturingPermission(input: {
  roles: readonly AppRole[];
  permission: ManufacturingPermissionAction;
}): boolean {
  const permissions = resolveManufacturingPermissions(input.roles);
  return permissions.has(input.permission);
}
