jest.mock("server-only", () => ({}));

import { createHash } from "node:crypto";
import {
  CONTEXTUAL_MEDIA_URL_TOKEN,
  executePublishedContextualMediaUpdate,
  listPublishedContextualMediaEvidence,
  PUBLISHED_CONTEXTUAL_MEDIA_UPDATE,
  resetPublishedContextualMediaEvidenceForTests,
  type PublishedContextualMediaInput,
  type PublishedContextualMediaTransport,
} from "../published-contextual-media-authority";

const ORIGINAL = '<h1>House Mapping</h1><figure class="page-hero-image"><img src="product.jpg" alt="Product"></figure><h2>Using Homeline</h2><p>Body</p>';
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

function input(type: "GENERATED_CONTEXTUAL" | "EXISTING_CONTEXTUAL" = "GENERATED_CONTEXTUAL"): PublishedContextualMediaInput {
  const common = {
    operation: PUBLISHED_CONTEXTUAL_MEDIA_UPDATE,
    transactionId: `txn-${type.toLowerCase()}`,
    siteId: "site-ssi-projectorenclosure",
    pageId: 12932,
    expectedContentSha256: hash(ORIGINAL),
    expectedSlug: "house-projection-mapping-enclosure",
    expectedCanonicalUrl: "https://projectorenclosure.com/house-projection-mapping-enclosure/",
    expectedFeaturedMediaId: 11972,
    featuredMediaPolicy: "PRESERVE" as const,
    replacements: [
      { name: "application-hero", exactAnchor: '<figure class="page-hero-image"><img src="product.jpg" alt="Product"></figure>', replacementHtml: `<figure class="page-hero-image"><img src="${CONTEXTUAL_MEDIA_URL_TOKEN}" alt="Residential house projection mapping example"></figure>` },
      { name: "homeline-product-media", exactAnchor: "<h2>Using Homeline</h2>", replacementHtml: '<h2>Using Homeline</h2><img src="product.jpg" alt="Homeline Projector Enclosure">' },
    ],
    acceptance: { requiredHtml: ["Using Homeline", "product.jpg"], prohibitedHtml: ["placeholder"] },
  };
  if (type === "EXISTING_CONTEXTUAL") return { ...common, media: { type, mediaId: 14000, expectedUrl: "https://projectorenclosure.com/context.jpg", provenance: "OWNER_APPROVED_EXISTING_MEDIA", altText: "Residential house projection mapping example" } };
  const bytes = Buffer.from("generated-image");
  return { ...common, media: { type, bytes, mimeType: "image/jpeg", fileExtension: "jpg", provenance: { provider: "mock-provider", generationJobId: "image-job-1", prompt: "Wide residential mapped house", createdAt: "2026-09-04T00:00:00.000Z", targetSiteId: "site-ssi-projectorenclosure", targetPageId: 12932, role: "contextual_application_media", altText: "Residential house projection mapping example", contentSha256: hash(bytes) } } };
}

function transport(options: { publicFailure?: boolean; cleanupReferences?: number[]; deleteOk?: boolean; delayRead?: Promise<void> } = {}) {
  let content = ORIGINAL;
  let featuredMediaId = 11972;
  const calls: string[] = [];
  const implementation: PublishedContextualMediaTransport = {
    async readPage() { if (options.delayRead) await options.delayRead; calls.push("read-page"); return { id: 12932, slug: "house-projection-mapping-enclosure", status: "publish", parent: 0, featuredMediaId, content, canonicalUrl: "https://projectorenclosure.com/house-projection-mapping-enclosure/", robots: { index: "index", follow: "follow" }, title: "Projector Enclosure for House Projection Mapping" }; },
    async verifyTargetAuthority() { calls.push("target-authority"); return true; },
    async readMedia(mediaId) { calls.push("read-media"); return { id: mediaId, url: "https://projectorenclosure.com/context.jpg", altText: "Residential house projection mapping example", mediaType: "image" }; },
    async uploadGeneratedMedia() { calls.push("upload"); return { id: 14001, url: "https://projectorenclosure.com/generated.jpg", altText: "", mediaType: "image" }; },
    async updateMediaMetadata() { calls.push("metadata"); return true; },
    async writePublishedPageContent(_pageId, update) { calls.push(update.content === ORIGINAL ? "restore-page" : "write-page"); content = update.content; featuredMediaId = update.featuredMediaId; return true; },
    async fetchPublicHtml() { calls.push("public"); return { status: options.publicFailure ? 500 : 200, html: content }; },
    async findMediaReferences() { calls.push("references"); return options.cleanupReferences ?? []; },
    async deleteGeneratedMedia() { calls.push("delete-media"); return options.deleteOk ?? true; },
  };
  return { implementation, calls, state: () => ({ content, featuredMediaId }) };
}

describe("published contextual media authority", () => {
  beforeEach(() => resetPublishedContextualMediaEvidenceForTests());

  test("accepts published page 12932 only through the new bounded authority and preserves featured media", async () => {
    const mock = transport();
    const result = await executePublishedContextualMediaUpdate(input(), mock.implementation);
    expect(result).toMatchObject({ ok: true, evidence: { state: "COMMITTED", pageId: 12932, contextualMediaId: 14001, finalFeaturedMediaId: 11972, generatedMediaProvenance: { generationJobId: "image-job-1", role: "contextual_application_media" } } });
    expect(mock.state().featuredMediaId).toBe(11972);
    expect(mock.state().content).toContain("generated.jpg");
    expect(listPublishedContextualMediaEvidence()).toHaveLength(1);
  });

  test("fails before mutation when content hash or anchor identity differs", async () => {
    const mock = transport();
    const bad = { ...input(), expectedContentSha256: "0".repeat(64) };
    const result = await executePublishedContextualMediaUpdate(bad, mock.implementation);
    expect(result).toMatchObject({ ok: false, code: "PAGE_PRECONDITION_MISMATCH", evidence: { state: "FAILED_PRECONDITION" } });
    expect(mock.calls).not.toContain("upload");
    expect(mock.calls).not.toContain("write-page");
  });

  test("rejects a draft target without weakening legacy draft-only ownership", async () => {
    const mock = transport();
    mock.implementation.readPage = async () => ({ id: 12932, slug: "house-projection-mapping-enclosure", status: "draft", parent: 0, featuredMediaId: 11972, content: ORIGINAL, canonicalUrl: "https://projectorenclosure.com/house-projection-mapping-enclosure/", robots: { index: "index", follow: "follow" }, title: "Projector Enclosure for House Projection Mapping" });
    const result = await executePublishedContextualMediaUpdate(input(), mock.implementation);
    expect(result).toMatchObject({ ok: false, code: "PAGE_PRECONDITION_MISMATCH", evidence: { state: "FAILED_PRECONDITION" } });
    expect(mock.calls).not.toContain("upload");
    expect(mock.calls).not.toContain("write-page");
  });

  test("restores page first and deletes unreferenced generated media after public failure", async () => {
    const mock = transport({ publicFailure: true });
    const result = await executePublishedContextualMediaUpdate(input(), mock.implementation);
    expect(result).toMatchObject({ ok: false, code: "PUBLIC_ACCEPTANCE_FAILED", evidence: { state: "ROLLED_BACK", rollbackPageVerified: true, generatedMediaDeleted: true, orphanCleanupRequired: false } });
    expect(mock.calls.indexOf("restore-page")).toBeLessThan(mock.calls.indexOf("references"));
    expect(mock.calls.indexOf("references")).toBeLessThan(mock.calls.indexOf("delete-media"));
    expect(mock.state()).toEqual({ content: ORIGINAL, featuredMediaId: 11972 });
  });

  test("records orphan cleanup when generated media still has references", async () => {
    const mock = transport({ publicFailure: true, cleanupReferences: [777] });
    const result = await executePublishedContextualMediaUpdate(input(), mock.implementation);
    expect(result).toMatchObject({ ok: false, evidence: { state: "ORPHAN_CLEANUP_REQUIRED", generatedMediaDeleted: false, orphanCleanupRequired: true } });
    expect(mock.calls).not.toContain("delete-media");
  });

  test("never deletes approved existing media during rollback", async () => {
    const mock = transport({ publicFailure: true });
    const result = await executePublishedContextualMediaUpdate(input("EXISTING_CONTEXTUAL"), mock.implementation);
    expect(result).toMatchObject({ ok: false, evidence: { state: "ROLLED_BACK", mediaOperation: "EXISTING_CONTEXTUAL", generatedMediaDeleted: false, orphanCleanupRequired: false } });
    expect(mock.calls).not.toContain("delete-media");
  });

  test("serializes concurrent operations for the same page", async () => {
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => { release = resolve; });
    const firstMock = transport({ delayRead: delayed });
    const secondMock = transport();
    const first = executePublishedContextualMediaUpdate({ ...input(), transactionId: "txn-first" }, firstMock.implementation);
    const second = executePublishedContextualMediaUpdate({ ...input(), transactionId: "txn-second" }, secondMock.implementation);
    await Promise.resolve();
    expect(secondMock.calls).toEqual([]);
    release();
    await first;
    await second;
    expect(secondMock.calls[0]).toBe("read-page");
  });

  test("rejects replay of an already recorded transaction ID", async () => {
    const firstMock = transport();
    const secondMock = transport();
    const first = await executePublishedContextualMediaUpdate({ ...input(), transactionId: "txn-replay" }, firstMock.implementation);
    const second = await executePublishedContextualMediaUpdate({ ...input(), transactionId: "txn-replay" }, secondMock.implementation);
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, code: "PAGE_MUTATION_ACTIVE", evidence: { state: "FAILED_PRECONDITION" } });
    expect(secondMock.calls).toEqual([]);
  });
});
