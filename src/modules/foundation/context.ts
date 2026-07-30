import { CompanyRepository } from "@/core/repositories/CompanyRepository";
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
  return organizations.map((organization) => ({
    id: `${organization.id}-primary-site`,
    slug: `${organization.slug}-main`,
    organizationId: organization.id,
    name: `${organization.name} Primary`,
    region: "US-CENTRAL",
  }));
}

export function createFoundationContext(
  user: AppUser = DEFAULT_USER,
): FoundationContext {
  const organizations = buildOrganizationContext();
  const sites = buildSiteContext(organizations);

  const selectedOrganizationId = organizations[0]?.id ?? "";
  const selectedSiteId =
    sites.find((site) => site.organizationId === selectedOrganizationId)?.id ??
    sites[0]?.id ??
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
