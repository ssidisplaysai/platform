import { CompanyRepository } from "@/core/repositories/CompanyRepository";
import { listSites } from "./site-repository";
import type {
  AppUser,
  FoundationContext,
  OrganizationContext,
  SiteContext,
} from "./types";

const DEFAULT_USER: AppUser = {
  id: "user-gcp-0002b",
  name: "GCP Operator",
  email: "operator@genesis.local",
  roles: ["ops_manager"],
};

export function buildOrganizationContext(): readonly OrganizationContext[] {
  return CompanyRepository.getAll().map((company) => ({
    id: company.id,
    slug: company.slug,
    name: company.name,
  }));
}

export function buildSiteContext(
  organizations: readonly OrganizationContext[],
): readonly SiteContext[] {
  const organizationIds = new Set(organizations.map((organization) => organization.id));

  return listSites()
    .filter((site) => organizationIds.has(site.organizationId))
    .map((site) => ({
      id: site.siteId,
      slug: site.slug,
      organizationId: site.organizationId,
      name: site.displayName,
      region: "US-CENTRAL",
      environment: site.environment,
      health: site.healthStatus,
      publishing: site.publishingStatus,
      enabled: site.enabled,
    }));
}

export function createFoundationContext(
  user: AppUser = DEFAULT_USER,
): FoundationContext {
  const organizations = buildOrganizationContext();
  const sites = buildSiteContext(organizations);

  const selectedOrganizationId =
    sites[0]?.organizationId ?? organizations[0]?.id ?? "";
  const selectedSiteId =
    sites.find((site) => site.organizationId === selectedOrganizationId)?.id ??
    "";

  return {
    user,
    organizations,
    sites,
    selectedOrganizationId,
    selectedSiteId,
  };
}

export function getSitesForOrganization(
  sites: readonly SiteContext[],
  organizationId: string,
): readonly SiteContext[] {
  return sites.filter((site) => site.organizationId === organizationId);
}
