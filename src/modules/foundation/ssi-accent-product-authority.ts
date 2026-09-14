import type { ProductConfiguration, SiteConfiguration } from "./types";

export const SSI_ACCENT_AUTHORITY_VERSION = "SSI_ACCENT_PRODUCT_AUTHORITY_V1";
export const SSI_ACCENT_ORGANIZATION_ID = "ssi";
export const SSI_ACCENT_SITE_ID = "site-ssi-screen-solutions-international";
export const SSI_ACCENT_PRODUCT_ID = "prod-ssi-accent-rear-projection-film";
export const SSI_ACCENT_CANONICAL_PAGE_ID = 6285;
export const SSI_ACCENT_CANONICAL_URL = "https://ssidisplays.com/accent-rear-projection-film/";

export const SSI_ACCENT_VERIFIED_SPECIFICATIONS: ProductConfiguration["specifications"] = [
  { specificationId: "spec-ssi-accent-screen-color", specificationGroup: "Optical", key: "screen_color", displayLabel: "Screen Color", rawValue: "Frosted White", normalizedValue: "Frosted White", unit: null, sortOrder: 1, sourceReference: "wordpress-page:6285", evidenceReference: SSI_ACCENT_CANONICAL_URL, confidence: 1, visibility: "public" },
  { specificationId: "spec-ssi-accent-light-transmission", specificationGroup: "Optical", key: "light_transmission", displayLabel: "Transmission of Light", rawValue: "79%", normalizedValue: "79", unit: "%", sortOrder: 2, sourceReference: "wordpress-page:6285", evidenceReference: SSI_ACCENT_CANONICAL_URL, confidence: 1, visibility: "public" },
  { specificationId: "spec-ssi-accent-viewing-angle", specificationGroup: "Optical", key: "maximum_viewing_angle", displayLabel: "Maximum Viewing Angle", rawValue: "175 degrees", normalizedValue: "175", unit: "degrees", sortOrder: 3, sourceReference: "wordpress-page:6285", evidenceReference: SSI_ACCENT_CANONICAL_URL, confidence: 1, visibility: "public" },
];

export function normalizeSsiAccentProductAuthority(input: {
  site: Pick<SiteConfiguration, "siteId" | "organizationId">;
  product: ProductConfiguration;
}): ProductConfiguration {
  if (
    input.site.organizationId !== SSI_ACCENT_ORGANIZATION_ID
    || input.site.siteId !== SSI_ACCENT_SITE_ID
    || input.product.organizationId !== SSI_ACCENT_ORGANIZATION_ID
    || input.product.productId !== SSI_ACCENT_PRODUCT_ID
  ) return input.product;

  return {
    ...input.product,
    sourceEvidenceReference: `wordpress-page:${SSI_ACCENT_CANONICAL_PAGE_ID}:${SSI_ACCENT_CANONICAL_URL}`,
    specifications: SSI_ACCENT_VERIFIED_SPECIFICATIONS.map((specification) => ({ ...specification })),
  };
}