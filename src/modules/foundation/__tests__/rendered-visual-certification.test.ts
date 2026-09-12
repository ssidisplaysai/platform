jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  RENDERED_VISUAL_CERTIFICATION_CONTRACT,
  RENDERED_VISUAL_CERTIFICATION_SCHEMA_VERSION,
  deriveRenderedVisualFindings,
  hashRenderedVisualContent,
  renderedVisualOverallState,
  renderedVisualUtilization,
  validateRenderedVisualCertification,
  type RenderedVisualCaptureEvidence,
  type RenderedVisualCertification,
} from "../rendered-visual-certification";
import {
  decideRenderedVisualCertification,
  getRenderedVisualCertificationState,
  listRenderedVisualOwnerDecisions,
  readRenderedVisualCaptureArtifact,
  saveRenderedVisualCertification,
  storeRenderedVisualCaptureArtifact,
} from "../rendered-visual-certification-repository";

let persistenceRoot: string;
const hash = (value: string) => hashRenderedVisualContent(value);

function capture(viewportClass: "DESKTOP" | "MOBILE", overrides: Partial<RenderedVisualCaptureEvidence> = {}): RenderedVisualCaptureEvidence {
  const width = viewportClass === "DESKTOP" ? 1440 : 375;
  return {
    captureId: `capture-${viewportClass.toLowerCase()}`,
    viewportClass,
    viewportWidth: width,
    viewportHeight: viewportClass === "DESKTOP" ? 1000 : 812,
    documentWidth: width,
    documentHeight: 4200,
    primaryContentBounds: { x: viewportClass === "DESKTOP" ? 220 : 0, y: 0, width: viewportClass === "DESKTOP" ? 1000 : 375, height: 4200 },
    horizontalOverflow: 0,
    screenshotArtifact: { reference: `visual-evidence/capture-${viewportClass.toLowerCase()}.png`, sha256: hash(viewportClass), byteSize: 1000, width, height: 812, mediaType: "image/png" },
    capturedAt: "2026-09-12T12:00:00.000Z",
    source: { origin: "https://example.com", pathname: "/page/" },
    renderer: { engine: "Chromium", version: "140", userAgent: null },
    hero: { authority: "NOT_IDENTIFIED", present: null, bounds: null, headingBounds: null, headingLineCount: null, primaryCtaBounds: null, mediaBounds: null, mediaBeforeHero: null, containerAligned: null },
    media: [],
    sections: [],
    ...overrides,
  };
}

function certification(overrides: Partial<RenderedVisualCertification> = {}): RenderedVisualCertification {
  const captures = overrides.captures ?? [capture("DESKTOP"), capture("MOBILE")];
  const findings = deriveRenderedVisualFindings({ layoutClass: overrides.layoutClass ?? "UNKNOWN", captures });
  return {
    certificationId: "visual-certification-1",
    contract: RENDERED_VISUAL_CERTIFICATION_CONTRACT,
    schemaVersion: RENDERED_VISUAL_CERTIFICATION_SCHEMA_VERSION,
    identity: { organizationId: "org", siteId: "site", pageId: "page", pageRevisionIdentity: "page-r1", canonicalPath: "/page/", contentHash: hash("content-r1"), renderedContentHash: hash("render-r1"), campaignId: null, targetId: null, jobId: null, externalExecutionId: null, wordpressObjectId: "10", wordpressStatus: "draft" },
    layoutClass: "UNKNOWN",
    captureSetId: "capture-set-1",
    captures,
    findings,
    overallState: renderedVisualOverallState(findings),
    capturedAt: "2026-09-12T12:00:00.000Z",
    createdAt: "2026-09-12T12:01:00.000Z",
    createdBy: "owner",
    mutationPerformed: false,
    ...overrides,
  };
}

beforeEach(() => {
  persistenceRoot = mkdtempSync(join(tmpdir(), "genesis-visual-cert-"));
  process.env.GCP_FOUNDATION_PERSISTENCE_DIR = persistenceRoot;
});

afterEach(() => {
  rmSync(persistenceRoot, { recursive: true, force: true });
  delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
});

describe("rendered visual certification contract", () => {
  test("validates exact desktop/mobile capture identity and artifact hashes", () => {
    const result = validateRenderedVisualCertification(certification());
    expect(result.contract).toBe("rendered-visual-certification-v1");
    expect(result.captures.map((item) => item.viewportClass)).toEqual(["DESKTOP", "MOBILE"]);
    expect(result.captures[0].screenshotArtifact.sha256).toHaveLength(64);
    expect(renderedVisualUtilization(result.captures[0])).toBeCloseTo(1000 / 1440);
    expect(() => validateRenderedVisualCertification(certification({ captures: [capture("DESKTOP")] }))).toThrow("VISUAL_DESKTOP_AND_MOBILE_CAPTURES_REQUIRED");
    expect(() => validateRenderedVisualCertification(certification({ overallState: "BLOCKED" }))).toThrow("VISUAL_CERTIFICATION_OVERALL_STATE_INVALID");
  });

  test("stores screenshot bytes outside JSON and verifies immutable artifact identity", () => {
    const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
    const artifact = storeRenderedVisualCaptureArtifact({ organizationId: "org", siteId: "site", captureSetId: "set", captureId: "desktop", mediaType: "image/png", bytes, width: 1440, height: 1000 });
    expect(artifact.reference).toBe("rendered-visual-artifacts/org/site/set/desktop.png");
    expect(artifact.sha256).toBe(hashRenderedVisualContent(bytes));
    expect(readRenderedVisualCaptureArtifact(artifact)).toEqual(bytes);
    expect(() => readRenderedVisualCaptureArtifact({ ...artifact, sha256: "f".repeat(64) })).toThrow("VISUAL_CAPTURE_ARTIFACT_HASH_MISMATCH");
  });

  test("derives only bounded provenance-backed findings and preserves NOT_EVALUATED", () => {
    const desktop = capture("DESKTOP", { viewportWidth: 1700, primaryContentBounds: { x: 600, y: 0, width: 500, height: 4200 }, sections: [{ sectionId: "section-2", bounds: { x: 600, y: 1000, width: 500, height: 500 }, headingBounds: null, headingLineCount: null, contentBounds: null, mediaBounds: null, gapBefore: 500 }], media: [{ assignmentId: "assignment-product", semanticRole: "PRODUCT_AUTHORITY", mediaId: "77", assigned: true, rendered: false, renderedBounds: null, contextId: "hero", aboveFold: null }] });
    const mobile = capture("MOBILE", { primaryContentBounds: { x: 0, y: 0, width: 480, height: 4200 } });
    const findings = deriveRenderedVisualFindings({ layoutClass: "FULL_WIDTH_MARKETING_PAGE", captures: [desktop, mobile] });
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ findingCode: "DESKTOP_LAYOUT_REMAINS_MOBILE_WIDTH", state: "WARNING", category: "RESPONSIVE", rule: expect.objectContaining({ ruleId: "RVC_DESKTOP_REMAINS_MOBILE_WIDTH" }) }),
      expect.objectContaining({ findingCode: "DESKTOP_PRODUCT_AUTHORITY_ASSIGNED_NOT_RENDERED", state: "WARNING", category: "MEDIA" }),
      expect.objectContaining({ findingCode: "DESKTOP_UNUSUALLY_LARGE_SECTION_GAP:section-2", state: "WARNING", category: "SECTION" }),
      expect.objectContaining({ findingCode: "DESKTOP_HERO_GEOMETRY", state: "NOT_EVALUATED" }),
    ]));
    expect(deriveRenderedVisualFindings({ layoutClass: "CONTENT_ARTICLE", captures: [desktop, mobile] })).toEqual(expect.arrayContaining([expect.objectContaining({ findingCode: "DESKTOP_LAYOUT_REMAINS_MOBILE_WIDTH", state: "NOT_EVALUATED" })]));
  });

  test("captures the Commercial Stainless constrained-desktop learning without claiming a mobile-width clone", () => {
    const desktop = capture("DESKTOP", { viewportWidth: 1700, viewportHeight: 1000, documentWidth: 1685, documentHeight: 6303, primaryContentBounds: { x: 540, y: 854, width: 605, height: 669 }, hero: { authority: "SEMANTIC_HERO", present: true, bounds: { x: 540, y: 854, width: 605, height: 669 }, headingBounds: { x: 540, y: 892, width: 605, height: 343 }, headingLineCount: 5, primaryCtaBounds: { x: 1109, y: 769, width: 121, height: 64 }, mediaBounds: null, mediaBeforeHero: true, containerAligned: false } });
    const mobile = capture("MOBILE", { viewportWidth: 375, viewportHeight: 812, documentWidth: 360, documentHeight: 8361, primaryContentBounds: { x: 44, y: 536, width: 272, height: 826 } });
    const findings = deriveRenderedVisualFindings({ layoutClass: "FULL_WIDTH_MARKETING_PAGE", captures: [desktop, mobile] });
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ findingCode: "FULL_WIDTH_DESKTOP_CONTENT_CONSTRAINED", state: "WARNING", summary: expect.stringContaining("36%") }),
      expect.objectContaining({ findingCode: "DESKTOP_LAYOUT_REMAINS_MOBILE_WIDTH", state: "PASS" }),
      expect.objectContaining({ findingCode: "DESKTOP_HERO_GEOMETRY", state: "PASS" }),
    ]));
  });

  test("distinguishes assigned media from rendered media and requires rendered bounds", () => {
    const assignedRendered = capture("DESKTOP", { media: [{ assignmentId: "a", semanticRole: "CONTEXTUAL_IN_USE", mediaId: "88", assigned: true, rendered: true, renderedBounds: { x: 0, y: 100, width: 900, height: 500 }, contextId: "hero", aboveFold: true }] });
    expect(validateRenderedVisualCertification(certification({ captures: [assignedRendered, capture("MOBILE")] })).captures[0].media[0]).toMatchObject({ assigned: true, rendered: true });
    expect(() => validateRenderedVisualCertification(certification({ captures: [capture("DESKTOP", { media: [{ assignmentId: "a", semanticRole: "CONTEXTUAL_IN_USE", mediaId: "88", assigned: true, rendered: true, renderedBounds: null, contextId: null, aboveFold: null }] }), capture("MOBILE")] }))).toThrow("VISUAL_RENDERED_MEDIA_BOUNDS_REQUIRED");
  });

  test("persists historical owner decisions and makes approval stale after page identity changes", () => {
    const saved = saveRenderedVisualCertification(certification());
    const decision = decideRenderedVisualCertification({ certificationId: saved.certificationId, decision: "APPROVED", actor: "site-owner", note: "Reviewed exact captures.", currentIdentity: saved.identity, now: "2026-09-12T12:02:00.000Z" });
    expect(decision).toMatchObject({ decision: "APPROVED", publicationAuthorized: false, contentHash: saved.identity.contentHash });
    expect(getRenderedVisualCertificationState({ currentIdentity: saved.identity })).toMatchObject({ certificationState: "CURRENT", decisionState: "CURRENT", decision: { decision: "APPROVED" } });
    const changedIdentity = { ...saved.identity, pageRevisionIdentity: "page-r2", contentHash: hash("content-r2") };
    expect(getRenderedVisualCertificationState({ currentIdentity: changedIdentity })).toMatchObject({ certificationState: "STALE", decisionState: "STALE", decision: { decision: "APPROVED" } });
    expect(getRenderedVisualCertificationState({ currentIdentity: { ...saved.identity, wordpressObjectId: "11" } })).toMatchObject({ certificationState: "STALE", decisionState: "STALE" });
    expect(listRenderedVisualOwnerDecisions(saved.certificationId)).toHaveLength(1);
    expect(() => decideRenderedVisualCertification({ certificationId: saved.certificationId, decision: "APPROVED", actor: "owner", currentIdentity: changedIdentity })).toThrow("VISUAL_CERTIFICATION_STALE");
  });

  test("keeps visual approval independent from launch, campaign, and publication authority", () => {
    const saved = saveRenderedVisualCertification(certification({ identity: { ...certification().identity, campaignId: "campaign", targetId: "target", jobId: "job", wordpressStatus: "draft" } }));
    const decision = decideRenderedVisualCertification({ certificationId: saved.certificationId, decision: "APPROVED", actor: "owner", currentIdentity: saved.identity });
    expect(decision.publicationAuthorized).toBe(false);
    expect(saved.identity.wordpressStatus).toBe("draft");
    expect(saved).not.toHaveProperty("launchCertification");
    expect(saved).not.toHaveProperty("publicationPolicy");
    expect(saved).not.toHaveProperty("campaignAuthorization");
  });

  test("rejects credential-bearing owner notes and credential-bearing source URLs", () => {
    const saved = saveRenderedVisualCertification(certification());
    expect(() => decideRenderedVisualCertification({ certificationId: saved.certificationId, decision: "NEEDS_FIX", actor: "owner", note: "token=secret", currentIdentity: saved.identity })).toThrow("VISUAL_DECISION_NOTE_INVALID");
    expect(() => validateRenderedVisualCertification(certification({ captures: [capture("DESKTOP", { source: { origin: "https://user:pass@example.com", pathname: "/" } }), capture("MOBILE")] }))).toThrow("VISUAL_CAPTURE_SOURCE_INVALID");
    expect(() => validateRenderedVisualCertification(certification({ createdBy: "authorization=Bearer-secret" }))).toThrow("VISUAL_CERTIFICATION_SENSITIVE_MATERIAL_FORBIDDEN");
  });
});