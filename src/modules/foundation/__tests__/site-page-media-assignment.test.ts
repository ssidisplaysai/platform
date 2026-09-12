jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const digest = (value: string) => value.repeat(64).slice(0, 64);

function base() {
  return {
    organizationId: "org",
    siteId: "site",
    buildSessionId: "session",
    pageId: "page",
    pageRevisionId: "page-revision-1",
    metadata: { altText: "Approved projector enclosure", caption: null, title: "Projector enclosure", description: "Approved product authority image." },
    approval: { candidateId: "candidate-1", approvedBy: "owner-1", approvedAt: "2026-09-12T00:00:00.000Z" },
    wordpressReceipt: null,
  } as const;
}

describe("site page media assignment", () => {
  let root: string;
  let originalRoot: string | undefined;

  beforeEach(() => {
    originalRoot = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    root = mkdtempSync(join(tmpdir(), "site-media-assignment-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root;
    jest.resetModules();
  });

  afterEach(() => {
    if (originalRoot === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalRoot;
    rmSync(root, { recursive: true, force: true });
  });

  test("persists independent approved product and grounded contextual roles", async () => {
    const repository = await import("../site-page-media-assignment");
    const product = repository.saveSitePageMediaAssignment({
      ...base(),
      slotId: "product",
      role: "PRODUCT_AUTHORITY",
      asset: { type: "APPROVED_EXISTING", authorityReference: "product-intelligence:asset-1", productId: "product-1", wordpressMediaId: 100, url: "https://example.test/product.jpg", sha256: digest("a") },
    });
    const contextual = repository.saveSitePageMediaAssignment({
      ...base(),
      slotId: "contextual",
      role: "CONTEXTUAL_IN_USE",
      asset: { type: "GENERATED", provider: "OPENAI_IMAGE", model: "image-model", generationJobId: "generation-1", effectivePrompt: "Show the approved enclosure in a credible classroom installation without location claims.", referenceInputs: [{ referenceId: product.assignmentId, role: "PRODUCT_TRUTH", sha256: digest("a") }], outputSha256: digest("b") },
    });

    expect(repository.listSitePageMediaAssignments({ organizationId: "org", siteId: "site", buildSessionId: "session" })).toHaveLength(2);
    expect(repository.evaluateSitePageImagePackage({ assignments: [product, contextual], pageRevisionId: "page-revision-1", approvedProductImageAvailable: true, contextualPolicy: "REQUIRED" })).toMatchObject({ ready: true, degraded: false });
  });

  test("rejects generated product authority and ungrounded contextual media", async () => {
    const repository = await import("../site-page-media-assignment");
    const generated = { type: "GENERATED" as const, provider: "OPENAI_IMAGE", model: "image-model", generationJobId: null, effectivePrompt: "Scene", referenceInputs: [], outputSha256: digest("b") };
    expect(() => repository.saveSitePageMediaAssignment({ ...base(), slotId: "product", role: "PRODUCT_AUTHORITY", asset: generated })).toThrow("PRODUCT_AUTHORITY_MEDIA_MUST_USE_APPROVED_PRODUCT_ASSET");
    expect(() => repository.saveSitePageMediaAssignment({ ...base(), slotId: "contextual", role: "CONTEXTUAL_IN_USE", asset: generated })).toThrow("CONTEXTUAL_MEDIA_PRODUCT_TRUTH_REFERENCE_REQUIRED");
  });

  test("rejects duplicate slot assignments and stale role reuse", async () => {
    const repository = await import("../site-page-media-assignment");
    const assignment = {
      ...base(),
      slotId: "product",
      role: "PRODUCT_AUTHORITY" as const,
      asset: { type: "APPROVED_EXISTING" as const, authorityReference: "authority", productId: "product-1", wordpressMediaId: null, url: "https://example.test/product.jpg", sha256: digest("a") },
    };
    repository.saveSitePageMediaAssignment(assignment);
    expect(() => repository.saveSitePageMediaAssignment(assignment)).toThrow("MEDIA_ASSIGNMENT_SLOT_ALREADY_BOUND");
    expect(repository.evaluateSitePageImagePackage({ assignments: repository.listSitePageMediaAssignments({ organizationId: "org", siteId: "site", buildSessionId: "session" }), pageRevisionId: "page-revision-2", approvedProductImageAvailable: true, contextualPolicy: "DESIRED" })).toMatchObject({ ready: false, blockers: ["APPROVED_PRODUCT_AUTHORITY_IMAGE_REQUIRED"] });
  });

  test("degrades safely to approved product image when contextual media is desired", async () => {
    const repository = await import("../site-page-media-assignment");
    const product = repository.saveSitePageMediaAssignment({
      ...base(),
      slotId: "product",
      role: "PRODUCT_AUTHORITY",
      asset: { type: "APPROVED_EXISTING", authorityReference: "authority", productId: "product-1", wordpressMediaId: null, url: "https://example.test/product.jpg", sha256: digest("a") },
    });
    expect(repository.evaluateSitePageImagePackage({ assignments: [product], pageRevisionId: "page-revision-1", approvedProductImageAvailable: true, contextualPolicy: "DESIRED" })).toMatchObject({ ready: true, degraded: true, warnings: ["CONTEXTUAL_IN_USE_IMAGE_UNAVAILABLE_USING_PRODUCT_IMAGE_ONLY"] });
  });
});
