import type { NextRequest } from "next/server";
import type { AppRole, PermissionAction } from "./types";
import { resolvePermissions } from "./permissions";

const ALLOWED_ROLES: readonly AppRole[] = [
  "platform_admin",
  "ops_manager",
  "operations",
  "company_operator",
  "analyst",
  "manufacturing_planner",
  "manufacturing_engineer",
  "production_supervisor",
  "executive",
  "administrator",
  "viewer",
];

export type AuthorizationResult = {
  ok: boolean;
  status: 200 | 401 | 403;
  error: "Unauthorized" | "Forbidden" | null;
  roles: readonly AppRole[];
};

export type RequestScope = {
  organizationId: string | null;
  siteId: string | null;
};

function normalizeScopeValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseRequestRoles(request: NextRequest): readonly AppRole[] {
  const header = request.headers.get("x-gcp-roles");
  if (!header) {
    return [];
  }

  const roles = header
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is AppRole =>
      (ALLOWED_ROLES as readonly string[]).includes(value),
    );

  return roles;
}

export function resolveRequestRoles(request: NextRequest): readonly AppRole[] {
  const roles = parseRequestRoles(request);
  return roles.length > 0 ? roles : ["viewer"];
}

export function isAuthorized(request: NextRequest, permission: PermissionAction): boolean {
  const roles = resolveRequestRoles(request);
  const permissions = resolvePermissions(roles);
  return permissions.has(permission);
}

export function authorizeRequest(
  request: NextRequest,
  permission: PermissionAction,
): AuthorizationResult {
  const roles = parseRequestRoles(request);
  if (roles.length === 0) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
      roles: [],
    };
  }

  const permissions = resolvePermissions(roles);
  if (!permissions.has(permission)) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
      roles,
    };
  }

  return {
    ok: true,
    status: 200,
    error: null,
    roles,
  };
}

export function resolveRequestScope(request: NextRequest): RequestScope {
  const organizationId = normalizeScopeValue(
    request.headers.get("x-gcp-organization-id") ??
      request.nextUrl.searchParams.get("organizationId"),
  );

  const siteId = normalizeScopeValue(
    request.headers.get("x-gcp-site-id") ?? request.nextUrl.searchParams.get("siteId"),
  );

  return {
    organizationId,
    siteId,
  };
}

export function hasOrganizationScope(scope: RequestScope): boolean {
  return Boolean(scope.organizationId);
}

export function isRecordInScope(input: {
  recordOrganizationId: string;
  recordSiteId?: string | null;
  scope: RequestScope;
}): boolean {
  if (!input.scope.organizationId) {
    return false;
  }

  if (input.recordOrganizationId !== input.scope.organizationId) {
    return false;
  }

  if (input.scope.siteId && input.recordSiteId && input.recordSiteId !== input.scope.siteId) {
    return false;
  }

  return true;
}
