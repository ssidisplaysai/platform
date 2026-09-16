jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RenderedVisualCertification } from "@/modules/foundation/rendered-visual-certification";
import type { SiteConfiguration } from "@/modules/foundation/types";
import { EXACT_WORDPRESS_PUBLICATION, EXACT_WORDPRESS_ROLLBACK, type ExactPublicationRollbackContext } from "../exact-publication-rollback-authority";
import {
  assertActualPublicHostCertification,
  assertExactPublicationPreflight,
  executeAuthorizedExactWordPressOperation,
  extractExactPublicRichPageClaimContent,
  issueVerifiedExactOperationGrant,
  issueVerifiedExactOperationPreflight,
  storedPostContentSha,
  type ExactWordPressAuthoritySnapshot,
} from "../exact-publication-rollback-service";

const raw = "<main>Approved artifact</main>";
const principal = { principalId: "owner", sessionId: "session", authority: "GENESIS_SERVER_SESSION_V1" };
const site = { canonicalUrl: "https://example.com", integrations: {} } as SiteConfiguration;
const context: ExactPublicationRollbackContext = { operation: EXACT_WORDPRESS_PUBLICATION, organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", campaignId: "campaign-outdoor", productId: "prod-outdoor-digital-sphere", targetId: "target-campaign-outdoor-in", stateCode: "IN", wordpressObjectId: "20115", parentObjectId: "20114", slug: "indiana", canonicalPath: "/outdoor-digital-sphere/indiana/", expectedH1: "Outdoor Digital Sphere in Indiana", expectedTitle: "Outdoor Digital Sphere in Indiana", featuredMediaId: 0, storedPostContentSha: storedPostContentSha(raw), visualCertificationId: "draft-certification", runtimeSha: "a".repeat(40), expectedCurrentStatus: "draft", intendedStatus: "publish", sourcePublicationReceiptId: null };
const snapshot = (status: "draft" | "publish" = "draft", patch: Partial<ExactWordPressAuthoritySnapshot> = {}): ExactWordPressAuthoritySnapshot => ({ organizationId: context.organizationId, siteId: context.siteId, campaignId: context.campaignId, productId: context.productId, targetId: context.targetId, stateCode: context.stateCode, wordpressObjectId: context.wordpressObjectId, parentObjectId: context.parentObjectId, slug: context.slug, canonicalPath: context.canonicalPath, status, rawPostContent: raw, title: context.expectedTitle, featuredMediaId: context.featuredMediaId, ...patch });

function capture(viewportClass: "DESKTOP" | "MOBILE", viewportWidth: number, viewportHeight: number) {
  return { viewportClass, viewportWidth, viewportHeight, horizontalOverflow: 0, hero: { present: true, headingBounds: {}, primaryCtaBounds: {} }, hostIntegration: { headerOverlap: false, footerOverlap: false, blankImageContainers: 0 }, media: [{ semanticRole: "PRODUCT_AUTHORITY", rendered: true }, { semanticRole: "CONTEXTUAL_IN_USE", rendered: true }] } as never;
}
function certification(input: { id?: string; status?: "draft" | "publish"; targetId?: string | null; contentHash?: string; canonicalPath?: string } = {}): RenderedVisualCertification {
  return { certificationId: input.id ?? "draft-certification", overallState: "PASS", layoutClass: "FULL_WIDTH_MARKETING_PAGE", identity: { organizationId: context.organizationId, siteId: context.siteId, campaignId: context.campaignId, targetId: input.targetId === undefined ? null : input.targetId, wordpressObjectId: context.wordpressObjectId, wordpressStatus: input.status ?? "draft", canonicalPath: input.canonicalPath ?? context.canonicalPath, contentHash: input.contentHash ?? context.storedPostContentSha }, captures: [capture("DESKTOP", 1440, 1000), capture("MOBILE", 375, 812)] } as RenderedVisualCertification;
}
function publicEvidence() {
  return { certification: certification({ id: "public-certification", status: "publish", targetId: context.targetId }), canonicalHttpStatus: 200 as const, canonicalUrl: "https://example.com/outdoor-digital-sphere/indiana/", correctH1: true as const, brokenImages: 0 as const, clippedHeadings: 0 as const, internalGovernanceLanguage: 0 as const, previewOrDevLinks: 0 as const, unexpectedStateContamination: 0 as const, unsupportedFactualRegression: 0 as const };
}

function authority(operationContext = context) {
  const preflight = issueVerifiedExactOperationPreflight({ context: operationContext, principal, snapshot: snapshot(operationContext.expectedCurrentStatus), draftCertification: operationContext.operation === EXACT_WORDPRESS_PUBLICATION ? certification() : undefined, publicationReceipt: operationContext.operation === EXACT_WORDPRESS_ROLLBACK ? { receiptId: operationContext.sourcePublicationReceiptId!, wordpressObjectId: operationContext.wordpressObjectId, afterContentSha: operationContext.storedPostContentSha, afterStatus: "publish" } : undefined, now: new Date("2030-01-01T00:00:00Z") });
  const grant = issueVerifiedExactOperationGrant({ preflightId: preflight.preflightId, context: operationContext, principal, now: new Date("2030-01-01T00:00:01Z") });
  return { preflight, grant };
}

describe("shared exact publication and rollback service", () => {
  const priorRoot = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "exact-publication-service-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; });
  afterEach(() => { if (priorRoot === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR; else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = priorRoot; rmSync(root, { recursive: true, force: true }); });

  test("exact publication preflight accepts only exact WordPress and certification authority", () => {
    expect(() => assertExactPublicationPreflight({ context, snapshot: snapshot(), draftCertification: certification() })).not.toThrow();
  });

  test.each([
    ["object", { wordpressObjectId: "999" }], ["target", { targetId: "wrong" }], ["site", { siteId: "wrong" }], ["parent", { parentObjectId: "999" }], ["slug", { slug: "wrong" }], ["canonical", { canonicalPath: "/wrong/" }], ["content", { rawPostContent: "changed" }],
  ])("publication preflight blocks wrong %s", (_name, patch) => {
    expect(() => assertExactPublicationPreflight({ context, snapshot: snapshot("draft", patch), draftCertification: certification() })).toThrow("EXACT_PUBLICATION_WORDPRESS_AUTHORITY_MISMATCH");
  });

  test.each([
    ["certification id", certification({ id: "wrong" })], ["artifact", certification({ contentHash: "d".repeat(64) })], ["canonical path", certification({ canonicalPath: "/wrong/" })], ["WordPress status", certification({ status: "publish" })],
  ])("publication preflight blocks wrong %s", (_name, draftCertification) => {
    expect(() => assertExactPublicationPreflight({ context, snapshot: snapshot(), draftCertification })).toThrow("EXACT_PUBLICATION_VISUAL_CERTIFICATION_MISMATCH");
  });

  test("publishes one exact object, verifies canonical/public host, and preserves content", async () => {
    const { preflight, grant } = authority();
    const reads = [snapshot("draft"), snapshot("publish")];
    const transitionStatus = jest.fn(async () => ({ ok: true as const, wordpressObjectId: context.wordpressObjectId, wordpressUrl: publicEvidence().canonicalUrl, beforeStatus: "draft" as const, afterStatus: "publish" as const, mutationPerformed: true as const, contentMutationPerformed: false as const }));
    const receipt = await executeAuthorizedExactWordPressOperation({ context, principal, preflightId: preflight.preflightId, grantId: grant.grantId, site, adapters: { transitionStatus, readExactWordPressAuthority: async () => reads.shift()!, verifyPublicCanonical: async () => ({ status: 200, finalUrl: publicEvidence().canonicalUrl, canonicalUrl: publicEvidence().canonicalUrl }), certifyActualPublicHost: async () => publicEvidence() }, now: new Date("2030-01-01T00:00:02Z") });
    expect(transitionStatus).toHaveBeenCalledWith(expect.objectContaining({ identity: expect.objectContaining({ wordpressObjectId: "20115", parentObjectId: "20114", slug: "indiana", storedPostContentSha: context.storedPostContentSha }), expectedStatus: "draft", intendedStatus: "publish" }));
    expect(receipt).toMatchObject({ lifecycleState: "PUBLIC_CERTIFIED", beforeContentSha: context.storedPostContentSha, afterContentSha: context.storedPostContentSha, publicCertificationId: "public-certification" });
  });

  test("does not automatically rollback when public certification fails", async () => {
    const { preflight, grant } = authority();
    const reads = [snapshot("draft"), snapshot("publish")];
    const transitionStatus = jest.fn(async () => ({ ok: true as const, wordpressObjectId: context.wordpressObjectId, wordpressUrl: publicEvidence().canonicalUrl, beforeStatus: "draft" as const, afterStatus: "publish" as const, mutationPerformed: true as const, contentMutationPerformed: false as const }));
    await expect(executeAuthorizedExactWordPressOperation({ context, principal, preflightId: preflight.preflightId, grantId: grant.grantId, site, adapters: { transitionStatus, readExactWordPressAuthority: async () => reads.shift()!, verifyPublicCanonical: async () => ({ status: 500, finalUrl: publicEvidence().canonicalUrl, canonicalUrl: publicEvidence().canonicalUrl }), certifyActualPublicHost: async () => publicEvidence() } })).rejects.toThrow("EXACT_PUBLICATION_CANONICAL_HTTP_VERIFICATION_FAILED");
    expect(transitionStatus).toHaveBeenCalledTimes(1);
  });

  test("requires a new exact public-host certification with complete geometry and safety evidence", () => {
    expect(() => assertActualPublicHostCertification({ context, evidence: publicEvidence() })).not.toThrow();
    expect(() => assertActualPublicHostCertification({ context, evidence: { ...publicEvidence(), certification: certification({ id: context.visualCertificationId, status: "publish", targetId: context.targetId }) } })).toThrow("EXACT_PUBLIC_HOST_CERTIFICATION_FAILED");
  });

  test("scopes factual regression checks to the approved rich-page root", () => {
    const html = '<nav>Interactive LED Floors</nav><main><div class="saw-page"><h1>Outdoor Digital Sphere in Indiana</h1><p>Plan content around your audience.</p></div></main>';
    expect(extractExactPublicRichPageClaimContent(html)).toContain("Plan content around your audience.");
    expect(extractExactPublicRichPageClaimContent(html)).not.toContain("Interactive LED Floors");
    expect(() => extractExactPublicRichPageClaimContent("<main>No rich page</main>")).toThrow("EXACT_PUBLIC_HOST_RICH_PAGE_ROOT_MISMATCH");
  });

  test("performs an exact separately authorized publish-to-draft rollback with readback", async () => {
    const rollbackContext: ExactPublicationRollbackContext = { ...context, operation: EXACT_WORDPRESS_ROLLBACK, expectedCurrentStatus: "publish", intendedStatus: "draft", sourcePublicationReceiptId: "publication-receipt" };
    const { preflight, grant } = authority(rollbackContext);
    const reads = [snapshot("publish"), snapshot("draft")];
    const transitionStatus = jest.fn(async () => ({ ok: true as const, wordpressObjectId: context.wordpressObjectId, wordpressUrl: publicEvidence().canonicalUrl, beforeStatus: "publish" as const, afterStatus: "draft" as const, mutationPerformed: true as const, contentMutationPerformed: false as const }));
    const receipt = await executeAuthorizedExactWordPressOperation({ context: rollbackContext, principal, preflightId: preflight.preflightId, grantId: grant.grantId, site, adapters: { transitionStatus, readExactWordPressAuthority: async () => reads.shift()! } });
    expect(receipt).toMatchObject({ lifecycleState: "ROLLED_BACK", beforeStatus: "publish", afterStatus: "draft", beforeContentSha: context.storedPostContentSha, afterContentSha: context.storedPostContentSha });
  });

  test("rollback blocks wrong object and wrong artifact before authority issuance", () => {
    const rollbackContext: ExactPublicationRollbackContext = { ...context, operation: EXACT_WORDPRESS_ROLLBACK, expectedCurrentStatus: "publish", intendedStatus: "draft", sourcePublicationReceiptId: "publication-receipt" };
    expect(() => issueVerifiedExactOperationPreflight({ context: rollbackContext, principal, snapshot: snapshot("publish", { wordpressObjectId: "999" }), publicationReceipt: { receiptId: "publication-receipt", wordpressObjectId: context.wordpressObjectId, afterContentSha: context.storedPostContentSha, afterStatus: "publish" } })).toThrow("EXACT_ROLLBACK_WORDPRESS_AUTHORITY_MISMATCH");
    expect(() => issueVerifiedExactOperationPreflight({ context: rollbackContext, principal, snapshot: snapshot("publish"), publicationReceipt: { receiptId: "publication-receipt", wordpressObjectId: context.wordpressObjectId, afterContentSha: "d".repeat(64), afterStatus: "publish" } })).toThrow("EXACT_ROLLBACK_PUBLICATION_RECEIPT_MISMATCH");
  });
});
