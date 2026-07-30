import type {
  PermissionAction,
  SiteConfiguration,
} from "./types";

export function canAccessSite(
  site: SiteConfiguration,
  permissions: Set<PermissionAction>,
): boolean {
  if (!permissions.has("sites:read")) {
    return false;
  }

  if (!site.enabled && !permissions.has("sites:view_health")) {
    return false;
  }

  return true;
}

export function resolveSiteAccess(input: {
  site: SiteConfiguration | null;
  permissions: Set<PermissionAction>;
}): {
  status: "ok" | "not_found" | "unauthorized";
  site: SiteConfiguration | null;
} {
  if (!input.site) {
    return { status: "not_found", site: null };
  }

  if (!canAccessSite(input.site, input.permissions)) {
    return { status: "unauthorized", site: null };
  }

  return { status: "ok", site: input.site };
}
