import type { NextRequest } from "next/server";
import type { AppRole, PermissionAction } from "./types";
import { resolvePermissions } from "./permissions";

const ALLOWED_ROLES: readonly AppRole[] = [
  "platform_admin",
  "ops_manager",
  "company_operator",
  "analyst",
  "viewer",
];

export function resolveRequestRoles(request: NextRequest): readonly AppRole[] {
  const header = request.headers.get("x-gcp-roles");
  if (!header) {
    return ["ops_manager"];
  }

  const roles = header
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is AppRole =>
      (ALLOWED_ROLES as readonly string[]).includes(value),
    );

  return roles.length > 0 ? roles : ["viewer"];
}

export function isAuthorized(request: NextRequest, permission: PermissionAction): boolean {
  const roles = resolveRequestRoles(request);
  const permissions = resolvePermissions(roles);
  return permissions.has(permission);
}
