import "server-only";

const STRICT_OUTDOOR_SPHERE_SITE_ID = "site-led-display-warehouse-production";
const STRICT_OUTDOOR_SPHERE_DOMAIN = "leddisplaywarehouse.com";
const STRICT_OUTDOOR_SPHERE_CONTACT_URL = "https://leddisplaywarehouse.com/contact-us/";

type InternalLink = {
  href?: string | null;
};

function normalizeDomain(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^www\./, "");
}

export function resolveOutdoorSphereGovernedCtaUrl(input: {
  strictGeneratedContextualRequired: boolean;
  siteId: string;
  siteDomain: string | null | undefined;
  approvedCampaignInternalLinks: readonly InternalLink[];
}): string | null {
  if (
    input.strictGeneratedContextualRequired
    && input.siteId === STRICT_OUTDOOR_SPHERE_SITE_ID
    && normalizeDomain(input.siteDomain) === STRICT_OUTDOOR_SPHERE_DOMAIN
  ) {
    return STRICT_OUTDOOR_SPHERE_CONTACT_URL;
  }

  return input.approvedCampaignInternalLinks[0]?.href ?? null;
}
