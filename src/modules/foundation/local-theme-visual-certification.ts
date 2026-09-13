import type { RenderedVisualBounds, RenderedVisualCaptureEvidence, RenderedVisualScreenshotArtifact } from "./rendered-visual-certification";

export const LOCAL_THEME_VISUAL_CERTIFICATION_CONTRACT = "local-theme-visual-certification-v1" as const;
export type LocalThemeViewport = "DESKTOP_1440" | "DESKTOP_1024" | "TABLET_768" | "MOBILE_375";
export type LocalThemeVisualCapture = { captureId: string; viewport: LocalThemeViewport; viewportWidth: number; viewportHeight: number; documentWidth: number; documentHeight: number; horizontalOverflow: number; primaryContentBounds: RenderedVisualBounds | null; hero: RenderedVisualCaptureEvidence["hero"]; media: RenderedVisualCaptureEvidence["media"]; sections: RenderedVisualCaptureEvidence["sections"]; screenshotArtifact: RenderedVisualScreenshotArtifact; renderedContentHash: string; capturedAt: string };
export type LocalThemeVisualFinding = { code: string; state: "PASS" | "FAIL" | "OWNER_REVIEW"; summary: string; evidence: readonly string[] };
export type LocalThemeVisualCertification = { contract: typeof LOCAL_THEME_VISUAL_CERTIFICATION_CONTRACT; schemaVersion: 1; certificationId: string; bundleId: string; rendererVersion: string; pageRevisionIdentity: string; localThemeProfileId: string; captures: readonly LocalThemeVisualCapture[]; findings: readonly LocalThemeVisualFinding[]; state: "READY_FOR_OWNER_REVIEW" | "BLOCKED"; ownerReviewRequired: true; countsAsWordPressRenderCertification: false; wordpressMutationPerformed: false; campaignMutationPerformed: false; publicationPerformed: false; dispatchPerformed: false; createdAt: string };

export function evaluateLocalThemeVisuals(input: { captures: readonly LocalThemeVisualCapture[]; expectedMediaRoles: readonly string[]; localizationLevel: number }): LocalThemeVisualFinding[] {
  const findings: LocalThemeVisualFinding[] = []; const evidence = input.captures.map((capture) => capture.captureId);
  const add = (code: string, state: LocalThemeVisualFinding["state"], summary: string, refs = evidence) => findings.push({ code, state, summary, evidence: refs });
  add("RESPONSIVE_VIEWPORT_SET", input.captures.length === 4 && new Set(input.captures.map((item) => item.viewportWidth)).size === 4 ? "PASS" : "FAIL", "Required 1440, 1024, 768, and 375 viewport evidence is present.");
  add("HORIZONTAL_OVERFLOW", input.captures.every((item) => item.horizontalOverflow === 0) ? "PASS" : "FAIL", "Horizontal overflow was measured at every viewport.");
  add("HERO_COMPOSITION", input.captures.every((item) => item.hero.present && item.hero.headingBounds && item.hero.primaryCtaBounds) ? "PASS" : "FAIL", "Hero, heading, and primary CTA geometry are visible at every viewport.");
  for (const role of input.expectedMediaRoles) { const rendered = input.captures.every((capture) => capture.media.some((item) => item.semanticRole === role && item.rendered)); add(`MEDIA_${role}`, rendered ? "PASS" : "FAIL", `${role.replaceAll("_", " ")} is rendered at every required viewport.`); }
  add("SECTION_RHYTHM", input.captures.every((item) => item.sections.length >= 6) ? "PASS" : "FAIL", "The preview retains a multi-section editorial rhythm across viewports.");
  add("LOCAL_THEME_INTEGRATION", input.localizationLevel >= 1 ? "OWNER_REVIEW" : "FAIL", `Level ${input.localizationLevel} regional expression is present; perceived authenticity requires owner judgment.`);
  add("BRAND_LOCAL_BALANCE", "OWNER_REVIEW", "Geometry cannot prove that local atmosphere remains subordinate to ProjectorEnclosure brand authority.");
  add("IN_USE_CREDIBILITY", "OWNER_REVIEW", "Product grounding is recorded, but installation plausibility requires owner review.");
  add("APPLICATION_EXPERIENCE", "OWNER_REVIEW", "Projection-mapping prominence is measurable; application impact remains an owner-review judgment.");
  return findings;
}