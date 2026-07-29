import type {
  IntegrationProfileConfiguration,
  IntegrationProfileListFilters,
  IntegrationProfileType,
} from "./types";

export function filterIntegrationProfiles(
  profiles: readonly IntegrationProfileConfiguration[],
  filters: IntegrationProfileListFilters,
): readonly IntegrationProfileConfiguration[] {
  return profiles.filter((profile) => {
    if (filters.organizationId && profile.organizationId !== filters.organizationId) {
      return false;
    }

    if (filters.profileType && profile.profileType !== filters.profileType) {
      return false;
    }

    if (filters.status && profile.status !== filters.status) {
      return false;
    }

    if (filters.enabled !== undefined && profile.enabled !== filters.enabled) {
      return false;
    }

    if (filters.siteId && !profile.assignedSiteIds.includes(filters.siteId)) {
      return false;
    }

    if (filters.query) {
      const query = filters.query.toLowerCase();
      const text = [
        profile.profileId,
        profile.profileName,
        profile.profileType,
        profile.description ?? "",
        ...Object.values(profile.references).filter((value): value is string => Boolean(value)),
      ]
        .join(" ")
        .toLowerCase();

      if (!text.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

export function groupProfilesByType(
  profiles: readonly IntegrationProfileConfiguration[],
): Readonly<Record<IntegrationProfileType, readonly IntegrationProfileConfiguration[]>> {
  const grouped: Record<IntegrationProfileType, IntegrationProfileConfiguration[]> = {
    publishing: [],
    wordpress: [],
    workflow: [],
    prompt: [],
    image: [],
    seo: [],
    brand: [],
    analytics: [],
  };

  profiles.forEach((profile) => {
    grouped[profile.profileType].push(profile);
  });

  return grouped;
}
