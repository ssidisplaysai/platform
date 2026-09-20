jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import type { GlwCampaign } from "@/modules/glw/campaign-types";
import { initializeGlwCampaignTargets, listGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { ensureDraftCampaignContinuationTarget } from "@/modules/glw/reference-continuation-targets";
import { resolveExactContinuationCampaignTarget } from "@/modules/glw/campaign-continuation-target-lookup";

const campaignId = "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2";
const organizationId = "led-display-warehouse";
const siteId = "site-led-display-warehouse-production";
const productId = "prod-outdoor-digital-sphere";
const referenceJobId = "a1371f29-8952-438d-9ed4-583da68d4fbb";
const originalExecutionId = "745222";

const stateCodes = [
  "DE", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE", "NH",
  "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY",
] as const;

function draftCampaign(): GlwCampaign {
  return {
    campaignId,
    organizationId,
    siteId,
    productId,
    name: "Outdoor Digital Sphere Unpublished States V2",
    pageType: "state_service",
    stateCodes,
    pagesPerDay: 1,
    publicationPolicy: "publish_after_gates",
    imageRequired: true,
    status: "draft",
    completedTargetCount: 0,
    failedTargetCount: 0,
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  };
}

function installRouteMocks(input: {
  campaign: GlwCampaign;
  authorizeRequest: jest.Mock;
  consumeGrant: jest.Mock;
}): void {
  const { campaign, authorizeRequest, consumeGrant } = input;
  jest.doMock("@/modules/foundation/api-auth", () => ({
    authorizeRequest,
    resolveRequestScope: () => ({ organizationId, siteId }),
    hasOrganizationScope: () => true,
    forwardOperatorMutationContext: (_request: unknown, headers: Record<string, string>) => headers,
  }));
  jest.doMock("@/modules/foundation/integration-profile-repository", () => ({ listIntegrationProfiles: () => [] }));
  jest.doMock("@/modules/foundation/product-repository", () => ({
    getProductById: () => ({ productId, media: { primaryImageReference: null }, topic: "Outdoor Digital Sphere", slug: "outdoor-digital-sphere" }),
  }));
  jest.doMock("@/modules/foundation/site-repository", () => ({
    getSiteById: () => ({ siteId, organizationId, name: "LED Display Warehouse", domain: "leddisplaywarehouse.com", canonicalUrl: "https://leddisplaywarehouse.com", wordpressApiBaseUrl: "https://leddisplaywarehouse.com/wp-json", integrations: { wordpressCredentialReference: "cred-1" } }),
  }));
  jest.doMock("@/modules/foundation/wordpress-read-authority-status", () => ({
    inspectSiteWordPressReadAuthority: async () => ({ siteId, configuredUsername: "operator", authorityHealthState: "READY" }),
  }));
  jest.doMock("@/modules/glw/campaign-reference-repository", () => ({
    getGlwCampaignKnowledgePack: () => ({ instructions: "approved", references: [], authorityReferences: [] }),
  }));
  jest.doMock("@/modules/glw/reference-generation-authority", () => ({
    generationAuthorityBindingsMatch: () => true,
    resolveGlwReferenceGenerationAuthority: () => ({
      campaignInstructionFingerprint: "a",
      referenceFingerprint: "b",
      productAuthorityFingerprint: "c",
      claimAuthorityFingerprint: "d",
      generatorContractFingerprint: "e",
      localizationPolicyFingerprint: "f",
      n8nWorkflowFingerprint: "g",
      qaPolicyVersion: "v1",
      productAuthorityKnown: true,
      productAuthorityPath: "/outdoor-digital-sphere/",
    }),
    buildGlwExactRetryContract: () => null,
  }));
  jest.doMock("@/modules/glw/reference-owner-live-context", () => ({ resolveGlwReferenceOwnerLiveContext: async () => ({}) }));
  jest.doMock("@/modules/glw/reference-owner-authority", () => ({
    consumeGlwReferenceOwnerGrant: consumeGrant,
    GlwReferenceOwnerAuthorityError: class extends Error {
      code = "REFERENCE_OWNER_AUTHORITY_INVALID";
    },
  }));
  jest.doMock("@/modules/glw/trusted-operator-principal", () => ({
    resolveGlwTrustedOperatorPrincipal: () => ({ ok: true, principal: { operatorId: "trusted-1" } }),
  }));
  jest.doMock("@/modules/glw/campaign-generation-context", () => ({
    resolveGlwCampaignGenerationContext: () => ({ additionalInstructions: "CAMPAIGN REFERENCE PAGE", imageDirection: "", claimContract: "GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_V1", referenceAuthority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } }),
  }));
  jest.doMock("@/modules/glw/campaign-repository", () => ({ listGlwCampaigns: () => [campaign] }));
  jest.doMock("@/modules/glw/page-execution-repository", () => ({
    glwPageExecutionRepository: {
      getById: async () => ({
        jobId: referenceJobId,
        status: "CONTENT_READY",
        errorCode: null,
        generatedDraft: { contentHtml: "<p>ok</p>" },
        organizationId,
        siteId,
        productId,
        state: "Texas",
        city: null,
        slug: "outdoor-digital-sphere/texas",
        publicationIntent: "draft",
        externalExecutionId: originalExecutionId,
        wordpressObjectId: null,
        wordpressStatus: null,
        qaStatus: "CONTENT_READY",
        featuredImagePresent: true,
        updatedAt: "2026-09-20T00:00:00.000Z",
      }),
      list: async () => [],
    },
  }));
  jest.doMock("@/modules/glw/page-generation", () => ({
    adaptSiteForGeneration: (site: { siteId: string; name: string; organizationId: string; domain: string; canonicalUrl: string; wordpressApiBaseUrl: string }) => ({
      siteId: site.siteId,
      name: site.name,
      organizationId: site.organizationId,
      domain: site.domain,
      canonicalUrl: site.canonicalUrl,
      wordpressApiBaseUrl: site.wordpressApiBaseUrl,
    }),
    adaptProductForGeneration: () => ({ productId, siteId, topic: "Outdoor Digital Sphere", slug: "outdoor-digital-sphere" }),
    createDefaultGlwGenerationInput: () => ({
      siteId,
      productId,
      pageType: "state_service",
      stateCode: "TX",
      citySlug: "",
      slug: "outdoor-digital-sphere/texas",
      title: "Outdoor Digital Sphere in Texas",
      seoTitle: "Outdoor Digital Sphere in Texas | LED Display Warehouse",
      metaDescription: "test",
      publicationIntent: "draft",
      plannedOperation: "CREATE_STATE",
    }),
  }));
  jest.doMock("@/modules/glw/product-media-authority", () => ({
    OUTDOOR_DIGITAL_SPHERE_PRODUCT_ID: productId,
    listProductMediaAuthority: () => [],
  }));
  jest.doMock("@/modules/glw/reference-workflow-state", () => ({
    findEvidenceBoundLegacyReferenceJob: () => null,
    projectGlwDurableReferenceOperation: () => null,
    projectGlwReferenceRetryReadiness: (value: unknown) => value,
    projectGlwReferenceWorkflow: () => ({ targetStateCode: "TX" }),
  }));
  jest.doMock("@/modules/glw/n8n-mcp-adapter", () => ({ getGlwN8nMcpConfigurationStatus: () => ({ configured: true }) }));
  jest.doMock("@/modules/glw/rich-reference-composition-resolver", () => ({ resolveGlwRichReferenceReadiness: () => ({ ready: false }) }));
  jest.doMock("@/modules/glw/reference-owner-review-readiness", () => ({ evaluateGlwReferenceOwnerReviewReadiness: () => ({ ready: false }) }));
  jest.doMock("@/modules/glw/reference-state-selection-repository", () => ({
    getGlwReferenceStateSelection: () => null,
    saveGlwReferenceStateSelection: () => null,
  }));
  jest.doMock("@/modules/glw/campaign-reference-approval-repository", () => ({
    approveGlwCampaignReference: () => null,
    getGlwCampaignReferenceApproval: () => null,
  }));
  jest.doMock("@/modules/glw/campaign-launch-authority", () => ({
    recordGlwCampaignLaunchReferenceApproved: () => undefined,
    recordGlwCampaignLaunchReferenceFailure: () => undefined,
    recordGlwCampaignLaunchReferenceReviewRequired: () => undefined,
    recordGlwCampaignLaunchReferenceStarted: () => undefined,
  }));
  jest.doMock("@/modules/glw/target-parameterized-rich-reference-production", () => ({
    resolveTargetParameterizedRichReferenceProduction: async () => null,
  }));
}

describe("reference preactivation continuation route", () => {
  let root: string;
  const originalPersistence = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    root = mkdtempSync(join(tmpdir(), "glw-ref-route-continuation-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalPersistence === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalPersistence;
    rmSync(root, { recursive: true, force: true });
  });

  test("materializes 30 draft selected-state targets before forwarding continuation and remains idempotent", async () => {
    const campaign = draftCampaign();

    const authorizeRequest = jest.fn().mockReturnValue({ ok: true, status: 200, roles: ["platform_admin"], error: null });
    const consumeGrant = jest.fn().mockReturnValue({
      claimId: "claim-1",
      operationType: "REFERENCE_GENERATION_INITIAL",
      failedJobId: null,
      failedArtifactSha256: null,
    });
    installRouteMocks({ campaign, authorizeRequest, consumeGrant });

    expect(campaign.status).toBe("draft");
    expect(listGlwCampaignTargets(campaignId)).toHaveLength(0);

    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        action?: string;
        jobId?: string;
      };
      expect(body.action).toBe("continue");
      expect(body.jobId).toBe(referenceJobId);

      const afterInitTargets = listGlwCampaignTargets(campaignId);
      expect(afterInitTargets).toHaveLength(30);
      expect(afterInitTargets.some((target) => target.stateCode === "TX" && target.citySlug === null)).toBe(true);
      const referenceTarget = afterInitTargets.find((target) => target.stateCode === "TX" && target.citySlug === null);
      expect(referenceTarget?.status).toBe("content_ready");
      expect(afterInitTargets.filter((target) => target.status === "queued")).toHaveLength(29);

      const lookup = resolveExactContinuationCampaignTarget({
        targets: afterInitTargets,
        campaignId,
        organizationId,
        siteId,
        productId,
        expectedStateCode: "TX",
        expectedCitySlug: null,
        expectedJobId: referenceJobId,
        expectedExecutionId: originalExecutionId,
        actualExecutionId: originalExecutionId,
      });
      expect(lookup.ok).toBe(true);

      return new Response(JSON.stringify({
        job: {
          jobId: referenceJobId,
          status: "CONTENT_READY",
          externalExecutionId: originalExecutionId,
          wordpressObjectId: null,
          wordpressStatus: null,
        },
        schedulerEnabled: false,
        dispatchPerformed: false,
        generationJobCreated: false,
        wordpressMutationPerformed: false,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const { POST } = await import("@/app/api/glw/campaigns/[campaignId]/reference-page/route");

    const binding = {
      campaignInstructionFingerprint: "a",
      referenceFingerprint: "b",
      productAuthorityFingerprint: "c",
      claimAuthorityFingerprint: "d",
      generatorContractFingerprint: "e",
      localizationPolicyFingerprint: "f",
      n8nWorkflowFingerprint: "g",
      qaPolicyVersion: "v1",
    };

    const request = new NextRequest(
      `http://localhost:3004/api/glw/campaigns/${campaignId}/reference-page`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gcp-roles": "platform_admin",
          "x-gcp-organization-id": organizationId,
          "x-gcp-site-id": siteId,
        },
        body: JSON.stringify({
          action: "continue",
          stateCode: "TX",
          citySlug: null,
          jobId: referenceJobId,
          referenceAuthorityBinding: binding,
          ownerGrantId: "grant-1",
          preflightReceiptId: "preflight-1",
          ownerOperationType: "REFERENCE_GENERATION_INITIAL",
          failedJobId: null,
          failedArtifactSha256: null,
        }),
      },
    );

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(consumeGrant).toHaveBeenCalledTimes(1);
    expect(authorizeRequest).toHaveBeenCalledTimes(1);
    expect(payload.state?.code).toBe("TX");
    expect(payload.schedulerEnabled).toBe(false);
    expect(payload.dispatchPerformed).toBe(false);
    expect(payload.generationJobCreated).toBe(false);
    expect(payload.wordpressMutationPerformed).toBe(false);

    const after = listGlwCampaignTargets(campaignId);
    expect(after).toHaveLength(30);
    expect(after.some((target) => target.stateCode === "TX" && target.citySlug === null)).toBe(true);
    expect(campaign.status).toBe("draft");

    expect(ensureDraftCampaignContinuationTarget({
      campaign,
      targetStateCode: "TX",
      targetCitySlug: null,
      referenceJobId,
      referenceJobStatus: "CONTENT_READY",
      referenceWordpressObjectId: null,
    })).toBe(true);
    const second = listGlwCampaignTargets(campaignId);
    expect(second).toHaveLength(30);
    expect(new Set(second.map((target) => target.targetId)).size).toBe(30);
  });

  test("transitions an existing reference_complete target to content_ready on reentry before continuation forwarding", async () => {
    const campaign = draftCampaign();

    const authorizeRequest = jest.fn().mockReturnValue({ ok: true, status: 200, roles: ["platform_admin"], error: null });
    const consumeGrant = jest.fn().mockReturnValue({
      claimId: "claim-1",
      operationType: "REFERENCE_GENERATION_INITIAL",
      failedJobId: null,
      failedArtifactSha256: null,
    });

    installRouteMocks({ campaign, authorizeRequest, consumeGrant });

    initializeGlwCampaignTargets({
      campaignId,
      organizationId,
      siteId,
      productId,
      stateCodes,
      referenceStateCode: "TX",
      referenceJobId,
      referenceWordpressObjectId: null,
    });

    const before = listGlwCampaignTargets(campaignId);
    expect(before).toHaveLength(30);
    const beforeTx = before.find((target) => target.stateCode === "TX" && target.citySlug === null);
    expect(beforeTx?.status).toBe("reference_complete");
    expect(beforeTx?.jobId).toBe(referenceJobId);
    expect(before.filter((target) => target.status === "queued")).toHaveLength(29);

    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        action?: string;
        jobId?: string;
      };
      expect(body.action).toBe("continue");
      expect(body.jobId).toBe(referenceJobId);

      const afterEnsureTargets = listGlwCampaignTargets(campaignId);
      expect(afterEnsureTargets).toHaveLength(30);
      const tx = afterEnsureTargets.find((target) => target.stateCode === "TX" && target.citySlug === null);
      expect(tx?.status).toBe("content_ready");
      expect(afterEnsureTargets.filter((target) => target.status === "queued")).toHaveLength(29);

      const lookup = resolveExactContinuationCampaignTarget({
        targets: afterEnsureTargets,
        campaignId,
        organizationId,
        siteId,
        productId,
        expectedStateCode: "TX",
        expectedCitySlug: null,
        expectedJobId: referenceJobId,
        expectedExecutionId: originalExecutionId,
        actualExecutionId: originalExecutionId,
      });
      expect(lookup.ok).toBe(true);

      return new Response(JSON.stringify({
        job: {
          jobId: referenceJobId,
          status: "CONTENT_READY",
          externalExecutionId: originalExecutionId,
          wordpressObjectId: null,
          wordpressStatus: null,
        },
        schedulerEnabled: false,
        dispatchPerformed: false,
        generationJobCreated: false,
        wordpressMutationPerformed: false,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const { POST } = await import("@/app/api/glw/campaigns/[campaignId]/reference-page/route");

    const binding = {
      campaignInstructionFingerprint: "a",
      referenceFingerprint: "b",
      productAuthorityFingerprint: "c",
      claimAuthorityFingerprint: "d",
      generatorContractFingerprint: "e",
      localizationPolicyFingerprint: "f",
      n8nWorkflowFingerprint: "g",
      qaPolicyVersion: "v1",
    };

    const request = new NextRequest(
      `http://localhost:3004/api/glw/campaigns/${campaignId}/reference-page`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gcp-roles": "platform_admin",
          "x-gcp-organization-id": organizationId,
          "x-gcp-site-id": siteId,
        },
        body: JSON.stringify({
          action: "continue",
          stateCode: "TX",
          citySlug: null,
          jobId: referenceJobId,
          referenceAuthorityBinding: binding,
          ownerGrantId: "grant-1",
          preflightReceiptId: "preflight-1",
          ownerOperationType: "REFERENCE_GENERATION_INITIAL",
          failedJobId: null,
          failedArtifactSha256: null,
        }),
      },
    );

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(consumeGrant).toHaveBeenCalledTimes(1);
    expect(authorizeRequest).toHaveBeenCalledTimes(1);
    expect(payload.state?.code).toBe("TX");
    expect(payload.schedulerEnabled).toBe(false);
    expect(payload.dispatchPerformed).toBe(false);
    expect(payload.generationJobCreated).toBe(false);
    expect(payload.wordpressMutationPerformed).toBe(false);

    const after = listGlwCampaignTargets(campaignId);
    expect(after).toHaveLength(30);
    const afterTx = after.find((target) => target.stateCode === "TX" && target.citySlug === null);
    expect(afterTx?.status).toBe("content_ready");
    expect(after.filter((target) => target.status === "queued")).toHaveLength(29);
    expect(new Set(after.map((target) => target.targetId)).size).toBe(30);
  });
});