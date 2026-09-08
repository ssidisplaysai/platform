import type { GlwPageExecutionRecord } from "../page-execution";
import {
  classifyGlwCampaignOwnership,
  classifyGlwCannibalization,
  classifyGlwExecutionOwnership,
} from "../launchpad-planning-authority";
import { createGlwTargetIntentIdentity, type GlwTargetIntentOwnership } from "../target-intent-authority";

function record(overrides: Partial<GlwPageExecutionRecord> = {}): GlwPageExecutionRecord {
  return {
    jobId: "job-1", correlationId: "job-1", executionTransport: "N8N_MCP", organizationId: "org-1",
    siteId: "site-1", productId: "product-1", productTopic: "Widget", state: "Texas", city: "Dallas",
    slug: "widget/texas/dallas", title: "Widget Dallas", seoTitle: "Widget Dallas", metaDescription: "Widget Dallas",
    publicationIntent: "draft", status: "QUEUED", externalExecutionId: "execution-1", wordpressObjectId: null,
    wordpressUrl: null, wordpressStatus: null, errorCode: null, errorMessage: null, requestedPublicationMode: "draft",
    disposition: null, qaStatus: null, qaChecks: null, qaFailureReasons: null, focusKeyphrase: null,
    wordCount: null, featuredImagePresent: null, createdAt: "2026-01-01", dispatchedAt: null,
    updatedAt: "2026-01-01", completedAt: null, ...overrides,
  };
}

const target = {
  applicationPath: "widget/texas/dallas", canonicalPath: "widget/texas/dallas", canonicalProduct: "Widget",
  canonicalProductSlug: "widget", canonicalSlug: "dallas", canonicalParentId: "5", state: "ABSENT" as const,
  wordpressObjectId: null, wordpressStatus: null, wordpressTitle: null, wordpressUrl: null,
  source: "WORDPRESS_READ" as const, confidence: "AUTHORITATIVE" as const,
};
const matrixCreate = {
  action: "CREATE_CITY" as const, productId: "product-1", stateCode: "TX", citySlug: "dallas",
  canonicalPath: "widget/texas/dallas", externalExecutionAllowed: false as const, reason: "Create Dallas.",
};
const intentIdentity = createGlwTargetIntentIdentity({ siteId: "site-1", productId: "product-1", stateCode: "TX", citySlug: "dallas" });
const clearIntent: GlwTargetIntentOwnership = { classification: "CLEAR", identity: intentIdentity, campaignId: null, targetState: null, reason: "Checked clear.", authoritySource: "GLW_CAMPAIGN_TARGET_INTENT" };
const unavailableIntent: GlwTargetIntentOwnership = { classification: "UNAVAILABLE", identity: intentIdentity, campaignId: null, targetState: null, reason: "Unavailable.", authoritySource: "GLW_CAMPAIGN_TARGET_INTENT" };

describe("GLW Launchpad planning authority", () => {
  test("checked-empty execution authority returns no execution", () => {
    expect(classifyGlwExecutionOwnership({ siteId: "site-1", productId: "product-1", canonicalPath: target.canonicalPath, authority: { status: "CHECKED", records: [] } }).classification).toBe("NO_EXECUTION");
  });

  test("missing execution authority fails closed", () => {
    expect(classifyGlwExecutionOwnership({ siteId: "site-1", productId: "product-1", canonicalPath: target.canonicalPath, authority: { status: "UNAVAILABLE" } }).classification).toBe("UNKNOWN");
  });

  test("keeps job and execution identity separate from campaign identity", () => {
    const execution = classifyGlwExecutionOwnership({ siteId: "site-1", productId: "product-1", canonicalPath: target.canonicalPath, authority: { status: "CHECKED", records: [record({ status: "RUNNING" })] } });
    expect(execution).toMatchObject({ classification: "ACTIVE_EXECUTION", jobId: "job-1", executionId: "execution-1" });
    expect(execution).not.toHaveProperty("campaignId");
  });

  test("campaign authority unavailable returns unknown with no invented campaign ID", () => {
    expect(classifyGlwCampaignOwnership({ canonicalPath: target.canonicalPath, authority: { status: "UNAVAILABLE" } })).toMatchObject({ classification: "UNKNOWN", campaignId: null });
  });

  test("checked campaign authority can independently report an exact owner", () => {
    expect(classifyGlwCampaignOwnership({ canonicalPath: target.canonicalPath, authority: { status: "CHECKED", targets: { [target.canonicalPath]: { checked: true, classification: "OWNED_BY_ACTIVE_CAMPAIGN", campaignId: "campaign-1", campaignState: "ACTIVE", targetState: "GENERATING", reconciled: true, persistenceIdentity: "fixture:1:1", reason: "Campaign owns target.", authoritySource: "CAMPAIGN_PERSISTENCE" } } } })).toMatchObject({ classification: "OWNED_BY_ACTIVE_CAMPAIGN", campaignId: "campaign-1" });
  });

  test("exact canonical absence alone cannot produce global clear", () => {
    expect(classifyGlwCannibalization({ target, matrixPlan: matrixCreate, intentOwnership: unavailableIntent }).classification).toBe("UNAVAILABLE");
  });

  test("matrix parent-state conflict participates in classification", () => {
    expect(classifyGlwCannibalization({ target: { ...target, canonicalParentId: null }, matrixPlan: { ...matrixCreate, action: "BLOCKED_PARENT_STATE", reason: "Exactly one parent state page is required." }, intentOwnership: clearIntent })).toMatchObject({ classification: "PARENT_CHILD_CONFLICT", reason: "Exactly one parent state page is required." });
  });

  test("only all required authoritative checks produce clear", () => {
    const result = classifyGlwCannibalization({ target, matrixPlan: matrixCreate, intentOwnership: clearIntent });
    expect(result.classification).toBe("CLEAR");
    expect(result.checks.every((check) => check.state === "CLEAR")).toBe(true);
  });
});
