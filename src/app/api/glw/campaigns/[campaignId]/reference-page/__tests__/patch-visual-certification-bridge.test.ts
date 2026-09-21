jest.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

const approveGlwCampaignReference = jest.fn();
const recordGlwCampaignLaunchReferenceApproved = jest.fn();

jest.mock("@/modules/foundation/api-auth", () => ({
  authorizeRequest: () => ({ ok: true, status: 200, roles: ["platform_admin"], error: null }),
  forwardOperatorMutationContext: (_request: unknown, headers: Record<string, string>) => headers,
  hasOrganizationScope: () => true,
  resolveRequestScope: () => ({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production" }),
}));
jest.mock("@/modules/foundation/integration-profile-repository", () => ({ listIntegrationProfiles: () => [] }));
jest.mock("@/modules/foundation/product-repository", () => ({
  getProductById: () => ({
    productId: "prod-outdoor-digital-sphere",
    topic: "Outdoor Digital Sphere",
    slug: "outdoor-digital-sphere",
    media: { primaryImageReference: null },
  }),
}));
jest.mock("@/modules/foundation/site-repository", () => ({ getSiteById: () => ({}) }));
jest.mock("@/modules/foundation/wordpress-read-authority-status", () => ({ inspectSiteWordPressReadAuthority: async () => ({ authorityHealthState: "READY" }) }));
jest.mock("@/modules/glw/campaign-reference-repository", () => ({ getGlwCampaignKnowledgePack: () => null }));
jest.mock("@/modules/glw/reference-generation-authority", () => ({
  buildGlwExactRetryContract: () => null,
  generationAuthorityBindingsMatch: () => true,
  resolveGlwReferenceGenerationAuthority: () => null,
}));
jest.mock("@/modules/glw/reference-owner-review-readiness", () => ({
  evaluateGlwReferenceOwnerReviewReadiness: () => ({
    ready: false,
    semantic: { ok: true },
    copyQuality: { ok: true, failures: [] },
    blockers: ["ACTUAL_HOST_VISUAL_CERTIFICATION"],
  }),
}));
jest.mock("@/modules/glw/rich-reference-composition-resolver", () => ({
  resolveGlwRichReferenceReadiness: () => ({ ready: false, blockers: ["RENDERED_VISUAL_CERTIFICATION_REQUIRED"] }),
}));
jest.mock("@/modules/glw/generated-page-review-read-model", () => ({
  buildGeneratedPageReviewModel: async () => ({
    identity: { campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2" },
    wordpress: { objectId: "20240" },
    trace: { jobId: "a1371f29-8952-438d-9ed4-583da68d4fbb" },
    reviewState: "READY_FOR_OWNER_REVIEW",
    productMediaQa: { state: "PASS" },
    images: {
      productAuthority: { state: "RESOLVED_APPROVED" },
      contextualInUse: { state: "LEGACY_FEATURED" },
    },
    visualQa: {
      certificationState: "CURRENT",
      decisionState: "CURRENT",
      overallState: "PASS",
      decision: {
        decision: "APPROVED",
        pageRevisionIdentity: "job:a1371f29-8952-438d-9ed4-583da68d4fbb:2026-09-20T23:48:50.824Z",
        certificationId: "visual-certification-799a467e-286c-49cf-8519-8cb382605f1e",
      },
    },
  }),
}));
jest.mock("@/modules/glw/reference-current-visual-certification-bridge", () => ({
  evaluateReferenceApprovalVisualCertificationBridge: () => ({ ready: true, failedChecks: [] }),
}));
jest.mock("@/modules/glw/reference-state-selection-repository", () => ({ getGlwReferenceStateSelection: () => null, saveGlwReferenceStateSelection: () => null }));
jest.mock("@/modules/glw/reference-owner-live-context", () => ({ resolveGlwReferenceOwnerLiveContext: async () => null }));
jest.mock("@/modules/glw/reference-owner-authority", () => ({
  consumeGlwReferenceOwnerGrant: () => null,
  GlwReferenceOwnerAuthorityError: class extends Error { code = "REFERENCE_OWNER_AUTHORITY_INVALID"; },
}));
jest.mock("@/modules/glw/trusted-operator-principal", () => ({ resolveGlwTrustedOperatorPrincipal: () => ({ ok: true, principal: { principalId: "operator", sessionId: "session", authority: "GENESIS_OPERATOR_SESSION" } }) }));
jest.mock("@/modules/glw/campaign-reference-approval-repository", () => ({
  approveGlwCampaignReference,
  getGlwCampaignReferenceApproval: () => null,
}));
jest.mock("@/modules/glw/campaign-generation-context", () => ({ resolveGlwCampaignGenerationContext: () => null }));
jest.mock("@/modules/glw/campaign-geography", () => ({ GLW_CAMPAIGN_US_STATES: [{ code: "TX", name: "Texas" }] }));
jest.mock("@/modules/glw/campaign-media-policy", () => ({
  evaluateCampaignProductMediaReadiness: () => ({
    approvedProductAuthorityMediaCount: 1,
    approvedContextualMediaCount: 1,
    approvedApplicationMediaCount: 1,
    approvedLocalAtmosphereMediaCount: 0,
  }),
}));
jest.mock("@/modules/glw/campaign-repository", () => ({
  listGlwCampaigns: () => [{
    campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2",
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    productId: "prod-outdoor-digital-sphere",
    pageType: "state_service",
    publicationPolicy: "draft_only",
    status: "draft",
    stateCodes: ["TX"],
  }],
}));
jest.mock("@/modules/glw/campaign-target-repository", () => ({ createGlwCampaignStateTargetId: () => "target" }));
jest.mock("@/modules/glw/reference-continuation-targets", () => ({ ensureDraftCampaignContinuationTarget: () => true }));
jest.mock("@/modules/glw/campaign-launch-authority", () => ({
  recordGlwCampaignLaunchReferenceApproved,
  recordGlwCampaignLaunchReferenceFailure: () => null,
  recordGlwCampaignLaunchReferenceReviewRequired: () => null,
  recordGlwCampaignLaunchReferenceStarted: () => null,
}));
jest.mock("@/modules/glw/page-execution-repository", () => ({
  glwPageExecutionRepository: {
    getById: async () => ({
      jobId: "a1371f29-8952-438d-9ed4-583da68d4fbb",
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
      state: "Texas",
      city: null,
      slug: "outdoor-digital-sphere/texas",
      status: "COMPLETE",
      qaStatus: "COMPLETE",
      wordpressStatus: "draft",
      wordpressObjectId: "20240",
      featuredImagePresent: true,
      productTopic: "Outdoor Digital Sphere",
      generatedDraft: {
        title: "Outdoor Digital Sphere in Texas",
        contentHtml: "<p>content</p>",
        slug: "outdoor-digital-sphere/texas",
        excerpt: null,
        seoTitle: null,
        metaDescription: null,
        focusKeyphrase: null,
      },
      updatedAt: "2026-09-20T23:48:50.824Z",
    }),
    list: async () => [],
  },
}));
jest.mock("@/modules/glw/page-generation", () => ({
  adaptProductForGeneration: () => ({}),
  adaptSiteForGeneration: () => ({}),
  createDefaultGlwGenerationInput: () => ({ slug: "outdoor-digital-sphere/texas" }),
}));
jest.mock("@/modules/glw/product-media-authority", () => ({
  OUTDOOR_DIGITAL_SPHERE_PRODUCT_ID: "prod-outdoor-digital-sphere",
  listProductMediaAuthority: () => [],
}));
jest.mock("@/modules/glw/reference-workflow-state", () => ({
  findEvidenceBoundLegacyReferenceJob: () => null,
  projectGlwDurableReferenceOperation: () => null,
  projectGlwReferenceRetryReadiness: () => ({ targetStateCode: "TX" }),
  projectGlwReferenceWorkflow: () => ({ targetStateCode: "TX" }),
}));
jest.mock("@/modules/glw/n8n-mcp-adapter", () => ({ getGlwN8nMcpConfigurationStatus: () => ({ configured: true }) }));
jest.mock("@/modules/glw/state-localization-contamination", () => ({ GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_VERSION: "v1" }));
jest.mock("@/modules/glw/target-parameterized-rich-reference-production", () => ({ resolveTargetParameterizedRichReferenceProduction: async () => null }));

import { PATCH } from "../route";

describe("reference-page PATCH visual-certification bridge", () => {
  beforeEach(() => {
    approveGlwCampaignReference.mockReset();
    recordGlwCampaignLaunchReferenceApproved.mockReset();
    approveGlwCampaignReference.mockReturnValue({
      campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2",
      stateCode: "TX",
      citySlug: null,
      jobId: "a1371f29-8952-438d-9ed4-583da68d4fbb",
      wordpressObjectId: "20240",
      approvedAt: "2026-09-21T00:00:00.000Z",
    });
  });

  test("successful PATCH still persists through approveGlwCampaignReference", async () => {
    const request = new NextRequest("http://localhost:3004/api/glw/campaigns/campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2/reference-page?organizationId=led-display-warehouse&siteId=site-led-display-warehouse-production", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stateCode: "TX", jobId: "a1371f29-8952-438d-9ed4-583da68d4fbb" }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.approved).toBe(true);
    expect(approveGlwCampaignReference).toHaveBeenCalledTimes(1);
    expect(approveGlwCampaignReference).toHaveBeenCalledWith({
      campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2",
      stateCode: "TX",
      citySlug: null,
      jobId: "a1371f29-8952-438d-9ed4-583da68d4fbb",
      wordpressObjectId: "20240",
    });
  });
});
