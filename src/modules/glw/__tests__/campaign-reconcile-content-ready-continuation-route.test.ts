jest.mock("server-only", () => ({}));

jest.mock("@/modules/foundation/api-auth", () => ({
  authorizeRequest: jest.fn(() => ({ ok: true })),
  forwardOperatorMutationContext: jest.fn((_request, headers) => headers),
  hasOrganizationScope: jest.fn(() => true),
  resolveRequestScope: jest.fn(() => ({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production" })),
}));

jest.mock("@/modules/glw/campaign-repository", () => ({
  listGlwCampaigns: jest.fn(),
}));

jest.mock("@/modules/glw/campaign-target-repository", () => ({
  listGlwCampaignTargets: jest.fn(),
  markGlwCampaignTargetDraftReady: jest.fn(),
  markGlwCampaignTargetFailed: jest.fn(),
  markGlwFailedCampaignTargetDraftReady: jest.fn(),
  reconcileGlwCampaignTargetContentReady: jest.fn(),
  releaseExpiredGlwCampaignTargetLeases: jest.fn(() => 0),
  requeueGlwCampaignTargetAfterPreExecutionFailure: jest.fn(),
  reconcileGlwContentReadyTargetDraft: jest.fn(),
}));

jest.mock("@/modules/glw/page-execution-repository", () => ({
  glwPageExecutionRepository: {
    getById: jest.fn(),
  },
}));

jest.mock("@/modules/glw/campaign-target-reconciliation", () => ({
  resolveGlwCampaignJobReconciliationDecision: jest.fn(),
}));

jest.mock("@/modules/glw/campaign-production-generation", () => ({
  buildGlwCampaignProductionGenerationForm: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/glw/campaigns/[campaignId]/reconcile/route";
import {
  authorizeRequest,
  forwardOperatorMutationContext,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import {
  listGlwCampaignTargets,
  reconcileGlwContentReadyTargetDraft,
} from "@/modules/glw/campaign-target-repository";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { resolveGlwCampaignJobReconciliationDecision } from "@/modules/glw/campaign-target-reconciliation";
import { buildGlwCampaignProductionGenerationForm } from "@/modules/glw/campaign-production-generation";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("campaign reconcile exact content-ready continuation route", () => {
  const campaignId = "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview";
  const targetId = "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-fl";
  const jobId = "5d877113-638a-40d0-9252-6390ec97c837";
  const executionId = "691948";

  beforeEach(() => {
    jest.resetAllMocks();

    (authorizeRequest as jest.Mock).mockReturnValue({ ok: true });
    (hasOrganizationScope as jest.Mock).mockReturnValue(true);
    (resolveRequestScope as jest.Mock).mockReturnValue({
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
    });
    (forwardOperatorMutationContext as jest.Mock).mockImplementation(
      (_request, headers) => headers,
    );

    (listGlwCampaigns as jest.Mock).mockReturnValue([
      {
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        pageType: "state_service",
        stateCodes: ["FL"],
        publicationPolicy: "publish_after_gates",
        status: "active",
      },
    ]);

    (listGlwCampaignTargets as jest.Mock).mockReturnValue([
      {
        targetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "FL",
        citySlug: null,
        cityName: null,
        status: "content_ready",
        jobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
    ]);

    (glwPageExecutionRepository.getById as jest.Mock).mockResolvedValue({
      jobId,
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
      status: "CONTENT_READY",
      externalExecutionId: executionId,
      wordpressObjectId: null,
      wordpressStatus: null,
      generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "outdoor-digital-sphere/florida", excerpt: "x" },
    });

    (buildGlwCampaignProductionGenerationForm as jest.Mock).mockReturnValue({
      form: {
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "FL",
        stateName: "Florida",
        citySlug: "",
        cityName: "",
        pageType: "state_service",
        title: "Outdoor Digital Sphere in Florida",
        seoTitle: "Outdoor Digital Sphere in Florida | LEDDisplayWarehouse.com",
        metaDescription: "x",
        publicationIntent: "draft",
        plannedOperation: "CREATE_STATE",
        canonicalPath: "outdoor-digital-sphere/florida",
        productTopic: "Outdoor Digital Sphere",
        campaignId,
      },
    });

    (resolveGlwCampaignJobReconciliationDecision as jest.Mock).mockImplementation((job: { status: string; wordpressObjectId?: string | null; wordpressStatus?: string | null }) => {
      if (job.status === "CONTENT_READY") return { action: "continue" };
      if (job.status === "COMPLETE" && job.wordpressStatus === "draft" && job.wordpressObjectId) {
        return { action: "draft_ready", wordpressObjectId: String(job.wordpressObjectId) };
      }
      if (job.status === "FAILED") return { action: "failed", error: "failed" };
      return { action: "wait" };
    });
  });

  test("fails closed when continuation responds 200 without durable draft persistence", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ job: { status: "CONTENT_READY", externalExecutionId: executionId, wordpressObjectId: null, wordpressStatus: null } }, 200))
      .mockResolvedValueOnce(jsonResponse({ ok: false, error: "Continuation did not durably persist a WordPress draft.", job: { status: "CONTENT_READY", externalExecutionId: executionId, wordpressObjectId: null, wordpressStatus: null } }, 200));

    global.fetch = fetchMock as unknown as typeof fetch;

    const request = new NextRequest("http://localhost/api/glw/campaigns/" + campaignId + "/reconcile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gcp-organization-id": "led-display-warehouse",
        "x-gcp-site-id": "site-led-display-warehouse-production",
      },
      body: JSON.stringify({
        confirm: "RECONCILE_EXISTING_DRAFT_BATCH",
        targetId,
        jobId,
        executionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toContain("durably persist a WordPress draft");
    expect(payload.results[0]).toMatchObject({ action: "continue_error" });

    const continueRequestBody = JSON.parse((fetchMock.mock.calls[1]?.[1] as { body?: string })?.body ?? "{}");
    expect(continueRequestBody).toMatchObject({
      action: "continue",
      targetId,
      jobId,
      executionId,
    });
  });

  test("reconciles to draft_ready when continuation returns durable draft completion", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ job: { status: "CONTENT_READY", externalExecutionId: executionId, wordpressObjectId: null, wordpressStatus: null } }, 200))
      .mockResolvedValueOnce(jsonResponse({ ok: true, job: { status: "COMPLETE", externalExecutionId: executionId, wordpressObjectId: "20199", wordpressStatus: "draft" } }, 200));

    global.fetch = fetchMock as unknown as typeof fetch;

    (reconcileGlwContentReadyTargetDraft as jest.Mock).mockReturnValue({
      targetId,
      campaignId,
      stateCode: "FL",
      citySlug: null,
      status: "draft_ready",
      jobId,
      wordpressObjectId: "20199",
    });

    const request = new NextRequest("http://localhost/api/glw/campaigns/" + campaignId + "/reconcile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gcp-organization-id": "led-display-warehouse",
        "x-gcp-site-id": "site-led-display-warehouse-production",
      },
      body: JSON.stringify({
        confirm: "RECONCILE_EXISTING_DRAFT_BATCH",
        targetId,
        jobId,
        executionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results[0]).toMatchObject({
      action: "draft_ready",
      wordpressObjectId: "20199",
      executionIdAfter: executionId,
    });
    expect(reconcileGlwContentReadyTargetDraft).toHaveBeenCalledWith(expect.objectContaining({
      campaignId,
      targetId,
      stateCode: "FL",
      jobId,
      wordpressObjectId: "20199",
    }));
  });
});
