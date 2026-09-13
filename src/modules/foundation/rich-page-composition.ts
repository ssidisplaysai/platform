import type { RenderedVisualCaptureEvidence } from "./rendered-visual-certification";
import type { SitePageMediaAssignment, SitePageMediaRole } from "./site-page-media-assignment";

export const RICH_PAGE_COMPOSITION_CONTRACT = "site-page-composition-plan-v1" as const;
export const RICH_PAGE_COMPOSITION_SCHEMA_VERSION = 1 as const;
export const RICH_PAGE_COMPOSITION_RULESET_VERSION = "genesis-rich-page-composition-rules-v1" as const;

export type RichPageCompositionProfile = "PRODUCT_SERVICE" | "LOCATION_SERVICE" | "MARKET_INDUSTRY" | "CAPABILITY" | "EDITORIAL_RESOURCE" | "LANDING_CONVERSION";
export type RichPageSectionRole = "HERO" | "PRODUCT_TRUTH" | "CONTEXTUAL_APPLICATION" | "FEATURES_BENEFITS" | "PROSE" | "SPLIT" | "CARD_GRID" | "FAQ" | "CTA";
export type RichPageLayoutIntent = "VISUAL_HERO" | "PROSE_COLUMN" | "MEDIA_CONTENT_SPLIT" | "FEATURE_GRID" | "NAVIGATION_GRID" | "VALUE_PILLARS" | "CONVERSION_BAND";
export type RichPageWidthIntent = "FULL_BLEED" | "WIDE" | "STANDARD" | "READING";
export type RichPageEvaluationState = "PASS" | "WARNING" | "FAIL" | "NOT_EVALUATED";

export type RichPageMediaExpectation = {
  slotId: string;
  role: SitePageMediaRole;
  requirement: "REQUIRED" | "DESIRED";
  assignmentId: string | null;
  readiness: "READY" | "NOT_WIRED" | "UNAVAILABLE" | "LEGACY";
  provenance: string;
};

export type RichPageCompositionSection = {
  sectionId: string;
  role: RichPageSectionRole;
  layoutIntent: RichPageLayoutIntent;
  widthIntent: RichPageWidthIntent;
  mediaSlots: readonly string[];
  responsiveIntent: "PRESERVE" | "STACK" | "REDUCE_COLUMNS" | "COLLAPSE_TO_READING";
};

export type RichPageCompositionPlan = {
  contract: typeof RICH_PAGE_COMPOSITION_CONTRACT;
  schemaVersion: typeof RICH_PAGE_COMPOSITION_SCHEMA_VERSION;
  planId: string;
  identity: { organizationId: string; siteId: string; pageId: string; pageRevisionIdentity: string; canonicalPath: string; jobId: string | null; wordpressObjectId: string | null };
  profile: RichPageCompositionProfile;
  sections: readonly RichPageCompositionSection[];
  media: readonly RichPageMediaExpectation[];
  ctaHierarchy: { primaryLabel: string | null; primaryDestination: string | null; source: "CONTENT_AUTHORITY" | "NONE" };
  responsiveViewports: readonly [1440, 1024, 768, 375];
  provenance: { decisionSource: string; evidenceReferences: readonly string[]; globalRulesChanged: false };
  validationState: "READY" | "BLOCKED";
  blockers: readonly string[];
  createdAt: string;
};

export type RichPageCompositionFinding = { code: string; state: RichPageEvaluationState; summary: string; evidence: readonly string[]; advisory: boolean };

export function compositionProfileForPageType(pageType: string): RichPageCompositionProfile {
  if (pageType === "city_service" || pageType === "state_service") return "LOCATION_SERVICE";
  if (pageType === "general_service" || pageType === "OFFERING" || pageType === "CATEGORY") return "PRODUCT_SERVICE";
  if (pageType === "MARKET") return "MARKET_INDUSTRY";
  if (pageType === "CAPABILITIES") return "CAPABILITY";
  if (pageType === "HOME" || pageType === "CONTACT") return "LANDING_CONVERSION";
  return "EDITORIAL_RESOURCE";
}

export function mediaExpectationFromAssignments(input: { role: SitePageMediaRole; requirement: "REQUIRED" | "DESIRED"; slotId: string; assignments: readonly SitePageMediaAssignment[]; pageRevisionIdentity: string; legacy?: { mediaId: string; provenance: string } | null; authorityAvailable?: boolean }): RichPageMediaExpectation {
  const assignment = input.assignments.find((item) => item.pageRevisionId === input.pageRevisionIdentity && item.role === input.role && item.slotId === input.slotId) ?? null;
  if (assignment) return { slotId: input.slotId, role: input.role, requirement: input.requirement, assignmentId: assignment.assignmentId, readiness: "READY", provenance: assignment.asset.type === "GENERATED" ? `GENERATED:${assignment.asset.provider}:${assignment.asset.model}:PRODUCT_TRUTH_GROUNDED` : assignment.asset.authorityReference };
  if (input.legacy && input.role === "CONTEXTUAL_IN_USE") return { slotId: input.slotId, role: input.role, requirement: input.requirement, assignmentId: null, readiness: "LEGACY", provenance: `${input.legacy.provenance}:media-${input.legacy.mediaId}` };
  return { slotId: input.slotId, role: input.role, requirement: input.requirement, assignmentId: null, readiness: input.authorityAvailable ? "NOT_WIRED" : "UNAVAILABLE", provenance: input.authorityAvailable ? "Approved authority exists outside target assignment." : "No approved assignment evidence." };
}

export function createRichPageCompositionPlan(input: {
  planId: string; identity: RichPageCompositionPlan["identity"]; pageType: string; cta?: { label: string; destination: string } | null;
  media: readonly RichPageMediaExpectation[]; decisionSource: string; evidenceReferences: readonly string[]; now?: string;
}): RichPageCompositionPlan {
  const profile = compositionProfileForPageType(input.pageType);
  const productSlot = input.media.find((item) => item.role === "PRODUCT_AUTHORITY")?.slotId;
  const contextualSlot = input.media.find((item) => item.role === "CONTEXTUAL_IN_USE")?.slotId;
  const sections: RichPageCompositionSection[] = profile === "LOCATION_SERVICE" ? [
    { sectionId: "hero", role: "HERO", layoutIntent: "VISUAL_HERO", widthIntent: "WIDE", mediaSlots: contextualSlot ? [contextualSlot] : [], responsiveIntent: "STACK" },
    { sectionId: "product-truth", role: "PRODUCT_TRUTH", layoutIntent: "MEDIA_CONTENT_SPLIT", widthIntent: "WIDE", mediaSlots: productSlot ? [productSlot] : [], responsiveIntent: "STACK" },
    { sectionId: "features", role: "FEATURES_BENEFITS", layoutIntent: "FEATURE_GRID", widthIntent: "WIDE", mediaSlots: [], responsiveIntent: "REDUCE_COLUMNS" },
    { sectionId: "local-context", role: "CONTEXTUAL_APPLICATION", layoutIntent: "PROSE_COLUMN", widthIntent: "READING", mediaSlots: [], responsiveIntent: "COLLAPSE_TO_READING" },
    { sectionId: "supporting-detail", role: "PROSE", layoutIntent: "VALUE_PILLARS", widthIntent: "STANDARD", mediaSlots: [], responsiveIntent: "REDUCE_COLUMNS" },
    { sectionId: "faq", role: "FAQ", layoutIntent: "PROSE_COLUMN", widthIntent: "READING", mediaSlots: [], responsiveIntent: "COLLAPSE_TO_READING" },
    { sectionId: "conversion", role: "CTA", layoutIntent: "CONVERSION_BAND", widthIntent: "WIDE", mediaSlots: [], responsiveIntent: "STACK" },
  ] : [
    { sectionId: "hero", role: "HERO", layoutIntent: "VISUAL_HERO", widthIntent: "WIDE", mediaSlots: contextualSlot ? [contextualSlot] : [], responsiveIntent: "STACK" },
    { sectionId: "primary-content", role: "PROSE", layoutIntent: "PROSE_COLUMN", widthIntent: "READING", mediaSlots: [], responsiveIntent: "COLLAPSE_TO_READING" },
    { sectionId: "conversion", role: "CTA", layoutIntent: "CONVERSION_BAND", widthIntent: "WIDE", mediaSlots: [], responsiveIntent: "STACK" },
  ];
  const blockers = input.media.filter((item) => item.requirement === "REQUIRED" && item.readiness !== "READY").map((item) => `${item.role}_${item.readiness}`);
  const plan: RichPageCompositionPlan = { contract: RICH_PAGE_COMPOSITION_CONTRACT, schemaVersion: RICH_PAGE_COMPOSITION_SCHEMA_VERSION, planId: input.planId, identity: input.identity, profile, sections, media: input.media, ctaHierarchy: input.cta ? { primaryLabel: input.cta.label, primaryDestination: input.cta.destination, source: "CONTENT_AUTHORITY" } : { primaryLabel: null, primaryDestination: null, source: "NONE" }, responsiveViewports: [1440, 1024, 768, 375], provenance: { decisionSource: input.decisionSource, evidenceReferences: input.evidenceReferences, globalRulesChanged: false }, validationState: blockers.length ? "BLOCKED" : "READY", blockers, createdAt: input.now ?? new Date().toISOString() };
  return validateRichPageCompositionPlan(plan);
}

export function validateRichPageCompositionPlan(plan: RichPageCompositionPlan, currentRevisionIdentity?: string): RichPageCompositionPlan {
  if (plan.contract !== RICH_PAGE_COMPOSITION_CONTRACT || plan.schemaVersion !== RICH_PAGE_COMPOSITION_SCHEMA_VERSION || !plan.planId || !plan.identity.organizationId || !plan.identity.siteId || !plan.identity.pageId || !plan.identity.pageRevisionIdentity || !plan.identity.canonicalPath || !plan.provenance.decisionSource || plan.sections.length < 1) throw new Error("RICH_PAGE_COMPOSITION_PLAN_INVALID");
  if (currentRevisionIdentity && currentRevisionIdentity !== plan.identity.pageRevisionIdentity) throw new Error("RICH_PAGE_COMPOSITION_PLAN_STALE");
  if (plan.provenance.globalRulesChanged !== false || plan.sections.some((section) => !section.sectionId || section.mediaSlots.some((slot) => !plan.media.some((media) => media.slotId === slot)))) throw new Error("RICH_PAGE_COMPOSITION_PLAN_INVALID");
  if (plan.media.some((media) => media.role === "PRODUCT_AUTHORITY" && media.readiness === "READY" && !media.assignmentId)) throw new Error("RICH_PAGE_PRODUCT_AUTHORITY_FABRICATED");
  return structuredClone(plan);
}

export function evaluateRichPageComposition(input: { plan: RichPageCompositionPlan; captures: readonly RenderedVisualCaptureEvidence[]; duplicateOpeningMedia?: boolean | null; cardWidths?: readonly number[] | null; proseWidths?: readonly number[] | null; headerWidth?: number | null; primaryCtaDistinct?: boolean | null }): RichPageCompositionFinding[] {
  const desktop = input.captures.find((item) => item.viewportClass === "DESKTOP") ?? null; const mobile = input.captures.find((item) => item.viewportClass === "MOBILE") ?? null;
  const result: RichPageCompositionFinding[] = [];
  const add = (code: string, state: RichPageEvaluationState, summary: string, evidence: string[] = [], advisory = false) => result.push({ code, state, summary, evidence, advisory });
  if (!desktop?.primaryContentBounds) add("DESKTOP_CANVAS_UTILIZATION", "NOT_EVALUATED", "Desktop page composition bounds are unavailable.");
  else { const utilization = desktop.primaryContentBounds.width / desktop.viewportWidth; const unused = Math.min(desktop.primaryContentBounds.x, desktop.viewportWidth - desktop.primaryContentBounds.x - desktop.primaryContentBounds.width); add("DESKTOP_CANVAS_UTILIZATION", desktop.viewportWidth >= 1280 && utilization <= .45 && unused >= 240 && input.plan.profile !== "EDITORIAL_RESOURCE" ? "WARNING" : "PASS", `Desktop page canvas uses ${Math.round(utilization * 100)}% of the viewport; prose measure is evaluated separately.`, [desktop.captureId]); }
  for (const capture of [desktop, mobile].filter(Boolean) as RenderedVisualCaptureEvidence[]) add(`${capture.viewportClass}_HERO_COMPOSITION`, capture.hero.authority === "NOT_IDENTIFIED" ? "NOT_EVALUATED" : capture.hero.present && capture.hero.headingBounds ? "PASS" : "WARNING", capture.hero.authority === "NOT_IDENTIFIED" ? "No authoritative hero marker is rendered." : "Hero identity and heading geometry were evaluated.", [capture.captureId]);
  add("DUPLICATE_OPENING_MEDIA", input.duplicateOpeningMedia === null || input.duplicateOpeningMedia === undefined ? "NOT_EVALUATED" : input.duplicateOpeningMedia ? "WARNING" : "PASS", input.duplicateOpeningMedia ? "The same media identity appears in adjacent opening regions." : "No duplicate opening media pattern was supplied.", [], true);
  const widths = desktop?.sections.map((item) => item.bounds.width) ?? []; const distinctWidths = new Set(widths.map((value) => Math.round(value / 20) * 20)).size;
  add("SECTION_WIDTH_VARIATION", widths.length < 3 ? "NOT_EVALUATED" : distinctWidths >= 2 ? "PASS" : "WARNING", widths.length < 3 ? "Section geometry is insufficient." : `${distinctWidths} bounded section-width groups were measured.`, desktop ? [desktop.captureId] : [], true);
  add("TEXT_MEASURE", !input.proseWidths?.length ? "NOT_EVALUATED" : input.proseWidths.some((width) => width > 900) ? "WARNING" : "PASS", !input.proseWidths?.length ? "Prose-specific bounds are unavailable." : "Long-form prose measure was evaluated independently from page width.", [], true);
  add("SPLIT_SECTION_PROPORTION", input.plan.sections.some((item) => item.layoutIntent === "MEDIA_CONTENT_SPLIT") ? "NOT_EVALUATED" : "PASS", "Split proportions are advisory unless semantic child-column bounds are captured.", [], true);
  add("CARD_SCALE", !input.cardWidths?.length ? "NOT_EVALUATED" : Math.min(...input.cardWidths) < 220 && (desktop?.viewportWidth ?? 0) >= 1024 ? "WARNING" : "PASS", !input.cardWidths?.length ? "Card-specific bounds are unavailable." : "Card scale was evaluated against usable desktop interaction area.", [], true);
  add("VISUAL_RHYTHM", widths.length < 4 ? "NOT_EVALUATED" : distinctWidths < 2 ? "WARNING" : "PASS", "Section variation is a bounded geometry heuristic, not an aesthetic score.", desktop ? [desktop.captureId] : [], true);
  add("CTA_PROMINENCE", input.plan.ctaHierarchy.source === "NONE" ? "NOT_EVALUATED" : input.primaryCtaDistinct === null || input.primaryCtaDistinct === undefined ? "NOT_EVALUATED" : input.primaryCtaDistinct ? "PASS" : "WARNING", "Primary CTA hierarchy requires approved CTA intent and rendered style evidence.", [], true);
  for (const media of input.plan.media) { const rendered = input.captures.some((capture) => capture.media.some((item) => item.semanticRole === media.role && item.rendered)); add(`MEDIA_${media.role}`, media.readiness === "NOT_WIRED" ? "FAIL" : media.readiness === "UNAVAILABLE" ? "NOT_EVALUATED" : rendered ? "PASS" : media.requirement === "REQUIRED" ? "FAIL" : "WARNING", `${media.role} is ${media.readiness}; rendered evidence ${rendered ? "exists" : "does not exist"}.`, input.captures.map((item) => item.captureId)); }
  add("RESPONSIVE_COMPOSITION", !desktop || !mobile ? "NOT_EVALUATED" : desktop.horizontalOverflow || mobile.horizontalOverflow ? "FAIL" : "PASS", !desktop || !mobile ? "Desktop and mobile evidence are both required." : "Desktop/mobile overflow and primary canvas transformation were evaluated.", [desktop?.captureId, mobile?.captureId].filter((item): item is string => Boolean(item)));
  add("GLOBAL_HEADER_ALIGNMENT", !desktop?.primaryContentBounds || !input.headerWidth ? "NOT_EVALUATED" : Math.abs(desktop.primaryContentBounds.width - input.headerWidth) / desktop.primaryContentBounds.width > .2 ? "WARNING" : "PASS", "Global header alignment requires measured header and body composition widths.", desktop ? [desktop.captureId] : [], true);
  add("GLOBAL_CTA_HIERARCHY", input.plan.ctaHierarchy.source === "NONE" ? "NOT_EVALUATED" : input.primaryCtaDistinct === null || input.primaryCtaDistinct === undefined ? "NOT_EVALUATED" : input.primaryCtaDistinct ? "PASS" : "WARNING", "Global CTA hierarchy is evaluated only when conversion authority exists.", [], true);
  return result;
}