import { NextRequest } from "next/server";
import { createHash } from "node:crypto";

const mockAuthorizeRequest = jest.fn(() => ({ ok: true, status: 200, error: null }));
const mockHasOrganizationScope = jest.fn(() => true);
const mockResolveRequestScope = jest.fn(() => ({ organizationId: "org", siteId: "site" }));
const mockGetSiteById = jest.fn(() => ({
  siteId: "site",
  organizationId: "org",
  canonicalUrl: "https://example.com",
  integrations: {
    wordpressApiBaseUrl: "https://example.com/wp-json/wp/v2",
    wordpressCredentialReference: "cred-ref",
  },
}));
const mockListCampaigns = jest.fn(() => ([{
  campaignId: "campaign",
  organizationId: "org",
  siteId: "site",
  productId: "prod",
  publicationPolicy: "publish_after_gates",
}]));
const mockListTargets = jest.fn();
const mockMarkPublished = jest.fn((input) => ({ ...input, wordpressObjectId: input.wordpressObjectId, status: "published" }));
const mockSummarizeTargets = jest.fn(() => ({ totals: { draft_ready: 0, published: 0 } }));
const mockGetExecutionById = jest.fn();
const mockReconcileExecutionPublished = jest.fn(async () => ({ jobId: "job-1" }));
const mockListCertifications = jest.fn();
const mockListOwnerDecisions = jest.fn();
const mockRenderedVisualDecisionCurrency = jest.fn(() => "CURRENT");
const mockListProductMediaAuthority = jest.fn(() => []);
const mockEvaluateProductMediaReadiness = jest.fn(() => ({ ready: true, blockers: [] }));
const mockResolveTrustedPrincipal = jest.fn(() => ({
  ok: true,
  principal: {
    principalId: "owner@example.com",
    sessionId: "session-1",
    authority: "SESSION",
  },
}));
const mockIssuePreflight = jest.fn(() => ({ preflightId: "pre-1" }));
const mockIssueGrant = jest.fn(() => ({ grantId: "grant-1" }));
const mockConsumeGrant = jest.fn(() => ({ claimId: "claim-1" }));
const mockRecordReceipt = jest.fn(() => ({
  receiptId: "receipt-1",
  operation: "EXACT_WORDPRESS_PUBLICATION",
  contextFingerprint: "f".repeat(64),
  visualCertificationId: "cert-1",
  lifecycleState: "PUBLICATION_MUTATED_AWAITING_CERTIFICATION",
  recordedAt: "2030-01-01T00:00:03.000Z",
}));
const mockTransitionStatus = jest.fn(async () => ({
  ok: true,
  wordpressObjectId: "301",
  wordpressUrl: "https://example.com/state/co/",
  beforeStatus: "draft",
  afterStatus: "publish",
  mutationPerformed: true,
  contentMutationPerformed: false,
}));
const mockResolveCredential = jest.fn(() => ({ username: "wp-user", applicationPassword: "wp-pass" }));
const mockGetJson = jest.fn();
const mockCreateReader = jest.fn(() => ({ getJson: mockGetJson }));

const baselineDraftContent = "<main><h1>Colorado Service</h1><p>Body</p></main>";
const baselineContentHash = createHash("sha256").update(baselineDraftContent.trim()).digest("hex");

jest.mock("@/modules/foundation/api-auth", () => ({
  authorizeRequest: (...args: unknown[]) => mockAuthorizeRequest(...args),
  hasOrganizationScope: (...args: unknown[]) => mockHasOrganizationScope(...args),
  resolveRequestScope: (...args: unknown[]) => mockResolveRequestScope(...args),
}));

jest.mock("@/modules/foundation/site-repository", () => ({
  getSiteById: (...args: unknown[]) => mockGetSiteById(...args),
}));

jest.mock("@/modules/glw/campaign-repository", () => ({
  listGlwCampaigns: (...args: unknown[]) => mockListCampaigns(...args),
}));

jest.mock("@/modules/glw/campaign-target-repository", () => ({
  listGlwCampaignTargets: (...args: unknown[]) => mockListTargets(...args),
  markGlwCampaignTargetPublished: (...args: unknown[]) => mockMarkPublished(...args),
  summarizeGlwCampaignTargets: (...args: unknown[]) => mockSummarizeTargets(...args),
}));

jest.mock("@/modules/glw/page-execution-repository", () => ({
  glwPageExecutionRepository: {
    getById: (...args: unknown[]) => mockGetExecutionById(...args),
  },
  reconcileGlwPageExecutionPublished: (...args: unknown[]) => mockReconcileExecutionPublished(...args),
}));

jest.mock("@/modules/foundation/rendered-visual-certification-repository", () => ({
  listRenderedVisualCertifications: (...args: unknown[]) => mockListCertifications(...args),
  listRenderedVisualOwnerDecisions: (...args: unknown[]) => mockListOwnerDecisions(...args),
}));

jest.mock("@/modules/foundation/rendered-visual-certification", () => ({
  renderedVisualDecisionCurrency: (...args: unknown[]) => mockRenderedVisualDecisionCurrency(...args),
}));

jest.mock("@/modules/glw/product-media-authority", () => ({
  listProductMediaAuthority: (...args: unknown[]) => mockListProductMediaAuthority(...args),
  evaluateProductMediaReadiness: (...args: unknown[]) => mockEvaluateProductMediaReadiness(...args),
}));

jest.mock("@/modules/glw/trusted-operator-principal", () => ({
  resolveGlwTrustedOperatorPrincipal: (...args: unknown[]) => mockResolveTrustedPrincipal(...args),
}));

jest.mock("@/modules/glw/exact-publication-rollback-authority", () => ({
  EXACT_WORDPRESS_PUBLICATION: "EXACT_WORDPRESS_PUBLICATION",
  issueExactPublicationRollbackPreflight: (...args: unknown[]) => mockIssuePreflight(...args),
  issueExactPublicationRollbackGrant: (...args: unknown[]) => mockIssueGrant(...args),
  consumeExactPublicationRollbackGrant: (...args: unknown[]) => mockConsumeGrant(...args),
  recordExactPublicationRollbackReceipt: (...args: unknown[]) => mockRecordReceipt(...args),
}));

jest.mock("@/modules/foundation/wordpress-publish-writer", () => ({
  transitionGenesisWordPressPageStatus: (...args: unknown[]) => mockTransitionStatus(...args),
}));

jest.mock("@/modules/foundation/wordpress-credential-resolver", () => ({
  resolveWordPressCredentialReference: (...args: unknown[]) => mockResolveCredential(...args),
}));

jest.mock("@/modules/foundation/authenticated-wordpress-read-authority", () => ({
  createAuthenticatedWordPressReadAuthority: (...args: unknown[]) => mockCreateReader(...args),
}));

import { POST } from "../route";

const baselineTarget = {
  targetId: "target-1",
  campaignId: "campaign",
  organizationId: "org",
  siteId: "site",
  productId: "prod",
  stateCode: "CO",
  citySlug: null,
  status: "draft_ready",
  jobId: "job-1",
  wordpressObjectId: "301",
  canonicalPath: "/state/co/",
};

const baselineExecution = {
  jobId: "job-1",
  organizationId: "org",
  siteId: "site",
  productId: "prod",
  status: "COMPLETE",
  wordpressStatus: "draft",
  wordpressObjectId: "301",
  externalExecutionId: "exec-1",
  updatedAt: "2030-01-01T00:00:00.000Z",
};

const baselineCertification = {
  certificationId: "cert-1",
  overallState: "PASS",
  identity: {
    organizationId: "org",
    siteId: "site",
    campaignId: "campaign",
    targetId: "target-1",
    pageId: "target-1",
    pageRevisionIdentity: "job:job-1:2030-01-01T00:00:00.000Z",
    jobId: "job-1",
    externalExecutionId: "exec-1",
    wordpressObjectId: "301",
    wordpressStatus: "draft",
    canonicalPath: "/state/co/",
    contentHash: baselineContentHash,
    renderedContentHash: baselineContentHash,
  },
};

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/glw/campaigns/campaign/publish?organizationId=org&siteId=site", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("campaign publish route gate integrity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GIT_COMMIT = "a".repeat(40);

    mockIssuePreflight.mockImplementation(() => ({ preflightId: "pre-1" }));
    mockIssueGrant.mockImplementation(() => ({ grantId: "grant-1" }));
    mockConsumeGrant.mockImplementation(() => ({ claimId: "claim-1" }));
    mockRecordReceipt.mockImplementation(() => ({
      receiptId: "receipt-1",
      operation: "EXACT_WORDPRESS_PUBLICATION",
      contextFingerprint: "f".repeat(64),
      visualCertificationId: "cert-1",
      lifecycleState: "PUBLICATION_MUTATED_AWAITING_CERTIFICATION",
      recordedAt: "2030-01-01T00:00:03.000Z",
    }));

    mockListTargets.mockReturnValue([baselineTarget]);
    mockGetExecutionById.mockResolvedValue(baselineExecution);
    mockListCertifications.mockReturnValue([baselineCertification]);
    mockListOwnerDecisions.mockReturnValue([{ decision: "APPROVED", pageRevisionIdentity: "job:job-1:2030-01-01T00:00:00.000Z", contentHash: baselineContentHash }]);
    mockEvaluateProductMediaReadiness.mockReturnValue({ ready: true, blockers: [] });
    mockGetJson.mockResolvedValue({
      ok: true,
      body: {
        id: 301,
        status: "draft",
        slug: "co",
        parent: 300,
        title: { raw: "Colorado Service" },
        featured_media: 0,
        content: { raw: baselineDraftContent },
      },
    });
    mockTransitionStatus.mockResolvedValue({
      ok: true,
      wordpressObjectId: "301",
      wordpressUrl: "https://example.com/state/co/",
      beforeStatus: "draft",
      afterStatus: "publish",
      mutationPerformed: true,
      contentMutationPerformed: false,
    });
  });

  test("blocks when owner approval is missing", async () => {
    mockListOwnerDecisions.mockReturnValue([]);

    const response = await POST(request({ confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS" }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.failed).toBe(1);
    expect(body.results[0].blockers).toContain("OWNER_DECISION_ABSENT");
    expect(mockTransitionStatus).not.toHaveBeenCalled();
  });

  test("blocks when visual certification is missing", async () => {
    mockListCertifications.mockReturnValue([]);

    const response = await POST(request({ confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS" }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(body.failed).toBe(1);
    expect(body.results[0].blockers).toContain("VISUAL_CERTIFICATION_PASS_ABSENT");
    expect(mockTransitionStatus).not.toHaveBeenCalled();
  });

  test("blocks when product authority is unsatisfied", async () => {
    mockEvaluateProductMediaReadiness.mockReturnValue({ ready: false, blockers: ["PRODUCT_AUTHORITY_HERO_REQUIRED"] });

    const response = await POST(request({ confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS" }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(body.failed).toBe(1);
    expect(body.results[0].blockers).toContain("PRODUCT_AUTHORITY_PRODUCT_AUTHORITY_HERO_REQUIRED");
    expect(mockTransitionStatus).not.toHaveBeenCalled();
  });

  test("blocks stale revision evidence when execution identity does not match certification", async () => {
    mockListCertifications.mockReturnValue([
      {
        ...baselineCertification,
        identity: {
          ...baselineCertification.identity,
          externalExecutionId: "exec-stale",
        },
      },
    ]);

    const response = await POST(request({ confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS" }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(body.failed).toBe(1);
    expect(body.results[0].blockers).toContain("VISUAL_CERTIFICATION_PASS_ABSENT");
  });

  test("accepts a visual PASS when renderedContentHash matches current WordPress hash", async () => {
    const response = await POST(request({ confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS" }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(body.succeeded).toBe(1);
    expect(body.failed).toBe(0);
    expect(mockTransitionStatus).toHaveBeenCalledTimes(1);
  });

  test("accepts when source-domain contentHash differs but renderedContentHash matches WordPress", async () => {
    mockListOwnerDecisions.mockReturnValue([{ decision: "APPROVED", pageRevisionIdentity: "job:job-1:2030-01-01T00:00:00.000Z", contentHash: "b".repeat(64) }]);
    mockListCertifications.mockReturnValue([
      {
        ...baselineCertification,
        identity: {
          ...baselineCertification.identity,
          contentHash: "b".repeat(64),
          renderedContentHash: baselineContentHash,
        },
      },
    ]);

    const response = await POST(request({ confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS" }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(body.succeeded).toBe(1);
    expect(body.failed).toBe(0);
  });

  test("blocks when renderedContentHash differs from current WordPress hash", async () => {
    mockListCertifications.mockReturnValue([
      {
        ...baselineCertification,
        identity: {
          ...baselineCertification.identity,
          renderedContentHash: "c".repeat(64),
        },
      },
    ]);

    const response = await POST(request({ confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS" }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(body.failed).toBe(1);
    expect(body.results[0].blockers).toContain("VISUAL_CERTIFICATION_PASS_ABSENT");
  });

  test("blocks when renderedContentHash is missing", async () => {
    mockListCertifications.mockReturnValue([
      {
        ...baselineCertification,
        identity: {
          ...baselineCertification.identity,
          renderedContentHash: null,
        },
      },
    ]);

    const response = await POST(request({ confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS" }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(body.failed).toBe(1);
    expect(body.results[0].blockers).toContain("VISUAL_CERTIFICATION_PASS_ABSENT");
  });

  test("blocks stale pageRevisionIdentity evidence", async () => {
    mockListCertifications.mockReturnValue([
      {
        ...baselineCertification,
        identity: {
          ...baselineCertification.identity,
          pageRevisionIdentity: "job:job-1:1999-01-01T00:00:00.000Z",
        },
      },
    ]);

    const response = await POST(request({ confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS" }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(body.failed).toBe(1);
    expect(body.results[0].blockers).toContain("VISUAL_CERTIFICATION_PASS_ABSENT");
  });

  test("blocks wrong target evidence", async () => {
    mockListCertifications.mockReturnValue([
      {
        ...baselineCertification,
        identity: {
          ...baselineCertification.identity,
          targetId: "target-2",
          pageId: "target-2",
        },
      },
    ]);

    const response = await POST(request({ confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS" }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(body.failed).toBe(1);
    expect(body.results[0].blockers).toContain("VISUAL_CERTIFICATION_PASS_ABSENT");
  });

  test("blocks wrong job evidence", async () => {
    mockListCertifications.mockReturnValue([
      {
        ...baselineCertification,
        identity: {
          ...baselineCertification.identity,
          jobId: "job-99",
        },
      },
    ]);

    const response = await POST(request({ confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS" }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(body.failed).toBe(1);
    expect(body.results[0].blockers).toContain("VISUAL_CERTIFICATION_PASS_ABSENT");
  });

  test("blocks WordPress mutation when protected receipt preflight cannot be established", async () => {
    mockIssuePreflight.mockImplementation(() => {
      throw new Error("PRELIGHT_FAILED");
    });

    const response = await POST(request({ confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS" }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(body.failed).toBe(1);
    expect(mockTransitionStatus).not.toHaveBeenCalled();
    expect(mockMarkPublished).not.toHaveBeenCalled();
  });

  test("does not transition lifecycle to published when receipt recording fails", async () => {
    mockRecordReceipt.mockImplementation(() => {
      throw new Error("RECEIPT_WRITE_FAILED");
    });

    const response = await POST(request({ confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS" }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(mockTransitionStatus).toHaveBeenCalledTimes(1);
    expect(mockMarkPublished).not.toHaveBeenCalled();
    expect(body.failed).toBe(1);
  });

  test("publishes only eligible targets in bulk operations", async () => {
    mockListTargets.mockReturnValue([
      baselineTarget,
      {
        ...baselineTarget,
        targetId: "target-2",
        stateCode: "TX",
        jobId: "job-2",
        wordpressObjectId: "302",
        canonicalPath: "/state/tx/",
      },
    ]);
    mockGetExecutionById.mockImplementation(async (jobId: string) => (jobId === "job-1"
      ? baselineExecution
      : { ...baselineExecution, jobId: "job-2", wordpressObjectId: "302", externalExecutionId: "exec-2" }));
    mockGetJson.mockResolvedValueOnce({
      ok: true,
      body: {
        id: 301,
        status: "draft",
        slug: "co",
        parent: 300,
        title: { raw: "Colorado Service" },
        featured_media: 0,
        content: { raw: baselineDraftContent },
      },
    });
    mockGetJson.mockResolvedValueOnce({
      ok: true,
      body: {
        id: 302,
        status: "draft",
        slug: "tx",
        parent: 300,
        title: { raw: "Texas Service" },
        featured_media: 0,
        content: { raw: "<main><h1>Texas Service</h1><p>Body</p></main>" },
      },
    });
    mockListCertifications.mockImplementation((input: { pageId?: string }) => (input.pageId === "target-1"
      ? [baselineCertification]
      : []));

    const response = await POST(request({ confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS" }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(body.attempted).toBe(2);
    expect(body.succeeded).toBe(1);
    expect(body.failed).toBe(1);
    expect(mockMarkPublished).toHaveBeenCalledTimes(1);
  });

  test("records receipt before lifecycle publication success", async () => {
    const response = await POST(request({ confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS" }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(body.succeeded).toBe(1);
    expect(mockRecordReceipt).toHaveBeenCalledTimes(1);
    expect(mockMarkPublished).toHaveBeenCalledTimes(1);
    expect(mockReconcileExecutionPublished).toHaveBeenCalledTimes(1);

    const receiptOrder = mockRecordReceipt.mock.invocationCallOrder[0];
    const markOrder = mockMarkPublished.mock.invocationCallOrder[0];
    expect(receiptOrder).toBeLessThan(markOrder);
  });

  test("returns 409 when exact targetId is not draft_ready within requested scope", async () => {
    const response = await POST(request({
      confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS",
      targetId: "target-missing",
    }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.publicationPerformed).toBe(false);
    expect(body.attempted).toBe(0);
    expect(mockTransitionStatus).not.toHaveBeenCalled();
  });

  test("publishes only the exact requested targetId", async () => {
    mockListTargets.mockReturnValue([
      baselineTarget,
      {
        ...baselineTarget,
        targetId: "target-2",
        stateCode: "TX",
        jobId: "job-2",
        wordpressObjectId: "302",
        canonicalPath: "/state/tx/",
      },
    ]);
    mockGetExecutionById.mockImplementation(async (jobId: string) => (jobId === "job-1"
      ? baselineExecution
      : { ...baselineExecution, jobId: "job-2", wordpressObjectId: "302", externalExecutionId: "exec-2", state: "Texas" }));
    const texasHtml = "<main><h1>Texas Service</h1><p>Body</p></main>";
    const texasHash = createHash("sha256").update(texasHtml.trim()).digest("hex");
    mockGetJson.mockResolvedValue({
      ok: true,
      body: {
        id: 302,
        status: "draft",
        slug: "tx",
        parent: 300,
        title: { raw: "Texas Service" },
        featured_media: 0,
        content: { raw: texasHtml },
      },
    });
    mockListCertifications.mockReturnValue([
      {
        ...baselineCertification,
        certificationId: "cert-2",
        identity: {
          ...baselineCertification.identity,
          targetId: "target-2",
          pageId: "target-2",
          pageRevisionIdentity: "job:job-2:2030-01-01T00:00:00.000Z",
          jobId: "job-2",
          externalExecutionId: "exec-2",
          wordpressObjectId: "302",
          canonicalPath: "/state/tx/",
          contentHash: texasHash,
          renderedContentHash: texasHash,
        },
      },
    ]);
    mockListOwnerDecisions.mockReturnValue([{ decision: "APPROVED", pageRevisionIdentity: "job:job-2:2030-01-01T00:00:00.000Z", contentHash: texasHash }]);

    const response = await POST(request({
      confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS",
      targetId: "target-2",
    }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.attempted).toBe(1);
    expect(body.succeeded).toBe(1);
    expect(body.results[0].stateCode).toBe("TX");
    expect(mockTransitionStatus).toHaveBeenCalledTimes(1);
  });

  test("preserves stateCodes filtering when targetId is provided", async () => {
    const response = await POST(request({
      confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS",
      targetId: "target-1",
      stateCodes: ["TX"],
    }), { params: Promise.resolve({ campaignId: "campaign" }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.publicationPerformed).toBe(false);
    expect(body.attempted).toBe(0);
    expect(mockTransitionStatus).not.toHaveBeenCalled();
  });
});
