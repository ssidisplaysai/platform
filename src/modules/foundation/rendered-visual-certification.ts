import { createHash } from "node:crypto";

export const RENDERED_VISUAL_CERTIFICATION_CONTRACT = "rendered-visual-certification-v1" as const;
export const RENDERED_VISUAL_CERTIFICATION_SCHEMA_VERSION = 1 as const;
export const RENDERED_VISUAL_RULESET_VERSION = "genesis-rendered-visual-rules-v1" as const;

export type RenderedVisualViewportClass = "DESKTOP" | "MOBILE";
export type RenderedVisualFindingState = "PASS" | "WARNING" | "BLOCKED" | "NOT_EVALUATED";
export type RenderedVisualFindingCategory = "LAYOUT" | "HERO" | "MEDIA" | "RESPONSIVE" | "OVERFLOW" | "SECTION" | "TYPOGRAPHY";
export type RenderedVisualLayoutClass = "FULL_WIDTH_MARKETING_PAGE" | "CONTENT_ARTICLE" | "APPLICATION_UI" | "LANDING_PAGE" | "UNKNOWN";
export type RenderedVisualOwnerDecisionState = "PENDING" | "APPROVED" | "NEEDS_FIX" | "BLOCKED";

export type RenderedVisualBounds = { x: number; y: number; width: number; height: number };
export type RenderedVisualScreenshotArtifact = { reference: string; sha256: string; byteSize: number; width: number; height: number; mediaType: "image/png" | "image/jpeg" | "image/webp" };
export type RenderedVisualPageIdentity = {
  organizationId: string;
  siteId: string;
  pageId: string;
  pageRevisionIdentity: string;
  canonicalPath: string;
  contentHash: string;
  renderedContentHash: string | null;
  campaignId: string | null;
  targetId: string | null;
  jobId: string | null;
  externalExecutionId: string | null;
  wordpressObjectId: string | null;
  wordpressStatus: string | null;
};

export type RenderedVisualCaptureEvidence = {
  captureId: string;
  viewportClass: RenderedVisualViewportClass;
  viewportWidth: number;
  viewportHeight: number;
  documentWidth: number;
  documentHeight: number;
  primaryContentBounds: RenderedVisualBounds | null;
  horizontalOverflow: number;
  screenshotArtifact: RenderedVisualScreenshotArtifact;
  capturedAt: string;
  source: { origin: string; pathname: string };
  renderer: { engine: string; version: string | null; userAgent: string | null };
  hero: {
    authority: "SEMANTIC_HERO" | "EXPLICIT_SELECTOR" | "NOT_IDENTIFIED";
    present: boolean | null;
    bounds: RenderedVisualBounds | null;
    headingBounds: RenderedVisualBounds | null;
    headingLineCount: number | null;
    primaryCtaBounds: RenderedVisualBounds | null;
    mediaBounds: RenderedVisualBounds | null;
    mediaBeforeHero: boolean | null;
    containerAligned: boolean | null;
  };
  media: readonly {
    assignmentId: string | null;
    semanticRole: "PRODUCT_AUTHORITY" | "CONTEXTUAL_IN_USE";
    mediaId: string | null;
    assigned: boolean;
    rendered: boolean;
    renderedBounds: RenderedVisualBounds | null;
    contextId: string | null;
    aboveFold: boolean | null;
  }[];
  sections: readonly {
    sectionId: string;
    bounds: RenderedVisualBounds;
    headingBounds: RenderedVisualBounds | null;
    headingLineCount: number | null;
    contentBounds: RenderedVisualBounds | null;
    mediaBounds: RenderedVisualBounds | null;
    gapBefore: number | null;
  }[];
};

export type RenderedVisualFinding = {
  findingCode: string;
  category: RenderedVisualFindingCategory;
  state: RenderedVisualFindingState;
  summary: string;
  evidenceReferences: readonly string[];
  rule: { ruleId: string; version: typeof RENDERED_VISUAL_RULESET_VERSION; thresholds: Readonly<Record<string, number | string | boolean>> };
  safeRecommendation: string | null;
};

export type RenderedVisualCertification = {
  certificationId: string;
  contract: typeof RENDERED_VISUAL_CERTIFICATION_CONTRACT;
  schemaVersion: typeof RENDERED_VISUAL_CERTIFICATION_SCHEMA_VERSION;
  identity: RenderedVisualPageIdentity;
  layoutClass: RenderedVisualLayoutClass;
  captureSetId: string;
  captures: readonly RenderedVisualCaptureEvidence[];
  findings: readonly RenderedVisualFinding[];
  overallState: RenderedVisualFindingState;
  capturedAt: string;
  createdAt: string;
  createdBy: string;
  mutationPerformed: false;
};

export type RenderedVisualOwnerDecision = {
  decisionId: string;
  certificationId: string;
  captureSetId: string;
  pageRevisionIdentity: string;
  contentHash: string;
  renderedContentHash: string | null;
  decision: RenderedVisualOwnerDecisionState;
  note: string | null;
  decidedAt: string;
  decidedBy: string;
  publicationAuthorized: false;
};

export const RENDERED_VISUAL_RULES = {
  horizontalOverflow: { ruleId: "RVC_HORIZONTAL_OVERFLOW", version: RENDERED_VISUAL_RULESET_VERSION, minimumOverflowPixels: 1 },
  constrainedFullWidthDesktop: { ruleId: "RVC_FULL_WIDTH_DESKTOP_CONTENT_CONSTRAINED", version: RENDERED_VISUAL_RULESET_VERSION, desktopMinimumViewport: 1280, maximumContentUtilization: 0.45, minimumSymmetricUnusedSpace: 240 },
  desktopRemainsMobileWidth: { ruleId: "RVC_DESKTOP_REMAINS_MOBILE_WIDTH", version: RENDERED_VISUAL_RULESET_VERSION, desktopMinimumViewport: 1280, mobileMaximumContentWidth: 640, maximumDesktopToMobileWidthRatio: 1.15, minimumSymmetricUnusedSpace: 240 },
  assignedMediaNotRendered: { ruleId: "RVC_ASSIGNED_MEDIA_NOT_RENDERED", version: RENDERED_VISUAL_RULESET_VERSION },
  unusuallyLargeSectionGap: { ruleId: "RVC_UNUSUALLY_LARGE_SECTION_GAP", version: RENDERED_VISUAL_RULESET_VERSION, minimumPixels: 240, viewportHeightRatio: 0.35 },
  heroAuthorityMissing: { ruleId: "RVC_HERO_AUTHORITY_MISSING", version: RENDERED_VISUAL_RULESET_VERSION },
} as const;

function required(value: string, code: string): string { const normalized = value.trim(); if (!normalized) throw new Error(code); return normalized; }
function finite(value: number, code: string): number { if (!Number.isFinite(value) || value < 0) throw new Error(code); return value; }
function sha256(value: string, code: string): string { const normalized = value.trim().toLowerCase(); if (!/^[0-9a-f]{64}$/.test(normalized)) throw new Error(code); return normalized; }
function timestamp(value: string, code: string): string { if (!Number.isFinite(Date.parse(value))) throw new Error(code); return value; }
function safeSource(source: RenderedVisualCaptureEvidence["source"]): void { const origin = new URL(source.origin); if (!/^https?:$/.test(origin.protocol) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") throw new Error("VISUAL_CAPTURE_SOURCE_INVALID"); if (!source.pathname.startsWith("/") || source.pathname.includes("?") || source.pathname.includes("#")) throw new Error("VISUAL_CAPTURE_PATH_INVALID"); }
function safeArtifactReference(value: string): void { required(value, "VISUAL_ARTIFACT_REFERENCE_REQUIRED"); if (value.includes("..") || value.includes("\\")) throw new Error("VISUAL_ARTIFACT_REFERENCE_INVALID"); if (/^https?:\/\//i.test(value)) { const url = new URL(value); if (url.username || url.password || url.search || url.hash) throw new Error("VISUAL_ARTIFACT_REFERENCE_INVALID"); } }
function bounds(value: RenderedVisualBounds | null, code: string): void { if (!value) return; finite(value.x, code); finite(value.y, code); finite(value.width, code); finite(value.height, code); }
function containsSensitiveMaterial(value: unknown): boolean { if (typeof value === "string") return /(?:\bBearer\s+[A-Za-z0-9._+/=-]+|\b(?:password|authorization|cookie|secret|token|api[_-]?key)\s*[:=]\s*\S+)/i.test(value); if (Array.isArray(value)) return value.some(containsSensitiveMaterial); if (value && typeof value === "object") return Object.values(value).some(containsSensitiveMaterial); return false; }

export function hashRenderedVisualContent(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function renderedVisualUtilization(capture: Pick<RenderedVisualCaptureEvidence, "viewportWidth" | "primaryContentBounds">): number | null {
  if (!capture.primaryContentBounds || capture.viewportWidth <= 0) return null;
  return capture.primaryContentBounds.width / capture.viewportWidth;
}

export function validateRenderedVisualCertification(certification: RenderedVisualCertification): RenderedVisualCertification {
  if (containsSensitiveMaterial(certification)) throw new Error("VISUAL_CERTIFICATION_SENSITIVE_MATERIAL_FORBIDDEN");
  if (certification.contract !== RENDERED_VISUAL_CERTIFICATION_CONTRACT || certification.schemaVersion !== RENDERED_VISUAL_CERTIFICATION_SCHEMA_VERSION) throw new Error("VISUAL_CERTIFICATION_SCHEMA_INVALID");
  required(certification.certificationId, "VISUAL_CERTIFICATION_ID_REQUIRED"); required(certification.captureSetId, "VISUAL_CAPTURE_SET_REQUIRED"); required(certification.identity.organizationId, "VISUAL_ORGANIZATION_REQUIRED"); required(certification.identity.siteId, "VISUAL_SITE_REQUIRED"); required(certification.identity.pageId, "VISUAL_PAGE_REQUIRED"); required(certification.identity.pageRevisionIdentity, "VISUAL_PAGE_REVISION_REQUIRED"); required(certification.identity.canonicalPath, "VISUAL_CANONICAL_PATH_REQUIRED"); sha256(certification.identity.contentHash, "VISUAL_CONTENT_HASH_INVALID"); if (certification.identity.renderedContentHash) sha256(certification.identity.renderedContentHash, "VISUAL_RENDERED_HASH_INVALID"); timestamp(certification.capturedAt, "VISUAL_CAPTURE_TIME_INVALID"); timestamp(certification.createdAt, "VISUAL_CREATED_TIME_INVALID"); required(certification.createdBy, "VISUAL_CREATOR_REQUIRED");
  const classes = new Set(certification.captures.map((capture) => capture.viewportClass)); if (!classes.has("DESKTOP") || !classes.has("MOBILE")) throw new Error("VISUAL_DESKTOP_AND_MOBILE_CAPTURES_REQUIRED");
  const captureIds = new Set<string>();
  for (const capture of certification.captures) {
    required(capture.captureId, "VISUAL_CAPTURE_ID_REQUIRED"); if (captureIds.has(capture.captureId)) throw new Error("VISUAL_CAPTURE_ID_DUPLICATE"); captureIds.add(capture.captureId);
    finite(capture.viewportWidth, "VISUAL_VIEWPORT_INVALID"); finite(capture.viewportHeight, "VISUAL_VIEWPORT_INVALID"); finite(capture.documentWidth, "VISUAL_DOCUMENT_GEOMETRY_INVALID"); finite(capture.documentHeight, "VISUAL_DOCUMENT_GEOMETRY_INVALID"); finite(capture.horizontalOverflow, "VISUAL_OVERFLOW_INVALID"); bounds(capture.primaryContentBounds, "VISUAL_CONTENT_BOUNDS_INVALID"); safeSource(capture.source);
    safeArtifactReference(capture.screenshotArtifact.reference); sha256(capture.screenshotArtifact.sha256, "VISUAL_ARTIFACT_HASH_INVALID"); finite(capture.screenshotArtifact.byteSize, "VISUAL_ARTIFACT_SIZE_INVALID"); finite(capture.screenshotArtifact.width, "VISUAL_ARTIFACT_DIMENSIONS_INVALID"); finite(capture.screenshotArtifact.height, "VISUAL_ARTIFACT_DIMENSIONS_INVALID"); timestamp(capture.capturedAt, "VISUAL_CAPTURE_TIME_INVALID"); required(capture.renderer.engine, "VISUAL_RENDERER_REQUIRED");
    bounds(capture.hero.bounds, "VISUAL_HERO_BOUNDS_INVALID"); bounds(capture.hero.headingBounds, "VISUAL_HEADING_BOUNDS_INVALID"); bounds(capture.hero.primaryCtaBounds, "VISUAL_CTA_BOUNDS_INVALID"); bounds(capture.hero.mediaBounds, "VISUAL_HERO_MEDIA_BOUNDS_INVALID");
    for (const media of capture.media) { if (media.rendered && !media.renderedBounds) throw new Error("VISUAL_RENDERED_MEDIA_BOUNDS_REQUIRED"); bounds(media.renderedBounds, "VISUAL_MEDIA_BOUNDS_INVALID"); }
    for (const section of capture.sections) { required(section.sectionId, "VISUAL_SECTION_ID_REQUIRED"); bounds(section.bounds, "VISUAL_SECTION_BOUNDS_INVALID"); bounds(section.headingBounds, "VISUAL_SECTION_HEADING_INVALID"); bounds(section.contentBounds, "VISUAL_SECTION_CONTENT_INVALID"); bounds(section.mediaBounds, "VISUAL_SECTION_MEDIA_INVALID"); if (section.gapBefore !== null) finite(section.gapBefore, "VISUAL_SECTION_GAP_INVALID"); }
  }
  for (const finding of certification.findings) { required(finding.findingCode, "VISUAL_FINDING_CODE_REQUIRED"); required(finding.rule.ruleId, "VISUAL_FINDING_RULE_REQUIRED"); if (finding.rule.version !== RENDERED_VISUAL_RULESET_VERSION) throw new Error("VISUAL_FINDING_RULE_VERSION_INVALID"); if (finding.evidenceReferences.some((reference) => !captureIds.has(reference.split("#")[0]))) throw new Error("VISUAL_FINDING_EVIDENCE_UNKNOWN"); }
  if (certification.overallState !== renderedVisualOverallState(certification.findings)) throw new Error("VISUAL_CERTIFICATION_OVERALL_STATE_INVALID");
  return structuredClone(certification);
}

function finding(input: Omit<RenderedVisualFinding, "rule"> & { rule: { ruleId: string; thresholds?: Readonly<Record<string, number | string | boolean>> } }): RenderedVisualFinding { return { ...input, rule: { ruleId: input.rule.ruleId, version: RENDERED_VISUAL_RULESET_VERSION, thresholds: input.rule.thresholds ?? {} } }; }

export function deriveRenderedVisualFindings(input: { layoutClass: RenderedVisualLayoutClass; captures: readonly RenderedVisualCaptureEvidence[] }): RenderedVisualFinding[] {
  const desktop = input.captures.find((capture) => capture.viewportClass === "DESKTOP") ?? null;
  const mobile = input.captures.find((capture) => capture.viewportClass === "MOBILE") ?? null;
  const findings: RenderedVisualFinding[] = [];
  for (const capture of input.captures) findings.push(finding({ findingCode: `${capture.viewportClass}_HORIZONTAL_OVERFLOW`, category: "OVERFLOW", state: capture.horizontalOverflow >= RENDERED_VISUAL_RULES.horizontalOverflow.minimumOverflowPixels ? "BLOCKED" : "PASS", summary: capture.horizontalOverflow > 0 ? `${capture.horizontalOverflow}px horizontal overflow measured.` : "No horizontal overflow measured.", evidenceReferences: [capture.captureId], rule: { ruleId: RENDERED_VISUAL_RULES.horizontalOverflow.ruleId, thresholds: { minimumOverflowPixels: RENDERED_VISUAL_RULES.horizontalOverflow.minimumOverflowPixels } }, safeRecommendation: capture.horizontalOverflow > 0 ? "Inspect the widest rendered element and contain it within the viewport." : null }));
  if (!desktop?.primaryContentBounds || input.layoutClass !== "FULL_WIDTH_MARKETING_PAGE") findings.push(finding({ findingCode: "FULL_WIDTH_DESKTOP_CONTENT_CONSTRAINED", category: "LAYOUT", state: "NOT_EVALUATED", summary: "Constrained desktop content requires full-width marketing-page authority and measured primary content bounds.", evidenceReferences: desktop ? [desktop.captureId] : [], rule: { ruleId: RENDERED_VISUAL_RULES.constrainedFullWidthDesktop.ruleId, thresholds: RENDERED_VISUAL_RULES.constrainedFullWidthDesktop }, safeRecommendation: null }));
  else {
    const utilization = renderedVisualUtilization(desktop) ?? 1;
    const symmetricUnused = Math.min(desktop.primaryContentBounds.x, desktop.viewportWidth - desktop.primaryContentBounds.x - desktop.primaryContentBounds.width);
    const warned = desktop.viewportWidth >= RENDERED_VISUAL_RULES.constrainedFullWidthDesktop.desktopMinimumViewport && utilization <= RENDERED_VISUAL_RULES.constrainedFullWidthDesktop.maximumContentUtilization && symmetricUnused >= RENDERED_VISUAL_RULES.constrainedFullWidthDesktop.minimumSymmetricUnusedSpace;
    findings.push(finding({ findingCode: "FULL_WIDTH_DESKTOP_CONTENT_CONSTRAINED", category: "LAYOUT", state: warned ? "WARNING" : "PASS", summary: warned ? `Primary content uses ${Math.round(utilization * 100)}% of the desktop viewport with substantial symmetric unused space.` : "Primary content is outside the bounded constrained-desktop warning pattern.", evidenceReferences: [desktop.captureId], rule: { ruleId: RENDERED_VISUAL_RULES.constrainedFullWidthDesktop.ruleId, thresholds: RENDERED_VISUAL_RULES.constrainedFullWidthDesktop }, safeRecommendation: warned ? "Review whether the full-width marketing template should expand its primary canvas or vary section widths." : null }));
  }
  if (!desktop || !mobile || !desktop.primaryContentBounds || !mobile.primaryContentBounds || input.layoutClass !== "FULL_WIDTH_MARKETING_PAGE") findings.push(finding({ findingCode: "DESKTOP_LAYOUT_REMAINS_MOBILE_WIDTH", category: "RESPONSIVE", state: "NOT_EVALUATED", summary: "Desktop/mobile width comparison requires both content bounds and full-width marketing-page authority.", evidenceReferences: [desktop?.captureId, mobile?.captureId].filter((value): value is string => Boolean(value)), rule: { ruleId: RENDERED_VISUAL_RULES.desktopRemainsMobileWidth.ruleId, thresholds: RENDERED_VISUAL_RULES.desktopRemainsMobileWidth }, safeRecommendation: null }));
  else {
    const symmetricUnused = Math.min(desktop.primaryContentBounds.x, desktop.viewportWidth - desktop.primaryContentBounds.x - desktop.primaryContentBounds.width);
    const ratio = desktop.primaryContentBounds.width / mobile.primaryContentBounds.width;
    const warned = desktop.viewportWidth >= RENDERED_VISUAL_RULES.desktopRemainsMobileWidth.desktopMinimumViewport && desktop.primaryContentBounds.width <= RENDERED_VISUAL_RULES.desktopRemainsMobileWidth.mobileMaximumContentWidth && ratio <= RENDERED_VISUAL_RULES.desktopRemainsMobileWidth.maximumDesktopToMobileWidthRatio && symmetricUnused >= RENDERED_VISUAL_RULES.desktopRemainsMobileWidth.minimumSymmetricUnusedSpace;
    findings.push(finding({ findingCode: "DESKTOP_LAYOUT_REMAINS_MOBILE_WIDTH", category: "RESPONSIVE", state: warned ? "WARNING" : "PASS", summary: warned ? "Desktop primary content remains near mobile width with large symmetric unused space." : "Desktop content expands beyond the bounded mobile-width warning pattern.", evidenceReferences: [desktop.captureId, mobile.captureId], rule: { ruleId: RENDERED_VISUAL_RULES.desktopRemainsMobileWidth.ruleId, thresholds: RENDERED_VISUAL_RULES.desktopRemainsMobileWidth }, safeRecommendation: warned ? "Review the desktop template container and section composition; preserve intentional reading columns where applicable." : null }));
  }
  for (const capture of input.captures) {
    findings.push(finding({ findingCode: `${capture.viewportClass}_HERO_GEOMETRY`, category: "HERO", state: capture.hero.authority === "NOT_IDENTIFIED" ? "NOT_EVALUATED" : capture.hero.present ? "PASS" : "WARNING", summary: capture.hero.authority === "NOT_IDENTIFIED" ? "No authoritative hero identity was supplied." : capture.hero.present ? "Authoritative hero geometry was captured." : "The authoritative hero was not rendered.", evidenceReferences: [capture.captureId], rule: { ruleId: RENDERED_VISUAL_RULES.heroAuthorityMissing.ruleId }, safeRecommendation: capture.hero.authority !== "NOT_IDENTIFIED" && !capture.hero.present ? "Inspect the governed hero selector and rendered page structure." : null }));
    for (const media of capture.media.filter((item) => item.assigned && !item.rendered)) findings.push(finding({ findingCode: `${capture.viewportClass}_${media.semanticRole}_ASSIGNED_NOT_RENDERED`, category: "MEDIA", state: "WARNING", summary: `${media.semanticRole.replaceAll("_", " ")} is assigned but was not found in the rendered capture.`, evidenceReferences: [`${capture.captureId}#media:${media.assignmentId ?? media.semanticRole}`], rule: { ruleId: RENDERED_VISUAL_RULES.assignedMediaNotRendered.ruleId }, safeRecommendation: "Inspect the page assembly and exact semantic media slot before approval." }));
    const gapThreshold = Math.max(RENDERED_VISUAL_RULES.unusuallyLargeSectionGap.minimumPixels, capture.viewportHeight * RENDERED_VISUAL_RULES.unusuallyLargeSectionGap.viewportHeightRatio);
    for (const section of capture.sections.filter((item) => item.gapBefore !== null && item.gapBefore > gapThreshold)) findings.push(finding({ findingCode: `${capture.viewportClass}_UNUSUALLY_LARGE_SECTION_GAP:${section.sectionId}`, category: "SECTION", state: "WARNING", summary: `${Math.round(section.gapBefore ?? 0)}px gap precedes ${section.sectionId}.`, evidenceReferences: [`${capture.captureId}#section:${section.sectionId}`], rule: { ruleId: RENDERED_VISUAL_RULES.unusuallyLargeSectionGap.ruleId, thresholds: { minimumPixels: RENDERED_VISUAL_RULES.unusuallyLargeSectionGap.minimumPixels, viewportHeightRatio: RENDERED_VISUAL_RULES.unusuallyLargeSectionGap.viewportHeightRatio, effectiveThreshold: gapThreshold } }, safeRecommendation: "Review whether the gap is intentional for this template and viewport." }));
  }
  return findings;
}

export function renderedVisualOverallState(findings: readonly RenderedVisualFinding[]): RenderedVisualFindingState {
  if (findings.some((item) => item.state === "BLOCKED")) return "BLOCKED";
  if (findings.some((item) => item.state === "WARNING")) return "WARNING";
  if (findings.length === 0 || findings.every((item) => item.state === "NOT_EVALUATED")) return "NOT_EVALUATED";
  return "PASS";
}

export function sameRenderedVisualPageIdentity(left: RenderedVisualPageIdentity, right: RenderedVisualPageIdentity): boolean {
  return left.organizationId === right.organizationId && left.siteId === right.siteId && left.pageId === right.pageId && left.pageRevisionIdentity === right.pageRevisionIdentity && left.canonicalPath === right.canonicalPath && left.contentHash === right.contentHash && left.renderedContentHash === right.renderedContentHash && left.campaignId === right.campaignId && left.targetId === right.targetId && left.jobId === right.jobId && left.externalExecutionId === right.externalExecutionId && left.wordpressObjectId === right.wordpressObjectId && left.wordpressStatus === right.wordpressStatus;
}

export function renderedVisualDecisionCurrency(input: { certification: RenderedVisualCertification; decision: RenderedVisualOwnerDecision | null; currentIdentity: RenderedVisualPageIdentity }): "PENDING" | "CURRENT" | "STALE" {
  if (!input.decision || input.decision.decision === "PENDING") return "PENDING";
  const bound = input.decision.certificationId === input.certification.certificationId && input.decision.captureSetId === input.certification.captureSetId && input.decision.pageRevisionIdentity === input.currentIdentity.pageRevisionIdentity && input.decision.contentHash === input.currentIdentity.contentHash && input.decision.renderedContentHash === input.currentIdentity.renderedContentHash && sameRenderedVisualPageIdentity(input.certification.identity, input.currentIdentity);
  return bound ? "CURRENT" : "STALE";
}