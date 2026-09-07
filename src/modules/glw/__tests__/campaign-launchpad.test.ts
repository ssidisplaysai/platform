import { FOUNDATION_PRODUCTS } from "@/modules/foundation/catalog-fixtures";
import { resolvePermissions } from "@/modules/foundation/permissions";
import { FOUNDATION_SITE_FIXTURES } from "@/modules/foundation/site-fixtures";
import { evaluateProductReadiness } from "@/modules/foundation/product-readiness";
import { evaluateSiteReadiness } from "@/modules/foundation/site-readiness";
import type { ProductConfiguration, SiteConfiguration } from "@/modules/foundation/types";
import type { GlwPageExecutionRecord } from "../page-execution";
import { buildGlwCampaignLaunchpadPreflight, selectGlwLaunchpadTargets, validateGlwCampaignLaunchpadInput } from "../campaign-launchpad";

const permissions = resolvePermissions(["ops_manager"]);
const site: SiteConfiguration = {
  ...FOUNDATION_SITE_FIXTURES[0],
  healthStatus: "healthy",
  publishingStatus: "ready",
  integrations: { ...FOUNDATION_SITE_FIXTURES[0].integrations, workflowReference: "workflow-1" },
  profiles: { promptProfileReference: "prompt-1", imageProfileReference: "image-1", seoProfileReference: "seo-1", brandProfileReference: "brand-1", analyticsProfileReference: null },
};
const baseProduct = FOUNDATION_PRODUCTS[0];
const product: ProductConfiguration = {
  ...baseProduct,
  enabled: true,
  lifecycleState: "configuring",
  visibility: "internal",
  specifications: [{ specificationId: "spec-1", specificationGroup: "general", key: "pixel", displayLabel: "Pixel", rawValue: "1", normalizedValue: "1", unit: "mm", sortOrder: 1, sourceReference: null, evidenceReference: null, confidence: 1, visibility: "public" }],
  media: { ...baseProduct.media, primaryImageReference: "image-1" },
  seoProfileReference: "seo-1",
  promptProfileReference: "prompt-1",
  sourceEvidenceReference: "source-1",
  siteAssignments: baseProduct.siteAssignments.map((assignment) => ({ ...assignment, enabledForSite: true, publicationStatus: "ready", imageProfileReference: "image-1" })),
};

function execution(overrides: Partial<GlwPageExecutionRecord> = {}): GlwPageExecutionRecord {
  return {
    jobId: "job-dallas", correlationId: "job-dallas", executionTransport: "N8N_MCP", organizationId: site.organizationId,
    siteId: site.siteId, productId: product.productId, productTopic: "Widget", state: "Texas", city: "Dallas",
    slug: `${product.slug}/texas/dallas`, title: "Widget Dallas", seoTitle: "Widget Dallas", metaDescription: "Widget Dallas",
    publicationIntent: "draft", status: "RUNNING", externalExecutionId: "execution-1", wordpressObjectId: null,
    wordpressUrl: null, wordpressStatus: null, errorCode: null, errorMessage: null, requestedPublicationMode: "draft",
    disposition: null, qaStatus: null, qaChecks: null, qaFailureReasons: null, focusKeyphrase: null,
    wordCount: null, featuredImagePresent: null, createdAt: "2026-01-01", dispatchedAt: "2026-01-01",
    updatedAt: "2026-01-01", completedAt: null, ...overrides,
  };
}

function common(overrides: Record<string, unknown> = {}) {
  return {
    request: { reach: "STATE" as const, productUrl: `${site.canonicalUrl}/${product.slug}`, stateCodes: ["TX"] },
    organizationId: site.organizationId,
    organizationActive: true,
    permissions,
    sites: [site],
    products: [product],
    executionAuthority: { status: "CHECKED" as const, records: [] },
    campaignAuthority: { status: "CHECKED" as const, targets: {} },
    intentAuthority: { status: "CHECKED_CLEAR" as const },
    ...overrides,
  };
}

function canonical(target: { canonicalPath: string; citySlug: string }, state: "ABSENT" | "EXISTS_PUBLISHED" | "UNKNOWN" = "ABSENT") {
  return {
    applicationPath: target.canonicalPath, canonicalPath: target.canonicalPath, canonicalProduct: product.displayName,
    canonicalProductSlug: product.slug, canonicalSlug: target.citySlug, canonicalParentId: state === "UNKNOWN" ? null : "1",
    state, wordpressObjectId: state === "EXISTS_PUBLISHED" ? "88" : null, wordpressStatus: state === "EXISTS_PUBLISHED" ? "publish" : null,
    wordpressTitle: null, wordpressUrl: null, source: state === "UNKNOWN" ? "UNVERIFIED" as const : "WORDPRESS_READ" as const,
    confidence: state === "UNKNOWN" ? "UNVERIFIED" as const : "AUTHORITATIVE" as const,
  };
}

describe("GLW Campaign Launchpad preflight", () => {
  test("retains V1 URL and reach validation", () => {
    expect(validateGlwCampaignLaunchpadInput({ reach: "NATIONWIDE", productUrl: "javascript:alert(1)" }).valid).toBe(false);
    expect(validateGlwCampaignLaunchpadInput({ reach: "STATE", productUrl: "https://example.com/widget" }).issues).toContainEqual(expect.objectContaining({ field: "stateCodes" }));
  });

  test("uses current target registry for nationwide and state reach", () => {
    expect(selectGlwLaunchpadTargets({ reach: "NATIONWIDE", productUrl: "https://example.com/widget" })).toContainEqual(expect.objectContaining({ cityName: "Dallas", stateCode: "TX" }));
    expect(selectGlwLaunchpadTargets({ reach: "STATE", productUrl: "https://example.com/widget", stateCodes: ["NY"] })).toEqual([expect.objectContaining({ cityName: "New York" })]);
  });

  test("fails before target reads for an unregistered URL", async () => {
    const readTarget = jest.fn();
    await expect(buildGlwCampaignLaunchpadPreflight({ ...common(), request: { reach: "NATIONWIDE", productUrl: "https://unregistered.example/widget" }, readTarget })).rejects.toThrow("registered site");
    expect(readTarget).not.toHaveBeenCalled();
  });

  test("preserves canonical configuring lifecycle readiness semantics", async () => {
    expect(evaluateProductReadiness({ product, requiredPermission: "products:evaluate_readiness", permissions }).checkedConditions.find((condition) => condition.key === "lifecycle_permits_operation")?.passed).toBe(true);
    const result = await buildGlwCampaignLaunchpadPreflight({ ...common(), readTarget: async (target) => canonical(target) });
    expect(result.readinessBlockers).not.toContainEqual(expect.objectContaining({ code: "PRODUCT_LIFECYCLE_PERMITS_OPERATION" }));
  });

  test("Launchpad canonical readiness matches site and product evaluators", async () => {
    const blockedSite = { ...site, integrations: { ...site.integrations, wordpressCredentialReference: null } };
    const canonicalSite = evaluateSiteReadiness({ site: blockedSite, organizationActive: true, requiredPermission: "sites:manage_integrations", permissions, intent: "publish", requireWorkflowReference: true });
    const canonicalProduct = evaluateProductReadiness({ product, requiredPermission: "products:evaluate_readiness", permissions });
    const result = await buildGlwCampaignLaunchpadPreflight({ ...common({ sites: [blockedSite] }), readTarget: async (target) => canonical(target) });
    expect(result.productAuthorityState).toBe(canonicalProduct.ready ? "READY" : "REQUIRES_AUTHORITY");
    expect(result.readinessBlockers.filter((entry) => entry.authoritySource === "SITE_READINESS" && entry.severity === "BLOCKING").map((entry) => entry.message)).toEqual(canonicalSite.blockingReasons);
  });

  test("omitted execution authority cannot produce a safe target", async () => {
    const result = await buildGlwCampaignLaunchpadPreflight({ ...common({ executionAuthority: { status: "UNAVAILABLE" } }), readTarget: async (target) => canonical(target) });
    expect(result.maximumSafeReach).toBe(0);
    expect(result.readinessBlockers).toContainEqual(expect.objectContaining({ code: "EXECUTION_OWNERSHIP_UNAVAILABLE" }));
  });

  test("missing campaign persistence and broader intent authority fail closed", async () => {
    const result = await buildGlwCampaignLaunchpadPreflight({ ...common({ campaignAuthority: { status: "UNAVAILABLE" }, intentAuthority: { status: "UNAVAILABLE" } }), readTarget: async (target) => canonical(target) });
    expect(result.maximumSafeReach).toBe(0);
    expect(result.existingCampaignConflicts).toBe("UNAVAILABLE");
    expect(result.cannibalizationConflicts).toBe("UNAVAILABLE");
    expect(result.readinessBlockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CAMPAIGN_AUTHORITY_MISSING", scope: "CAMPAIGN" }),
      expect.objectContaining({ code: "CANNIBALIZATION_AUTHORITY_UNAVAILABLE", scope: "CANNIBALIZATION" }),
    ]));
  });

  test("derives mutually exclusive counts and drilldown from primary dispositions", async () => {
    const states = ["EXISTS_PUBLISHED", "ABSENT", "UNKNOWN", "ABSENT"] as const;
    let index = 0;
    const result = await buildGlwCampaignLaunchpadPreflight({
      ...common({ executionAuthority: { status: "CHECKED", records: [execution()] } }),
      readTarget: async (target) => canonical(target, states[index++]),
    });
    const { potentialCount, ...dispositions } = result.counts;
    expect(Object.values(dispositions).reduce((sum, count) => sum + count, 0)).toBe(potentialCount);
    expect(result.counts).toMatchObject({ existingCoverageCount: 1, executionOwnedCount: 1, unreconciledCount: 1, maximumSafeReachCount: 1 });
    expect(result.excludedTargets).toHaveLength(potentialCount - result.maximumSafeReach);
    for (const disposition of ["EXISTING_COVERAGE", "EXECUTION_OWNED", "UNRECONCILED"] as const) {
      expect(result.excludedTargets.filter((target) => target.group === disposition)).toHaveLength(result.targetAssessments.filter((target) => target.primaryDisposition === disposition).length);
    }
    expect(result.excludedTargets.find((target) => target.group === "EXISTING_COVERAGE")?.reason).toContain("exact canonical");
    expect(result.excludedTargets.find((target) => target.group === "EXECUTION_OWNED")).toMatchObject({ jobId: "job-dallas", campaignId: null });
  });

  test("only fully authoritative targets become safe", async () => {
    const result = await buildGlwCampaignLaunchpadPreflight({ ...common(), readTarget: async (target) => canonical(target) });
    expect(result.readiness).toBe("READY");
    expect(result.maximumSafeReach).toBe(4);
    expect(result.targetAssessments.every((target) => target.primaryDisposition === "SAFE" && target.safe)).toBe(true);
  });

  test("canonical readiness failure produces zero safe reach", async () => {
    const blockedProduct = { ...product, media: { ...product.media, primaryImageReference: null } };
    const result = await buildGlwCampaignLaunchpadPreflight({ ...common({ products: [blockedProduct] }), readTarget: async (target) => canonical(target) });
    expect(result).toMatchObject({ readiness: "AUTHORITY_REQUIRED", maximumSafeReach: 0 });
    expect(result.readinessBlockers).toContainEqual(expect.objectContaining({ code: "PRODUCT_PRIMARY_IMAGE_PRESENT", authoritySource: "PRODUCT_READINESS" }));
  });
});
