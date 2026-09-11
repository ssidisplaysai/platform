jest.mock("server-only", () => ({}));

const credential = { username: "user", applicationPassword: "password" };
const getJson = jest.fn();
const recordSiteBuildWordPressDraft = jest.fn((value) => value);
let receipts: Array<{ buildSessionId: string; draftId: string; wordpressObjectId: string; wordpressUrl: string; wordpressStatus: "draft"; createdAt: string }> = [];

const snapshot = { strategyRevision: 3, creativeRevision: 1, marketFingerprint: "market", capabilityFingerprint: "capability", productServiceFingerprint: "product", sourcesFingerprint: "sources", generationPolicyVersion: "site-draft-generation-v1" };
const drafts = ["home", "capabilities"].map((slug) => ({ draftId: `draft-${slug}`, pageId: `page-${slug}`, title: slug, slug, excerpt: slug, contentHtml: `<h1>${slug}</h1>`, authority: [] }));
const site = { siteId: "site", organizationId: "org", displayName: "Site", enabled: false, publishingStatus: "disabled", integrations: { wordpressApiBaseUrl: "https://example.test/wp-json/wp/v2", wordpressCredentialReference: "credref-wp-1" } };
const certification = { status: "CURRENT", certification: { certificationId: "cert", ...snapshot } };

jest.mock("../wordpress-credential-resolver", () => ({ resolveWordPressCredentialReference: jest.fn(() => credential) }));
jest.mock("../authenticated-wordpress-read-authority", () => ({ createAuthenticatedWordPressReadAuthority: jest.fn(() => ({ getJson })) }));
jest.mock("../site-intelligence-repository", () => ({ getSiteIntelligenceWorkspace: jest.fn(() => null) }));
jest.mock("../site-generation-readiness-service", () => ({ getSiteGenerationReadiness: jest.fn(() => ({ buildSession: { buildSessionId: "build", organizationId: "org", siteId: "site", certificationId: "cert", state: "STARTED" }, certification, readiness: { snapshot }, authority: { candidates: [], sources: [] } })) }));
jest.mock("../site-generation-readiness-repository", () => ({
  getSiteBuildRecords: jest.fn(() => ({ plans: [{ revision: 3, status: "APPROVED", authoritySnapshot: snapshot }], changeRequests: [], currentPlan: { revision: 3, status: "APPROVED", authoritySnapshot: snapshot }, draftSet: { draftSetId: "set", buildSessionId: "build", organizationId: "org", siteId: "site", buildPlanRevision: 3, authoritySnapshot: snapshot, status: "APPROVED", drafts }, wordpressDrafts: receipts })),
  recordSiteBuildWordPressDraft: (value: typeof receipts[number]) => { receipts.push(value); return recordSiteBuildWordPressDraft(value); },
  approveSiteBuildDrafts: jest.fn(), decideBuildPlan: jest.fn(), generateSiteBuildDrafts: jest.fn(), saveBuildPlanProposal: jest.fn(), saveRevisedBuildPlan: jest.fn(),
}));

import { createBuildWordPressDrafts, inspectSiteBuildWordPressReadiness } from "../site-build-service";

describe("Site Build WordPress runtime boundary", () => {
  beforeEach(() => { receipts = []; getJson.mockReset(); recordSiteBuildWordPressDraft.mockClear(); });

  test("authenticated readiness is read-only and proves exact absence", async () => {
    getJson.mockResolvedValueOnce({ ok: true, body: { id: 1 }, pagination: { total: null, totalPages: null } }).mockResolvedValue({ ok: true, body: [], pagination: { total: 0, totalPages: 0 } });
    await expect(inspectSiteBuildWordPressReadiness(site as never)).resolves.toMatchObject({ ready: true, credentialResolved: true, authenticated: true, collisionPreflightAvailable: true, targetCount: 2, absentCount: 2, existingReceiptCount: 0, blockedTargets: [], wordpressMutationPerformed: false, publicationMutationPerformed: false });
    expect(recordSiteBuildWordPressDraft).not.toHaveBeenCalled();
  });

  test("authentication failure and any collision fail closed", async () => {
    getJson.mockResolvedValueOnce({ ok: false, reason: "AUTH_FAILURE" });
    await expect(inspectSiteBuildWordPressReadiness(site as never)).resolves.toMatchObject({ ready: false, credentialResolved: true, authenticated: false, collisionPreflightAvailable: false });
    getJson.mockReset().mockResolvedValueOnce({ ok: true, body: { id: 1 } }).mockResolvedValueOnce({ ok: true, body: [{ id: 99, slug: "home", status: "publish" }] }).mockResolvedValueOnce({ ok: true, body: [] });
    await expect(inspectSiteBuildWordPressReadiness(site as never)).resolves.toMatchObject({ ready: false, authenticated: true, blockedTargets: [{ draftId: "draft-home", reason: "COLLISION" }] });
  });

  test("partial failure is resumable and retries skip durable receipts", async () => {
    const firstWriter = jest.fn().mockResolvedValueOnce({ ok: true, operation: "CREATE", wordpressObjectId: "101", wordpressUrl: "https://example.test/?page_id=101", wordpressStatus: "draft", seoMetadataAttempted: false, seoMetadataAccepted: false }).mockResolvedValueOnce({ ok: false, state: "write_failed", message: "failed" });
    await expect(createBuildWordPressDrafts(site as never, firstWriter)).rejects.toThrow("WORDPRESS_DRAFT_FAILED:capabilities:write_failed");
    expect(receipts).toHaveLength(1);
    const retryWriter = jest.fn().mockResolvedValue({ ok: true, operation: "CREATE", wordpressObjectId: "102", wordpressUrl: "https://example.test/?page_id=102", wordpressStatus: "draft", seoMetadataAttempted: false, seoMetadataAccepted: false });
    await createBuildWordPressDrafts(site as never, retryWriter);
    expect(retryWriter).toHaveBeenCalledTimes(1);
    expect(receipts.map((item) => item.draftId)).toEqual(["draft-home", "draft-capabilities"]);
  });

  test("WordPress creation requires disabled site and publication", async () => {
    await expect(createBuildWordPressDrafts({ ...site, enabled: true } as never, jest.fn())).rejects.toThrow("DRAFT_ONLY_SITE_BOUNDARY_REQUIRED");
    await expect(createBuildWordPressDrafts({ ...site, publishingStatus: "ready" } as never, jest.fn())).rejects.toThrow("DRAFT_ONLY_SITE_BOUNDARY_REQUIRED");
  });
});