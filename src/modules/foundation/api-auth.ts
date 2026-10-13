import type { NextRequest } from "next/server";
import type { AppRole, PermissionAction } from "./types";
import { resolvePermissions } from "./permissions";
import { resolveAuthenticatedOperatorPrincipal, validateOperatorMutationRequest } from "./operator-session";

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

export type RequestPrincipal = {
  principalId: string;
  sessionId: string;
};

function normalizeScopeValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveRequestRoles(request: NextRequest, environment: NodeJS.ProcessEnv = process.env): readonly AppRole[] {
  const resolution = resolveAuthenticatedOperatorPrincipal(request, new Date(), environment);
  return resolution.ok ? resolution.principal.roles : ["viewer"];
}

export function isAuthorized(request: NextRequest, permission: PermissionAction, environment: NodeJS.ProcessEnv = process.env): boolean {
  return authorizeRequest(request, permission, environment).ok;
}

export function authorizeRequest(
  request: NextRequest,
  permission: PermissionAction,
  environment: NodeJS.ProcessEnv = process.env,
): AuthorizationResult {
  const resolution = resolveAuthenticatedOperatorPrincipal(request, new Date(), environment);
  if (!resolution.ok) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
      roles: [],
    };
  }

  const roles = resolution.principal.roles;
  const permissions = resolvePermissions(roles);
  if (!permissions.has(permission)) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
      roles,
    };
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase()) && !validateOperatorMutationRequest(request, resolution)) {
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

export function forwardOperatorMutationContext(request: NextRequest, headers: HeadersInit = {}): Headers {
  const forwarded = new Headers(headers);
  for (const name of ["cookie", "origin", "x-genesis-csrf-token"] as const) {
    const value = request.headers.get(name);
    if (value) forwarded.set(name, value);
  }
  return forwarded;
}

export function resolveRequestPrincipal(request: NextRequest, environment: NodeJS.ProcessEnv = process.env): RequestPrincipal | null {
  const resolution = resolveAuthenticatedOperatorPrincipal(request, new Date(), environment);
  return resolution.ok ? { principalId: resolution.principal.principalId, sessionId: resolution.principal.sessionId } : null;
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
