import type { ProductConfiguration, SiteConfiguration } from "@/modules/foundation/types";
import {
  buildGlwCampaignLaunchpadPreflight,
  selectGlwLaunchpadTargets,
  validateGlwCampaignLaunchpadInput,
} from "../campaign-launchpad";

const site = {
  siteId: "site-1", organizationId: "org-1", displayName: "Example", canonicalUrl: "https://example.com",
  domain: "example.com", enabled: true, publishingStatus: "ready", defaultPublicationStatus: "draft",
} as SiteConfiguration;
const product = {
  productId: "product-1", organizationId: "org-1", displayName: "Widget", productName: "Widget",
  slug: "widget", assignedSiteIds: ["site-1"], siteAssignments: [{ siteId: "site-1", siteSpecificSlug: "widget", enabledForSite: true, publicationStatus: "ready" }],
  enabled: true, catalogStatus: "ready", sourceEvidenceReference: "source-1",
} as ProductConfiguration;

describe("GLW Campaign Launchpad preflight", () => {
  test("validates product URLs and required reach input", () => {
    expect(validateGlwCampaignLaunchpadInput({ reach: "NATIONWIDE", productUrl: "javascript:alert(1)" }).valid).toBe(false);
    expect(validateGlwCampaignLaunchpadInput({ reach: "STATE", productUrl: "https://example.com/widget" }).issues)
      .toContainEqual(expect.objectContaining({ field: "stateCodes" }));
  });

  test("uses the current supported target registry for nationwide reach", () => {
    const targets = selectGlwLaunchpadTargets({ reach: "NATIONWIDE", productUrl: "https://example.com/widget" });
    expect(targets.length).toBeGreaterThan(0);
    expect(targets).toContainEqual(expect.objectContaining({ cityName: "Dallas", stateCode: "TX" }));
  });

  test("scopes state reach to supported cities", () => {
    const targets = selectGlwLaunchpadTargets({ reach: "STATE", productUrl: "https://example.com/widget", stateCodes: ["NY"] });
    expect(targets).toEqual([expect.objectContaining({ cityName: "New York" })]);
  });

  test("fails closed before target reads for an unregistered URL", async () => {
    const readTarget = jest.fn();
    await expect(buildGlwCampaignLaunchpadPreflight({
      request: { reach: "NATIONWIDE", productUrl: "https://unregistered.example/widget" },
      organizationId: "org-1", sites: [site], products: [product], readTarget,
    })).rejects.toThrow("registered site");
    expect(readTarget).not.toHaveBeenCalled();
  });

  test("renders safe reach from authoritative absent targets and excludes duplicates", async () => {
    let count = 0;
    const result = await buildGlwCampaignLaunchpadPreflight({
      request: { reach: "STATE", productUrl: "https://example.com/widget", stateCodes: ["TX"] },
      organizationId: "org-1", sites: [site], products: [product],
      readTarget: async (target) => ({
        applicationPath: target.canonicalPath, canonicalPath: target.canonicalPath, canonicalProduct: "Widget",
        canonicalProductSlug: "widget", canonicalSlug: target.citySlug, canonicalParentId: "1",
        state: count++ === 0 ? "EXISTS_PUBLISHED" : "ABSENT", wordpressObjectId: null,
        wordpressStatus: null, wordpressTitle: null, wordpressUrl: null,
        source: "WORDPRESS_READ", confidence: "AUTHORITATIVE",
      }),
    });
    expect(result).toMatchObject({
      readiness: "READY", publicationPolicy: "Draft Only", potentialReach: 4,
      existingCoverage: 1, duplicateTargetsExcluded: 1, maximumSafeReach: 3,
      recommendedInitialBatch: 3,
    });
  });

  test("blocks safe reach when product or source authority is incomplete", async () => {
    const result = await buildGlwCampaignLaunchpadPreflight({
      request: { reach: "STATE", productUrl: "https://example.com/widget", stateCodes: ["NY"] },
      organizationId: "org-1", sites: [site], products: [{ ...product, enabled: false, sourceEvidenceReference: null }],
      readTarget: async (target) => ({
        applicationPath: target.canonicalPath, canonicalPath: target.canonicalPath, canonicalProduct: "Widget",
        canonicalProductSlug: "widget", canonicalSlug: target.citySlug, canonicalParentId: "1", state: "ABSENT",
        wordpressObjectId: null, wordpressStatus: null, wordpressTitle: null, wordpressUrl: null,
        source: "WORDPRESS_READ", confidence: "AUTHORITATIVE",
      }),
    });
    expect(result).toMatchObject({ readiness: "AUTHORITY_REQUIRED", maximumSafeReach: 0, authorityBlockedTargets: 1 });
  });
});