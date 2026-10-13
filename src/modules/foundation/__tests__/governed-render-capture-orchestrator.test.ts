import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendRenderedVisualCaptureAudit, listRenderedVisualCaptureAudits } from "../rendered-visual-certification-repository";
import { hashRenderedVisualContent, type RenderedVisualCaptureEvidence } from "../rendered-visual-certification";
import { assertGeneratedCaptureOwnership, runGovernedRenderCapture, type CaptureAuthority } from "../governed-render-capture-orchestrator";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const identity = { organizationId: "org", siteId: "site", pageId: "page", pageRevisionIdentity: "revision-1", canonicalPath: "/", contentHash: hashRenderedVisualContent("source"), renderedContentHash: hashRenderedVisualContent("rendered"), campaignId: null, targetId: null, jobId: null, externalExecutionId: null, wordpressObjectId: "1", wordpressStatus: "draft" };
const authority: CaptureAuthority = { identity, targetUrl: "https://example.com/", allowedOrigins: ["https://example.com"], internalGenesisOrigin: null, internalAuthorization: null, layoutClass: "CONTENT_ARTICLE", mediaAssignments: [] };
const evidence = (captureId: string, viewportClass: "DESKTOP" | "MOBILE", width: number, height: number): Omit<RenderedVisualCaptureEvidence, "screenshotArtifact"> => ({ captureId, viewportClass, viewportWidth: width, viewportHeight: height, documentWidth: width, documentHeight: height, primaryContentBounds: { x: 20, y: 20, width: width - 40, height: height - 40 }, horizontalOverflow: 0, capturedAt: "2026-09-12T12:00:00.000Z", source: { origin: "https://example.com", pathname: "/" }, renderer: { engine: "test", version: "1", userAgent: "test" }, hero: { authority: "NOT_IDENTIFIED", present: null, bounds: null, headingBounds: null, headingLineCount: null, primaryCtaBounds: null, mediaBounds: null, mediaBeforeHero: null, containerAligned: null }, hostIntegration: { headerOverlap: false, footerOverlap: false, blankImageContainers: 0, headerRegression: false, contentWidthBalanced: true, sectionRhythmPass: true, productIntroductionCompositionPass: true, applicationGridPass: true, planningGridPass: true, ctaWidthAlignedWithPage: true, ctaTextBalance: true, ctaButtonProminent: true, excessiveCtaWhitespace: false, ctaHeadingCollision: false, ctaCopyCollision: false, ctaButtonCollision: false, buttonContainerOverflow: false, unexpectedElementCollision: false, stickyHeaderUnexpectedOcclusion: false, planningGridBalanced: true, finalCtaCompositionPass: true }, media: [], sections: [] });

describe("governed render capture orchestration", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "governed-capture-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR; });

  it("persists two immutable hashed captures, a certification, safe audit, and reuses exact current evidence", async () => {
    let calls = 0;
    const adapter = async (input: Parameters<NonNullable<Parameters<typeof runGovernedRenderCapture>[0]["browserAdapter"]>>[0]) => { calls += 1; return { evidence: evidence(input.captureId, input.viewportClass, input.viewport.width, input.viewport.height), bytes: png, imageWidth: input.viewport.width, imageHeight: input.viewport.height, renderedContentHash: identity.renderedContentHash! }; };
    const first = await runGovernedRenderCapture({ authority, mode: "CURRENT", actor: "authorized_operator", browserAdapter: adapter });
    const second = await runGovernedRenderCapture({ authority, mode: "CURRENT", actor: "authorized_operator", browserAdapter: adapter });
    expect(first.reused).toBe(false); expect(second.reused).toBe(true); expect(calls).toBe(2);
    expect(first.certification.captures).toHaveLength(2); expect(first.certification.captures.every((item) => /^[a-f0-9]{64}$/.test(item.screenshotArtifact.sha256))).toBe(true);
    expect(first.ownerDecision).toBe("PENDING"); expect(first.publicationPerformed).toBe(false); expect(first.wordpressMutationPerformed).toBe(false);
    expect(listRenderedVisualCaptureAudits({ organizationId: "org", siteId: "site", pageId: "page" }).map((item) => item.result)).toEqual(["STARTED", "SUCCEEDED"]);
    const persisted = readFileSync(join(root, "rendered-visual-certification-v1.json"), "utf8"); expect(persisted).not.toMatch(/authorization|cookie|bearer|password/i);
  });

  it("fails before artifact persistence when the capture set exceeds its byte budget", async () => {
    const tooLarge = new Uint8Array(10_000_001); tooLarge.set(png);
    await expect(runGovernedRenderCapture({ authority, mode: "CURRENT", actor: "authorized_operator", browserAdapter: async (input) => ({ evidence: evidence(input.captureId, input.viewportClass, input.viewport.width, input.viewport.height), bytes: tooLarge, imageWidth: input.viewport.width, imageHeight: input.viewport.height, renderedContentHash: identity.renderedContentHash! }) })).rejects.toThrow("CAPTURE_SET_TOO_LARGE");
    expect(listRenderedVisualCaptureAudits({ organizationId: "org", siteId: "site", pageId: "page" }).at(-1)?.result).toBe("FAILED");
  });

  it("rejects credential-like audit content", () => {
    expect(() => appendRenderedVisualCaptureAudit({ actor: "authorization=secret", organizationId: "org", siteId: "site", pageId: "page", pageRevisionIdentity: "r1", certificationId: null, captureSetId: null, startedAt: new Date().toISOString(), completedAt: null, result: "FAILED", failureReason: null })).toThrow("VISUAL_CAPTURE_AUDIT_SENSITIVE_MATERIAL_FORBIDDEN");
  });

  it("fails closed for unauthorized scope and cross-site WordPress objects", () => {
    const valid = { requestedOrganizationId: "org", requestedSiteId: "site", resolvedOrganizationId: "org", resolvedSiteId: "site", wordpressObjectId: "13084", traceWordpressObjectId: "13084", wordpressVerified: true };
    expect(() => assertGeneratedCaptureOwnership(valid)).not.toThrow();
    expect(() => assertGeneratedCaptureOwnership({ ...valid, resolvedOrganizationId: "other-org" })).toThrow("AUTHORITY_MISMATCH");
    expect(() => assertGeneratedCaptureOwnership({ ...valid, resolvedSiteId: "other-site" })).toThrow("AUTHORITY_MISMATCH");
    expect(() => assertGeneratedCaptureOwnership({ ...valid, traceWordpressObjectId: "999" })).toThrow("AUTHORITY_MISMATCH");
    expect(() => assertGeneratedCaptureOwnership({ ...valid, wordpressVerified: false })).toThrow("AUTHORITY_MISMATCH");
  });
});