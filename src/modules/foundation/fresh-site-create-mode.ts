import type { SiteConfiguration } from "./types";

export type FreshSiteCollision = Pick<
  SiteConfiguration,
  "siteId" | "displayName" | "domain"
>;

export function findFreshSiteCollision(input: {
  sites: readonly SiteConfiguration[];
  prospectiveSiteId: string;
  domain: string;
}): FreshSiteCollision | null {
  const domain = input.domain.trim().toLowerCase();
  const existing = input.sites.find((site) =>
    site.siteId === input.prospectiveSiteId
    || Boolean(domain && site.domain?.toLowerCase() === domain),
  );

  return existing
    ? {
        siteId: existing.siteId,
        displayName: existing.displayName,
        domain: existing.domain,
      }
    : null;
}