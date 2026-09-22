import type { SiteConfiguration } from "@/modules/foundation/types";
import type { GlwCampaign } from "./campaign-types";

export type CampaignWorkspaceResolution = {
  organizationId: string;
  organizationSites: readonly SiteConfiguration[];
  resolvedSiteId: string | null;
  requestedSiteValid: boolean;
};

export function resolveCampaignWorkspace(input: {
  sites: readonly SiteConfiguration[];
  requestedOrganizationId: string | null;
  requestedSiteId: string | null;
}): CampaignWorkspaceResolution {
  const { sites, requestedOrganizationId, requestedSiteId } = input;
  const inferredOrganizationId = requestedSiteId
    ? sites.find((site) => site.siteId === requestedSiteId)?.organizationId ?? null
    : null;
  const organizationId = requestedOrganizationId ?? inferredOrganizationId ?? sites[0]?.organizationId ?? "";
  const organizationSites = sites.filter((site) => site.organizationId === organizationId);
  const requestedSiteValid = Boolean(
    requestedSiteId
    && organizationSites.some((site) => site.siteId === requestedSiteId),
  );
  const resolvedSiteId = requestedSiteValid
    ? requestedSiteId
    : organizationSites[0]?.siteId ?? null;

  return {
    organizationId,
    organizationSites,
    resolvedSiteId,
    requestedSiteValid,
  };
}

export function filterCampaignsForWorkspace(input: {
  campaigns: readonly GlwCampaign[];
  organizationId: string;
  siteId: string | null;
  allSites: boolean;
}): readonly GlwCampaign[] {
  const { campaigns, organizationId, siteId, allSites } = input;
  if (allSites) {
    return campaigns;
  }

  return campaigns.filter((campaign) =>
    campaign.organizationId === organizationId
    && (!siteId || campaign.siteId === siteId));
}

export function filterProductsForWorkspace<T extends { organizationId: string }>(input: {
  products: readonly T[];
  organizationId: string;
  allSites: boolean;
}): readonly T[] {
  const { products, organizationId, allSites } = input;
  if (allSites) {
    return products;
  }

  return products.filter((product) => product.organizationId === organizationId);
}