jest.mock("server-only", () => ({}));

const page = { pageId: "home", pageRevisionId: "home-r5", name: "Home", slug: "", canonicalPath: "/", h1: "Home", seoTitle: "Home SEO", metaDescription: "Home meta", contentHtml: "<h1>Home</h1>", status: "APPROVED", quality: { ready: true }, imageRequirements: [{ slotId: "hero" }], internalLinks: [] };
const workspace = { session: { buildSessionId: "build" }, pageReview: { complete: true }, currentAssembly: { pages: [page] }, currentVisualAssemblies: [{ pageId: "home", pageRevisionId: "home-r5", contentHtml: "<section>Visual Home</section>" }], wordpressDrafts: [{ draftId: "home-draft", wordpressObjectId: "10", wordpressStatus: "draft" }], wordpressContentUpdates: [{ pageRevisionId: "home-r5", wordpressObjectId: "10", wordpressStatus: "draft", wordpressUrl: "https://example.test/?page_id=10", updatedAt: "2026-09-11T21:01:06Z" }] };

jest.mock("../site-build-service", () => ({ getSiteBuildWorkspace: jest.fn(() => workspace) }));
jest.mock("../wordpress-credential-resolver", () => ({ resolveWordPressCredentialReference: jest.fn() }));

import { inspectSiteBuildWordPressDrafts } from "../site-build-wordpress-review";

const site = { siteId: "site", organizationId: "org", displayName: "Site", enabled: false, publishingStatus: "disabled", integrations: { wordpressApiBaseUrl: "https://example.test/wp-json/wp/v2", wordpressCredentialReference: "ref" } };

describe("Site Build WordPress draft review", () => {
  test("reconciles exact draft identity, content, slug, title, and surfaces missing media", async () => {
    const authority = { getJson: jest.fn(async ({ path }: { path: string }) => path === "/pages/10" ? { ok: true, body: { id: 10, slug: "home", status: "draft", link: "https://example.test/?page_id=10", modified_gmt: "2026-09-11T21:01:05", featured_media: 0, title: { raw: "Home" }, content: { raw: "<section>Visual Home</section>" }, meta: {} }, pagination: { total: null, totalPages: null } } : { ok: true, body: [{ id: 10, slug: "home", status: "draft" }], pagination: { total: 1, totalPages: 1 } }) };
    const review = await inspectSiteBuildWordPressDrafts(site as never, authority as never);
    expect(review).toMatchObject({ readOnly: true, summary: { expectedCount: 1, verifiedDraftCount: 1, publishedCount: 0, successfulUpdateCount: 1, failedUpdateCount: 0, duplicateObjectCount: 0, missingDraftCount: 0, allObjectIdsMatchReceipts: true, allStatusesDraft: true, allCanonicalSlugsCorrect: true }, media: { approvedImageCount: 1, wordpressMediaObjectCount: 0, imagesAttachedToPages: 0, mediaSyncStillRequired: true }, qa: { architectureComplete: true, navigationStatus: "REVIEW_ONLY", invalidInternalLinkCount: 0, orphanPageCount: 0, duplicateSlugCount: 0, missingDraftCount: 0, contentMismatchCount: 0, publicationEnabled: false } });
    expect(review.items[0]).toMatchObject({ wordpressObjectId: "10", wordpressStatus: "draft", identityMatch: true, slugMatch: true, titleMatch: true, contentMatch: true, syncStatus: "VERIFIED", seoReadback: "NOT_EXPOSED", imageAttached: false });
  });

  test("fails review status on duplicate canonical objects or published identity", async () => {
    const authority = { getJson: jest.fn(async ({ path }: { path: string }) => path === "/pages/10" ? { ok: true, body: { id: 10, slug: "home", status: "publish", title: { raw: "Home" }, content: { raw: "<h1>Home</h1>" } }, pagination: { total: null, totalPages: null } } : { ok: true, body: [{ id: 10, slug: "home" }, { id: 11, slug: "home" }], pagination: { total: 2, totalPages: 1 } }) };
    const review = await inspectSiteBuildWordPressDrafts(site as never, authority as never);
    expect(review.summary).toMatchObject({ verifiedDraftCount: 0, publishedCount: 1 });
    expect(review.qa.duplicateSlugCount).toBe(1);
    expect(review.items[0].syncStatus).toBe("ATTENTION_REQUIRED");
  });

  test("verifies the same exact object as published during final publication verification", async () => {
    const authority = { getJson: jest.fn(async ({ path }: { path: string }) => path === "/pages/10" ? { ok: true, body: { id: 10, slug: "home", status: "publish", featured_media: 41, title: { raw: "Home" }, content: { raw: "<section>Visual Home</section>" }, meta: {} }, pagination: { total: null, totalPages: null } } : { ok: true, body: [{ id: 10, slug: "home", status: "publish" }], pagination: { total: 1, totalPages: 1 } }) };
    const review = await inspectSiteBuildWordPressDrafts(site as never, authority as never, "publish");
    expect(review.items[0]).toMatchObject({ wordpressObjectId: "10", wordpressStatus: "publish", contentMatch: true, imageAttached: true, syncStatus: "VERIFIED" });
    expect(review.summary).toMatchObject({ verifiedDraftCount: 1, publishedCount: 1, allStatusesDraft: false });
    expect(review.qa.readyForSiteQa).toBe(true);
  });
});