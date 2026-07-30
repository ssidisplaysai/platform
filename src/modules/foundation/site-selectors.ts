import type {
  SiteConfiguration,
  SiteEnvironment,
  SiteHealthStatus,
  SiteLifecycleState,
  SiteListFilters,
} from "./types";

export function filterSites(
  sites: readonly SiteConfiguration[],
  filters: SiteListFilters,
): readonly SiteConfiguration[] {
  const query = filters.query?.trim().toLowerCase() ?? "";

  return sites.filter((site) => {
    if (filters.organizationId && site.organizationId !== filters.organizationId) {
      return false;
    }

    if (filters.environment && site.environment !== filters.environment) {
      return false;
    }

    if (filters.lifecycleState && site.lifecycleState !== filters.lifecycleState) {
      return false;
    }

    if (filters.healthStatus && site.healthStatus !== filters.healthStatus) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchable = `${site.siteName} ${site.displayName} ${site.domain ?? ""}`.toLowerCase();
    return searchable.includes(query);
  });
}

export const SITE_ENVIRONMENTS: readonly SiteEnvironment[] = [
  "local",
  "development",
  "test",
  "staging",
  "production",
];

export const SITE_LIFECYCLE_STATES: readonly SiteLifecycleState[] = [
  "draft",
  "configuring",
  "active",
  "suspended",
  "archived",
];

export const SITE_HEALTH_STATES: readonly SiteHealthStatus[] = [
  "unknown",
  "healthy",
  "degraded",
  "unhealthy",
  "not_configured",
];
