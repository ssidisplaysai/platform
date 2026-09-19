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

jest.mock("@/modules/foundation/authenticated-wordpress-read-authority", () => ({
  createAuthenticatedWordPressReadAuthority: jest.fn(),
}));

jest.mock("@/modules/foundation/site-repository", () => ({
  getSiteById: jest.fn(),
}));

jest.mock("@/modules/foundation/wordpress-credential-resolver", () => ({
  resolveWordPressCredentialReference: jest.fn(),
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
  markGlwCampaignTargetDraftReady,
  markGlwCampaignTargetFailed,
  markGlwFailedCampaignTargetDraftReady,
  reconcileGlwCampaignTargetContentReady,
  reconcileGlwContentReadyTargetDraft,
} from "@/modules/glw/campaign-target-repository";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { resolveGlwCampaignJobReconciliationDecision } from "@/modules/glw/campaign-target-reconciliation";
import { buildGlwCampaignProductionGenerationForm } from "@/modules/glw/campaign-production-generation";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("campaign reconcile exact content-ready continuation route", () => {
  const campaignId = "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview";
  const gaTargetId = "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-ga";
  const gaJobId = "cb4684bf-477c-45f2-98c3-a37717368b83";
  const gaExecutionId = "703853";
  const deTargetId = "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-de";
  const deJobId = "67b15376-563c-42b7-8fee-b2f2139b114b";
  const deExecutionId = "686290";

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
        targetId: gaTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "running",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
      {
        targetId: deTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "DE",
        citySlug: null,
        cityName: null,
        status: "content_ready",
        jobId: deJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
    ]);

    (glwPageExecutionRepository.getById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === gaJobId) {
        return {
          jobId: gaJobId,
          organizationId: "led-display-warehouse",
          siteId: "site-led-display-warehouse-production",
          productId: "prod-outdoor-digital-sphere",
          status: "CONTENT_READY",
          externalExecutionId: gaExecutionId,
          wordpressObjectId: null,
          wordpressStatus: null,
          generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "outdoor-digital-sphere/georgia", excerpt: "x" },
        };
      }
      if (id === deJobId) {
        return {
          jobId: deJobId,
          organizationId: "led-display-warehouse",
          siteId: "site-led-display-warehouse-production",
          productId: "prod-outdoor-digital-sphere",
          status: "CONTENT_READY",
          externalExecutionId: deExecutionId,
          wordpressObjectId: null,
          wordpressStatus: null,
          generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "outdoor-digital-sphere/delaware", excerpt: "x" },
        };
      }
      return null;
    });

    (buildGlwCampaignProductionGenerationForm as jest.Mock).mockReturnValue({
      form: {
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "FL",
        stateName: "Georgia",
        citySlug: "",
        cityName: "",
        pageType: "state_service",
        title: "Outdoor Digital Sphere in Georgia",
        seoTitle: "Outdoor Digital Sphere in Georgia | LEDDisplayWarehouse.com",
        metaDescription: "x",
        publicationIntent: "draft",
        plannedOperation: "CREATE_STATE",
        canonicalPath: "outdoor-digital-sphere/georgia",
        productTopic: "Outdoor Digital Sphere",
        campaignId,
      },
    });

    (getSiteById as jest.Mock).mockReturnValue({
      siteId: "site-led-display-warehouse-production",
      organizationId: "led-display-warehouse",
      integrations: {
        wordpressApiBaseUrl: "https://leddisplaywarehouse.com/wp-json/wp/v2",
        wordpressCredentialReference: "cred-ldw",
      },
    });
    (resolveWordPressCredentialReference as jest.Mock).mockReturnValue({
      username: "u",
      applicationPassword: "p",
    });
    (createAuthenticatedWordPressReadAuthority as jest.Mock).mockReturnValue({
      getJson: jest.fn(async ({ path }: { path: string }) => {
        const wordpressObjectId = String(path).split("/").at(-1) ?? "20199";
        return {
          ok: true,
          body: {
            id: Number(wordpressObjectId),
            status: "draft",
            slug: "georgia",
            parent: 20114,
          },
        };
      }),
    });

    (markGlwCampaignTargetFailed as jest.Mock).mockImplementation(({ campaignId: sourceCampaignId, stateCode, citySlug, jobId, error }: {
      campaignId: string;
      stateCode: string;
      citySlug?: string | null;
      jobId: string;
      error: string;
    }) => ({
      campaignId: sourceCampaignId,
      stateCode,
      citySlug: citySlug ?? null,
      jobId,
      status: "failed",
      lastError: error,
    }));

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
      .mockResolvedValueOnce(jsonResponse({ job: { status: "CONTENT_READY", externalExecutionId: gaExecutionId, wordpressObjectId: null, wordpressStatus: null } }, 200))
      .mockResolvedValueOnce(jsonResponse({ ok: false, error: "Continuation did not durably persist a WordPress draft.", job: { status: "CONTENT_READY", externalExecutionId: gaExecutionId, wordpressObjectId: null, wordpressStatus: null } }, 200));

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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: gaExecutionId,
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
      targetId: gaTargetId,
      jobId: gaJobId,
      executionId: gaExecutionId,
    });
    expect(reconcileGlwCampaignTargetContentReady).not.toHaveBeenCalled();
  });

  test("exact running DISPATCHED target returns wait with HTTP 200 and stays exact scoped", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ job: { status: "DISPATCHED", externalExecutionId: gaExecutionId, wordpressObjectId: null, wordpressStatus: null } }, 200));

    global.fetch = fetchMock as unknown as typeof fetch;

    (glwPageExecutionRepository.getById as jest.Mock).mockResolvedValue({
      jobId: gaJobId,
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
      status: "DISPATCHED",
      externalExecutionId: gaExecutionId,
      wordpressObjectId: null,
      wordpressStatus: null,
      generatedDraft: null,
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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: gaExecutionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results[0]).toMatchObject({
      action: "wait",
      stateCode: "GA",
      jobId: gaJobId,
      generationStatus: "DISPATCHED",
    });
    expect(markGlwCampaignTargetDraftReady).not.toHaveBeenCalled();
    expect(reconcileGlwCampaignTargetContentReady).not.toHaveBeenCalled();
    expect(markGlwCampaignTargetFailed).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.every((url) => !url.includes(deJobId))).toBe(true);
  });

  test("exact GA running + CONTENT_READY with expired lease reconciles lease and remains eligible for continuation", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ job: { status: "CONTENT_READY", externalExecutionId: gaExecutionId, wordpressObjectId: null, wordpressStatus: null } }, 200))
      .mockResolvedValueOnce(jsonResponse({ ok: true, job: { status: "COMPLETE", externalExecutionId: gaExecutionId, wordpressObjectId: "20199", wordpressStatus: "draft", slug: "outdoor-digital-sphere/georgia" } }, 200));

    global.fetch = fetchMock as unknown as typeof fetch;

    (listGlwCampaignTargets as jest.Mock).mockReturnValue([
      {
        targetId: gaTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "running",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: "lease-ga-expired",
      },
      {
        targetId: deTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "DE",
        citySlug: null,
        cityName: null,
        status: "content_ready",
        jobId: deJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
    ]);

    (reconcileGlwCampaignTargetContentReady as jest.Mock).mockReturnValue({
      target: {
        targetId: gaTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "content_ready",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
      leaseHistory: {
        leaseId: "lease-ga-expired",
      },
    });

    (reconcileGlwContentReadyTargetDraft as jest.Mock).mockReturnValue({
      targetId: gaTargetId,
      campaignId,
      stateCode: "GA",
      citySlug: null,
      status: "draft_ready",
      jobId: gaJobId,
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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: gaExecutionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results[0]).toMatchObject({ action: "draft_ready", stateCode: "GA", wordpressObjectId: "20199" });
    expect(reconcileGlwCampaignTargetContentReady).toHaveBeenCalledWith(expect.objectContaining({
      campaignId,
      targetId: gaTargetId,
      stateCode: "GA",
      jobId: gaJobId,
      leaseId: "lease-ga-expired",
      externalExecutionId: gaExecutionId,
    }));
    expect(reconcileGlwContentReadyTargetDraft).toHaveBeenCalledWith(expect.objectContaining({
      campaignId,
      targetId: gaTargetId,
      stateCode: "GA",
      jobId: gaJobId,
      wordpressObjectId: "20199",
      canonicalIdentity: {
        canonicalPath: "outdoor-digital-sphere/georgia",
        applicationPath: "outdoor-digital-sphere/georgia",
        canonicalParentId: "20114",
      },
    }));
    expect(markGlwCampaignTargetDraftReady).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const continueRequestBody = JSON.parse((fetchMock.mock.calls[1]?.[1] as { body?: string })?.body ?? "{}");
    expect(continueRequestBody).toMatchObject({ action: "continue", targetId: gaTargetId, jobId: gaJobId, executionId: gaExecutionId });
  });

  test("fails closed before draft_ready when canonical identity cannot be proven", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ job: { status: "CONTENT_READY", externalExecutionId: gaExecutionId, wordpressObjectId: null, wordpressStatus: null } }, 200))
      .mockResolvedValueOnce(jsonResponse({ ok: true, job: { status: "COMPLETE", externalExecutionId: gaExecutionId, wordpressObjectId: "20199", wordpressStatus: "draft", slug: "outdoor-digital-sphere/georgia" } }, 200));

    global.fetch = fetchMock as unknown as typeof fetch;

    (buildGlwCampaignProductionGenerationForm as jest.Mock).mockReturnValue({
      form: {
        publicationIntent: "draft",
        canonicalPath: "outdoor-digital-sphere/florida",
      },
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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: gaExecutionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.results[0]).toMatchObject({ action: "failed", error: "DRAFT_READY_CANONICAL_PATH_REQUIRED" });
    expect(markGlwCampaignTargetDraftReady).not.toHaveBeenCalled();
    expect(reconcileGlwContentReadyTargetDraft).not.toHaveBeenCalled();
  });

  test("exact GA running + CONTENT_READY with unexpired lease fails closed", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    (listGlwCampaignTargets as jest.Mock).mockReturnValue([
      {
        targetId: gaTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "running",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: "lease-ga-active",
      },
    ]);

    (reconcileGlwCampaignTargetContentReady as jest.Mock).mockImplementation(() => {
      throw new Error("GLW_TARGET_LEASE_NOT_EXPIRED");
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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: gaExecutionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toContain("lease is still active");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("exact GA running + CONTENT_READY continuation reaches draft_ready and leaves DE untouched", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ job: { status: "CONTENT_READY", externalExecutionId: gaExecutionId, wordpressObjectId: null, wordpressStatus: null } }, 200))
      .mockResolvedValueOnce(jsonResponse({ ok: true, job: { status: "COMPLETE", externalExecutionId: gaExecutionId, wordpressObjectId: "20199", wordpressStatus: "draft", slug: "outdoor-digital-sphere/georgia" } }, 200));

    global.fetch = fetchMock as unknown as typeof fetch;

    (markGlwCampaignTargetDraftReady as jest.Mock).mockReturnValue({
      targetId: gaTargetId,
      campaignId,
      stateCode: "GA",
      citySlug: null,
      status: "draft_ready",
      jobId: gaJobId,
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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: gaExecutionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results[0]).toMatchObject({
      action: "draft_ready",
      wordpressObjectId: "20199",
      executionIdAfter: gaExecutionId,
    });
    expect(markGlwCampaignTargetDraftReady).toHaveBeenCalledWith(expect.objectContaining({
      campaignId,
      stateCode: "GA",
      jobId: gaJobId,
      wordpressObjectId: "20199",
    }));
    expect(reconcileGlwContentReadyTargetDraft).not.toHaveBeenCalled();
    expect(reconcileGlwCampaignTargetContentReady).not.toHaveBeenCalled();
    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.every((url) => !url.includes(deJobId))).toBe(true);
  });

  test("exact GA failed ZERO_AUTHORITY_CANONICALIZATION_BLOCKED with generatedDraft continues and leaves DE untouched", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ job: { status: "FAILED", errorCode: "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED", externalExecutionId: gaExecutionId, wordpressObjectId: null, wordpressStatus: null, generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "outdoor-digital-sphere/georgia", excerpt: "x" } } }, 200))
      .mockResolvedValueOnce(jsonResponse({ ok: true, job: { status: "COMPLETE", externalExecutionId: gaExecutionId, wordpressObjectId: "20199", wordpressStatus: "draft", slug: "outdoor-digital-sphere/georgia" } }, 200));

    global.fetch = fetchMock as unknown as typeof fetch;

    (listGlwCampaignTargets as jest.Mock).mockReturnValue([
      {
        targetId: gaTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "failed",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: "blocked",
        leaseId: null,
      },
      {
        targetId: deTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "DE",
        citySlug: null,
        cityName: null,
        status: "content_ready",
        jobId: deJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
    ]);

    (glwPageExecutionRepository.getById as jest.Mock).mockImplementation(async (id: string) => {
      if (id !== gaJobId) return null;
      return {
        jobId: gaJobId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        status: "FAILED",
        errorCode: "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED",
        externalExecutionId: gaExecutionId,
        wordpressObjectId: null,
        wordpressStatus: null,
        generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "outdoor-digital-sphere/georgia", excerpt: "x" },
      };
    });

    (markGlwFailedCampaignTargetDraftReady as jest.Mock).mockReturnValue({
      targetId: gaTargetId,
      campaignId,
      stateCode: "GA",
      citySlug: null,
      status: "draft_ready",
      jobId: gaJobId,
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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: gaExecutionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results[0]).toMatchObject({ action: "draft_ready", stateCode: "GA", wordpressObjectId: "20199" });
    expect(markGlwFailedCampaignTargetDraftReady).toHaveBeenCalledWith(expect.objectContaining({
      campaignId,
      stateCode: "GA",
      jobId: gaJobId,
      wordpressObjectId: "20199",
    }));
    expect(markGlwCampaignTargetDraftReady).not.toHaveBeenCalled();
    const continueRequestBody = JSON.parse((fetchMock.mock.calls[1]?.[1] as { body?: string })?.body ?? "{}");
    expect(continueRequestBody).toMatchObject({ action: "continue", targetId: gaTargetId, jobId: gaJobId, executionId: gaExecutionId });
    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.every((url) => !url.includes(deJobId))).toBe(true);
  });

  test("exact GA content_ready target with FAILED ZERO_AUTHORITY + generatedDraft continues via exact recovery branch", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ job: { status: "FAILED", errorCode: "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED", externalExecutionId: gaExecutionId, wordpressObjectId: null, wordpressStatus: null, generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "outdoor-digital-sphere/georgia", excerpt: "x" } } }, 200))
      .mockResolvedValueOnce(jsonResponse({ ok: true, job: { status: "COMPLETE", externalExecutionId: gaExecutionId, wordpressObjectId: "20199", wordpressStatus: "draft", slug: "outdoor-digital-sphere/georgia" } }, 200));

    global.fetch = fetchMock as unknown as typeof fetch;

    (listGlwCampaignTargets as jest.Mock).mockReturnValue([
      {
        targetId: gaTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "content_ready",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
      {
        targetId: deTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "DE",
        citySlug: null,
        cityName: null,
        status: "content_ready",
        jobId: deJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
    ]);

    (glwPageExecutionRepository.getById as jest.Mock).mockResolvedValue({
      jobId: gaJobId,
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
      status: "FAILED",
      errorCode: "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED",
      externalExecutionId: gaExecutionId,
      wordpressObjectId: null,
      wordpressStatus: null,
      generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "outdoor-digital-sphere/georgia", excerpt: "x" },
    });

    (reconcileGlwContentReadyTargetDraft as jest.Mock).mockReturnValue({
      targetId: gaTargetId,
      campaignId,
      stateCode: "GA",
      citySlug: null,
      status: "draft_ready",
      jobId: gaJobId,
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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: gaExecutionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results[0]).toMatchObject({ action: "draft_ready", stateCode: "GA", wordpressObjectId: "20199" });
    expect(reconcileGlwContentReadyTargetDraft).toHaveBeenCalledWith(expect.objectContaining({
      campaignId,
      targetId: gaTargetId,
      stateCode: "GA",
      jobId: gaJobId,
      wordpressObjectId: "20199",
    }));
    expect(markGlwFailedCampaignTargetDraftReady).not.toHaveBeenCalled();
    const continueRequestBody = JSON.parse((fetchMock.mock.calls[1]?.[1] as { body?: string })?.body ?? "{}");
    expect(continueRequestBody).toMatchObject({ action: "continue", targetId: gaTargetId, jobId: gaJobId, executionId: gaExecutionId });
    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.every((url) => !url.includes(deJobId))).toBe(true);
  });

  test("exact content_ready target with unrelated FAILED error remains rejected", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    (listGlwCampaignTargets as jest.Mock).mockReturnValue([
      {
        targetId: gaTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "content_ready",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
    ]);

    (glwPageExecutionRepository.getById as jest.Mock).mockResolvedValue({
      jobId: gaJobId,
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
      status: "FAILED",
      errorCode: "GENERATED_CONTENT_QA_FAILED",
      externalExecutionId: gaExecutionId,
      wordpressObjectId: null,
      wordpressStatus: null,
      generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "outdoor-digital-sphere/georgia", excerpt: "x" },
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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: gaExecutionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("content-ready target has a failed job that is not recoverable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("exact content_ready OUTDOOR_SPHERE recoverable partial draft continues and updates the same draft object", async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ job: { status: "CONTENT_READY", errorCode: "OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED", externalExecutionId: gaExecutionId, wordpressObjectId: "20169", wordpressStatus: "draft", generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "outdoor-digital-sphere/georgia", excerpt: "x" } } }, 200))
      .mockResolvedValueOnce(jsonResponse({ ok: true, job: { status: "COMPLETE", externalExecutionId: gaExecutionId, wordpressObjectId: "20169", wordpressStatus: "draft", slug: "outdoor-digital-sphere/georgia" } }, 200));

    global.fetch = fetchMock as unknown as typeof fetch;

    (listGlwCampaignTargets as jest.Mock).mockReturnValue([
      {
        targetId: gaTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "content_ready",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
      {
        targetId: deTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "DE",
        citySlug: null,
        cityName: null,
        status: "content_ready",
        jobId: deJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
    ]);

    (glwPageExecutionRepository.getById as jest.Mock).mockResolvedValue({
      jobId: gaJobId,
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
      status: "CONTENT_READY",
      errorCode: "OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED",
      externalExecutionId: gaExecutionId,
      wordpressObjectId: "20169",
      wordpressStatus: "draft",
      generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "outdoor-digital-sphere/georgia", excerpt: "x" },
    });

    (reconcileGlwContentReadyTargetDraft as jest.Mock).mockReturnValue({
      targetId: gaTargetId,
      campaignId,
      stateCode: "GA",
      citySlug: null,
      status: "draft_ready",
      jobId: gaJobId,
      wordpressObjectId: "20169",
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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: gaExecutionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results[0]).toMatchObject({ action: "draft_ready", stateCode: "GA", wordpressObjectId: "20169" });
    expect(reconcileGlwContentReadyTargetDraft).toHaveBeenCalledWith(expect.objectContaining({
      campaignId,
      targetId: gaTargetId,
      stateCode: "GA",
      jobId: gaJobId,
      wordpressObjectId: "20169",
    }));
    expect(markGlwFailedCampaignTargetDraftReady).not.toHaveBeenCalled();
    expect(markGlwCampaignTargetDraftReady).not.toHaveBeenCalled();
    const continueRequestBody = JSON.parse((fetchMock.mock.calls[1]?.[1] as { body?: string })?.body ?? "{}");
    expect(continueRequestBody).toMatchObject({ action: "continue", targetId: gaTargetId, jobId: gaJobId, executionId: gaExecutionId });
    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.every((url) => !url.includes(deJobId))).toBe(true);
  });

  test("exact content_ready target with unexpected WordPress identity remains rejected", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    (listGlwCampaignTargets as jest.Mock).mockReturnValue([
      {
        targetId: gaTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "content_ready",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
    ]);

    (glwPageExecutionRepository.getById as jest.Mock).mockResolvedValue({
      jobId: gaJobId,
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
      status: "CONTENT_READY",
      errorCode: "UNEXPECTED_MEDIA_STATE",
      externalExecutionId: gaExecutionId,
      wordpressObjectId: "20169",
      wordpressStatus: "draft",
      generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "outdoor-digital-sphere/georgia", excerpt: "x" },
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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: gaExecutionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("Conflicting existing WordPress identity");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("exact content_ready OUTDOOR_SPHERE partial draft in publish state remains rejected", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    (listGlwCampaignTargets as jest.Mock).mockReturnValue([
      {
        targetId: gaTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "content_ready",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
    ]);

    (glwPageExecutionRepository.getById as jest.Mock).mockResolvedValue({
      jobId: gaJobId,
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
      status: "CONTENT_READY",
      errorCode: "OUTDOOR_SPHERE_RICH_COMPOSITION_REQUIRED",
      externalExecutionId: gaExecutionId,
      wordpressObjectId: "20169",
      wordpressStatus: "publish",
      generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "outdoor-digital-sphere/georgia", excerpt: "x" },
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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: gaExecutionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("Published targets cannot continue");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("exact content_ready target ZERO_AUTHORITY without generatedDraft remains rejected", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    (listGlwCampaignTargets as jest.Mock).mockReturnValue([
      {
        targetId: gaTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "content_ready",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
    ]);

    (glwPageExecutionRepository.getById as jest.Mock).mockResolvedValue({
      jobId: gaJobId,
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
      status: "FAILED",
      errorCode: "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED",
      externalExecutionId: gaExecutionId,
      wordpressObjectId: null,
      wordpressStatus: null,
      generatedDraft: null,
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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: gaExecutionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("content-ready target has a failed job that is not recoverable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("exact content_ready target recoverable FAILED still fails closed on wrong execution identity", async () => {
    (listGlwCampaignTargets as jest.Mock).mockReturnValue([
      {
        targetId: gaTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "content_ready",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
    ]);

    (glwPageExecutionRepository.getById as jest.Mock).mockResolvedValue({
      jobId: gaJobId,
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
      status: "FAILED",
      errorCode: "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED",
      externalExecutionId: gaExecutionId,
      wordpressObjectId: null,
      wordpressStatus: null,
      generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "outdoor-digital-sphere/georgia", excerpt: "x" },
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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: "999999",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("execution identity does not match");
  });

  test("exact failed target with unrelated FAILED error remains rejected", async () => {
    (listGlwCampaignTargets as jest.Mock).mockReturnValue([
      {
        targetId: gaTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "failed",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: "failed",
        leaseId: null,
      },
    ]);

    (glwPageExecutionRepository.getById as jest.Mock).mockResolvedValue({
      jobId: gaJobId,
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
      status: "FAILED",
      errorCode: "GENERATED_CONTENT_QA_FAILED",
      externalExecutionId: gaExecutionId,
      wordpressObjectId: null,
      wordpressStatus: null,
      generatedDraft: { title: "x", contentHtml: "<p>x</p>", slug: "outdoor-digital-sphere/georgia", excerpt: "x" },
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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: gaExecutionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("not recoverable for exact continuation");
  });

  test("exact failed ZERO_AUTHORITY without generatedDraft remains rejected", async () => {
    (listGlwCampaignTargets as jest.Mock).mockReturnValue([
      {
        targetId: gaTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "failed",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: "failed",
        leaseId: null,
      },
    ]);

    (glwPageExecutionRepository.getById as jest.Mock).mockResolvedValue({
      jobId: gaJobId,
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      productId: "prod-outdoor-digital-sphere",
      status: "FAILED",
      errorCode: "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED",
      externalExecutionId: gaExecutionId,
      wordpressObjectId: null,
      wordpressStatus: null,
      generatedDraft: null,
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
        targetId: gaTargetId,
        jobId: gaJobId,
        executionId: gaExecutionId,
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("not recoverable for exact continuation");
  });

  test("fails closed for mismatched exact target, job, or execution identity", async () => {
    const baseUrl = "http://localhost/api/glw/campaigns/" + campaignId + "/reconcile";
    const run = async (body: Record<string, string>) => {
      const request = new NextRequest(baseUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gcp-organization-id": "led-display-warehouse",
          "x-gcp-site-id": "site-led-display-warehouse-production",
        },
        body: JSON.stringify({ confirm: "RECONCILE_EXISTING_DRAFT_BATCH", ...body }),
      });
      return POST(request, { params: Promise.resolve({ campaignId }) });
    };

    const wrongTarget = await run({ targetId: "target-wrong", jobId: gaJobId, executionId: gaExecutionId });
    expect(wrongTarget.status).toBe(409);

    const wrongJob = await run({ targetId: gaTargetId, jobId: "job-wrong", executionId: gaExecutionId });
    expect(wrongJob.status).toBe(409);

    const wrongExecution = await run({ targetId: gaTargetId, jobId: gaJobId, executionId: "999999" });
    expect(wrongExecution.status).toBe(409);
  });

  test("campaign-wide reconcile behavior remains unchanged for running + CONTENT_READY", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ job: { status: "CONTENT_READY", externalExecutionId: gaExecutionId, wordpressObjectId: null, wordpressStatus: null } }, 200));
    global.fetch = fetchMock as unknown as typeof fetch;
    (listGlwCampaignTargets as jest.Mock).mockReturnValue([
      {
        targetId: gaTargetId,
        campaignId,
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "running",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
        lastError: null,
        leaseId: null,
      },
    ]);

    (reconcileGlwCampaignTargetContentReady as jest.Mock).mockReturnValue({
      target: {
        targetId: gaTargetId,
        campaignId,
        stateCode: "GA",
        citySlug: null,
        cityName: null,
        status: "content_ready",
        jobId: gaJobId,
        wordpressObjectId: null,
        attemptCount: 1,
      },
      leaseHistory: { leaseId: "lease-ga" },
    });

    const request = new NextRequest("http://localhost/api/glw/campaigns/" + campaignId + "/reconcile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gcp-organization-id": "led-display-warehouse",
        "x-gcp-site-id": "site-led-display-warehouse-production",
      },
      body: JSON.stringify({ confirm: "RECONCILE_EXISTING_DRAFT_BATCH" }),
    });

    const response = await POST(request, { params: Promise.resolve({ campaignId }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results).toEqual(expect.arrayContaining([expect.objectContaining({ stateCode: "GA", action: "content_ready" })]));
    expect(reconcileGlwCampaignTargetContentReady).toHaveBeenCalledWith(expect.objectContaining({ campaignId, targetId: gaTargetId, jobId: gaJobId, externalExecutionId: gaExecutionId }));
    expect(fetchMock.mock.calls).toHaveLength(1);
  });
});
