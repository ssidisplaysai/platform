import { createHash } from "node:crypto";

import type { ThemeIntegrationEvidence } from "@/modules/foundation/governed-render-capture-browser";
import type { LocalPageThemingBundle } from "@/modules/foundation/local-context-page-theming-repository";
import type { LocalThemeVisualCertification } from "@/modules/foundation/local-theme-visual-certification";
import type { MarketProductMatchBundle } from "@/modules/foundation/local-market-product-match-repository";
import { HOUSTON_BUNDLE_ID, HOUSTON_CANONICAL_PATH, HOUSTON_MARKET_BUNDLE_ID, HOUSTON_PRODUCT_MEDIA_HASH, HOUSTON_TARGET_ID } from "./houston-reference-preview";

export const HOUSTON_APPROVED_PREVIEW_COMMIT = "6cb18a49eb54ec412ea14ab9681e06f46d1659d2" as const;
export const HOUSTON_DRAFT_CONTRACT = "houston-approved-preview-to-wordpress-draft-v1" as const;
export const HOUSTON_THEME_TEMPLATE = "elementor_header_footer" as const;
export const HOUSTON_TITLE = "Fan Cooled Projector Enclosures in Houston" as const;
export const HOUSTON_H1 = "Protected projection for Houston's indoor and covered commercial spaces." as const;
export const HOUSTON_SEO = {
  focusKeyphrase: "fan cooled projector enclosures Houston",
  seoTitle: "Fan Cooled Projector Enclosures Houston | ProjectorEnclosure.com",
  metaDescription: "Plan fan cooled projector enclosures for Houston commercial AV, covered event, and convention spaces with project-specific exposure review.",
} as const;

const hash = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

export type HoustonApprovedPreviewIdentity = {
  targetId: typeof HOUSTON_TARGET_ID;
  canonicalPath: typeof HOUSTON_CANONICAL_PATH;
  previewCommit: typeof HOUSTON_APPROVED_PREVIEW_COMMIT;
  localBundleId: typeof HOUSTON_BUNDLE_ID;
  localContextId: string;
  localLinkGraphId: string;
  localThemeProfileId: string;
  applicationAuthorityId: string;
  compositionPlanId: string;
  marketBundleId: typeof HOUSTON_MARKET_BUNDLE_ID;
  marketIntelligenceId: string;
  pageStrategyHash: string;
  semanticMediaHash: string;
  productMediaHash: typeof HOUSTON_PRODUCT_MEDIA_HASH;
  previewVisualCertificationId: string;
  previewVisualCertificationHash: string;
  previewRoute: string;
};

export type HoustonOwnerDraftApproval = { decisionId: string; decision: "APPROVED_PREVIEW_TO_DRAFT"; ownerStatement: "approved"; exactIdentity: HoustonApprovedPreviewIdentity; approvedAt: string; publicationAuthorized: false; dispatchAuthorized: false };
export type HoustonDraftReceipt = { receiptId: string; decisionId: string; contract: typeof HOUSTON_DRAFT_CONTRACT; wordpressObjectId: string; wordpressStatus: "draft"; title: typeof HOUSTON_TITLE; slug: "houston"; parentId: 13083; canonicalPath: typeof HOUSTON_CANONICAL_PATH; bodyHash: string; seoHash: string; featuredMediaId: 10757; template: typeof HOUSTON_THEME_TEMPLATE; hideTitle: "yes"; uploadedMedia: readonly { role: "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE" | "LOCAL_CONTEXTUAL_ATMOSPHERE"; mediaId: number; url: string; sha256: string; claimClass: string }[]; createdAt: string; schedulerInvoked: false; dispatchPerformed: false; leaseCreated: false; jobCreated: false; executionCreated: false; publicationPerformed: false; campaignMutationPerformed: false };
export type HoustonThemeCapture = { captureId: string; viewport: "DESKTOP_1440" | "DESKTOP_1024" | "TABLET_768" | "MOBILE_375"; width: number; height: number; documentWidth: number; documentHeight: number; horizontalOverflow: number; themeIntegration: ThemeIntegrationEvidence; mediaRolesRendered: readonly string[]; sectionCount: number; artifact: { reference: string; sha256: string; bytes: number; width: number; height: number }; capturedAt: string };
export type HoustonDraftVisualCertification = { certificationId: string; receiptId: string; renderClass: "THEME_INTEGRATED_RENDER"; captureAuthority: "SIGNED_INTERNAL_EQUIVALENT_USING_LIVE_ELEMENTOR_HEADER_FOOTER_SHELL"; captures: readonly HoustonThemeCapture[]; themeIntegrationReady: boolean; overallState: "PASS" | "FAIL"; createdAt: string; ownerReviewRequired: true; publicationPerformed: false };
export type HoustonPreviewDraftComparison = { comparisonId: string; receiptId: string; previewVisualCertificationId: string; draftVisualCertificationId: string; drift: "NONE" | "MINOR" | "MATERIAL" | "CRITICAL"; reasons: readonly string[]; ownerReviewRequired: true; publicationAuthorized: false; createdAt: string };
export type HoustonDraftAuditEvent = { eventId: string; action: string; at: string; detail: Record<string, string | number | boolean | null> };

export function freezeHoustonApprovedPreviewIdentity(input: { local: LocalPageThemingBundle; market: MarketProductMatchBundle; visual: LocalThemeVisualCertification; previewCommit: string }): HoustonApprovedPreviewIdentity {
  if (input.previewCommit !== HOUSTON_APPROVED_PREVIEW_COMMIT || input.local.bundleId !== HOUSTON_BUNDLE_ID || input.local.context.identity.pageId !== HOUSTON_TARGET_ID || input.local.context.identity.jobId !== null || input.local.context.contextId !== "local-context-houston-southeast-texas-r1" || input.local.links.graphId !== "local-links-houston-southeast-texas-r1" || input.local.theme.profileId !== "local-theme-houston-southeast-texas-r1" || input.local.theme.localizationLevel !== 2 || input.local.composition.validationState !== "READY_FOR_OWNER_REVIEW" || input.market.bundleId !== HOUSTON_MARKET_BUNDLE_ID || input.market.pageStrategy.pageId !== HOUSTON_TARGET_ID || input.market.pageStrategy.primaryApplication !== "COMMERCIAL_AV" || JSON.stringify(input.market.pageStrategy.supportingApplications) !== JSON.stringify(["EVENT_VENUE", "PROJECTION_MAPPING"]) || input.market.pageStrategy.crossSellCatalogItemIds.length !== 0 || input.visual.bundleId !== HOUSTON_BUNDLE_ID || input.visual.state !== "READY_FOR_OWNER_REVIEW" || input.visual.captures.length !== 4 || input.visual.captures.some((capture) => capture.horizontalOverflow !== 0 || capture.media.filter((item) => item.rendered).length !== 4)) throw new Error("HOUSTON_OWNER_APPROVAL_IDENTITY_STALE");
  const product = input.local.media.find((item) => item.role === "PRODUCT_AUTHORITY");
  if (product?.sha256 !== HOUSTON_PRODUCT_MEDIA_HASH || input.local.media.length !== 4 || new Set(input.local.media.map((item) => item.role)).size !== 4) throw new Error("HOUSTON_OWNER_APPROVAL_MEDIA_STALE");
  return { targetId: HOUSTON_TARGET_ID, canonicalPath: HOUSTON_CANONICAL_PATH, previewCommit: HOUSTON_APPROVED_PREVIEW_COMMIT, localBundleId: HOUSTON_BUNDLE_ID, localContextId: input.local.context.contextId, localLinkGraphId: input.local.links.graphId, localThemeProfileId: input.local.theme.profileId, applicationAuthorityId: input.local.applications.authorityId, compositionPlanId: input.local.composition.planId, marketBundleId: HOUSTON_MARKET_BUNDLE_ID, marketIntelligenceId: input.market.intelligence.intelligenceId, pageStrategyHash: hash(input.market.pageStrategy), semanticMediaHash: hash(input.local.media), productMediaHash: HOUSTON_PRODUCT_MEDIA_HASH, previewVisualCertificationId: input.visual.certificationId, previewVisualCertificationHash: hash(input.visual), previewRoute: "/glw/houston-reference-preview?organizationId=ssi&siteId=site-ssi-projectorenclosure" };
}

export function evaluateHoustonThemeIntegration(captures: readonly HoustonThemeCapture[]) {
  const failures: string[] = [];
  const normalizedH1 = (value: string | undefined) => value?.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  for (const capture of captures) {
    if (capture.horizontalOverflow !== 0) failures.push(`${capture.viewport}_OVERFLOW`);
    if (capture.themeIntegration.visibleH1Count !== 1) failures.push(`${capture.viewport}_H1_COUNT`);
    if (normalizedH1(capture.themeIntegration.visibleH1Texts[0]) !== HOUSTON_H1) failures.push(`${capture.viewport}_H1_TEXT`);
    if (capture.themeIntegration.duplicateThemeTitleVisible) failures.push(`${capture.viewport}_THEME_TITLE`);
    if (capture.themeIntegration.duplicateThemeFeaturedMediaVisible) failures.push(`${capture.viewport}_THEME_MEDIA`);
    if (!capture.themeIntegration.globalHeaderPresent || !capture.themeIntegration.headerActionsContained) failures.push(`${capture.viewport}_HEADER`);
    if (!capture.themeIntegration.globalFooterPresent) failures.push(`${capture.viewport}_FOOTER`);
    if (capture.mediaRolesRendered.length !== 4) failures.push(`${capture.viewport}_MEDIA_ROLES`);
  }
  return { state: failures.length ? "FAIL" as const : "PASS" as const, failures };
}
