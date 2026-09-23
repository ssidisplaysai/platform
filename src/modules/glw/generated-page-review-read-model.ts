import "server-only";

import { createAuthenticatedWordPressReadAuthority, normalizeWordPressApiBaseUrl } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getProductById } from "@/modules/foundation/product-repository";
import { createRichPageCompositionPlan, evaluateRichPageComposition, mediaExpectationFromAssignments, type RichPageCompositionFinding, type RichPageCompositionPlan } from "@/modules/foundation/rich-page-composition";
import { getRenderedVisualCertificationState, listRenderedVisualCertifications, listRenderedVisualOwnerDecisions } from "@/modules/foundation/rendered-visual-certification-repository";
import { hashRenderedVisualContent, renderedVisualUtilization, type RenderedVisualCertification, type RenderedVisualFinding, type RenderedVisualOwnerDecision, type RenderedVisualPageIdentity } from "@/modules/foundation/rendered-visual-certification";
import { evaluateProductAuthorityMediaRequirement, listSitePageMediaAssignments, resolveApprovedProductAuthorityMedia, type SitePageMediaAssignment } from "@/modules/foundation/site-page-media-assignment";
import { listGeneratedContextualMedia } from "@/modules/foundation/generated-contextual-media-repository";
import { evaluateLocalizationContamination, type LocalizationLocationOccurrence } from "@/modules/foundation/localization-contamination-gate";
import { getLocalPageThemingBundle, type LocalPageThemingBundle } from "@/modules/foundation/local-context-page-theming-repository";
import { getLocalThemeVisualCertification } from "@/modules/foundation/local-theme-visual-certification-repository";
import type { LocalThemeVisualCertification } from "@/modules/foundation/local-theme-visual-certification";
import { getMarketProductMatchBundle, type MarketProductMatchBundle } from "@/modules/foundation/local-market-product-match-repository";
import { getDallasApplyState } from "./dallas-rich-composition-apply-repository";
import { resolvePreCaptureContextualAssignment } from "./contextual-precert-media-evidence";
import { getDallasPublicationState } from "./dallas-reference-page-publication-repository";
import { getDallasThemeIntegrationState } from "./dallas-public-theme-integration-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import type { GlwCampaign } from "./campaign-types";
import type { GlwCampaignTarget } from "./campaign-target-repository";
import type { GlwPageExecutionRecord } from "./page-execution";
import { listGlwCampaigns } from "./campaign-repository";
import { listAllGlwCampaignTargets } from "./campaign-target-repository";
import { getGlwCampaignKnowledgePack } from "./campaign-reference-repository";
import { glwPageExecutionRepository } from "./page-execution-repository";
import { getSanAntonioStagingState, SAN_ANTONIO_STAGING_JOB_ID, type SanAntonioStagingReceipt, type SanAntonioStoredAuthorityCertification } from "./san-antonio-wordpress-staging-authority";
import { getSanAntonioNativeRepairState } from "./san-antonio-native-wordpress-render-repair-service";
import { getSanAntonioHeroContrastState } from "./san-antonio-hero-contrast-repair-service";
import { listGenesisBackgroundAwareContrastCertifications, type GenesisBackgroundAwareContrastCertification } from "@/modules/foundation/background-aware-text-contrast-capture";
import { deriveGenesisContrastReadiness } from "@/modules/foundation/background-aware-text-contrast";
import { SAN_ANTONIO_NATIVE_PREVIEW_CONTRAST_MISMATCH_V1 } from "./san-antonio-native-preview-contrast-mismatch";
import { SAN_ANTONIO_ACTUAL_NATIVE_CONTRAST_EVIDENCE } from "./san-antonio-actual-native-contrast-evidence";
import { getSanAntonioDurableHeadingContrastState } from "./san-antonio-durable-heading-contrast-update-service";
import { projectAuthoritativeGeneratedPage } from "./authoritative-generated-page-projection";
import { requiresGeneratedContextualMediaForOutdoorSphere } from "./outdoor-sphere-contextual-media-policy";
import { requiresGeneratedContextualMediaForProjectorEnclosure } from "./projector-enclosure-contextual-media-policy";

export type ReviewSignal = "PASS" | "WARNING" | "BLOCKED" | "NOT_EVALUATED";
export type ReviewIssue = { category: "CONTENT" | "SEO" | "IMAGE" | "WORDPRESS" | "POLICY"; severity: "WARNING" | "BLOCKED"; what: string; effect: string; safeNextStep: string };
export type GeneratedPageVisualQaReview = {
  contractExists: true;
  certificationState: "NOT_CERTIFIED" | "CURRENT" | "STALE";
  overallState: ReviewSignal;
  layoutClass: string | null;
  captureSetId: string | null;
  captures: readonly { captureId: string; viewportClass: "DESKTOP" | "MOBILE"; viewportWidth: number; viewportHeight: number; documentWidth: number; documentHeight: number; primaryContentWidth: number | null; utilization: number | null; horizontalOverflow: number; artifactReference: string; artifactUrl: string; artifactSha256: string; heroState: ReviewSignal; mediaRendered: number; mediaAssigned: number; sectionCount: number }[];
  findings: readonly RenderedVisualFinding[];
  decision: RenderedVisualOwnerDecision | null;
  decisionState: "PENDING" | "CURRENT" | "STALE";
  stale: boolean;
  safeNextStep: string;
  authority: string;
};

export type GeneratedPageReviewModel = {
  identity: { title: string; target: string; product: string; site: string; domain: string | null; campaign: string; campaignId: string; targetId: string; canonicalPath: string; lifecycleState: string; publicationPolicy: string };
  wordpress: { objectId: string | null; status: string | null; verified: boolean; titleMatchesSource: boolean; contentMatchesSource: boolean; readState: string; title: string | null; modifiedAt: string | null; editUrl: string | null; sourceUrl: string | null; previewHtml: string | null };
  source: { html: string; excerpt: string | null; h1: string | null; headings: readonly { level: number; text: string }[]; bodySections: readonly { heading: string; preview: string }[]; cta: string | null; faqPresent: boolean; internalLinks: readonly { label: string; url: string }[]; rawHtml: string };
  seo: { title: string | null; titleState: ReviewSignal; metaDescription: string | null; metaDescriptionState: ReviewSignal; canonicalState: ReviewSignal; redirectState: ReviewSignal; indexabilityState: ReviewSignal; h1Count: number; h1State: ReviewSignal; developmentUrlLeakState: ReviewSignal; detail: string };
  images: {
    productAuthority: { state: "ASSIGNED" | "RESOLVED_APPROVED" | "NOT_WIRED"; imageUrl: string | null; authority: string; provenance: string; altText: string | null; wordpressMediaId: string | null; renderedInCurrentWordPress: false };
    contextualInUse: { state: "GENERATED_CONTEXTUAL" | "ASSIGNED_FEATURED" | "LEGACY_FEATURED" | "MISSING"; imageUrl: string | null; authority: string; provenance: string; altText: string | null; wordpressMediaId: string | null; assignmentId: string | null; grounding: string };
    contractState: "LEGACY_IMAGE_STATE" | "MULTI_ROLE_IMAGE_STATE";
  };
  evidence: readonly { source: string; status: string; usedFor: string }[];
  trace: { jobId: string; externalExecutionId: string | null; generationState: string; reconciliationState: string; wordpressObjectId: string | null; attemptCount: number; lastActivity: string };
  qaChecks: readonly { label: string; state: ReviewSignal; detail: string }[];
  issues: readonly ReviewIssue[];
  localizationQa: { contract: "LOCALIZATION_CONTAMINATION_GATE"; state: "PASS" | "FAIL"; occurrences: readonly LocalizationLocationOccurrence[]; forbiddenOccurrences: readonly LocalizationLocationOccurrence[] };
  productMediaQa: { contract: "PRODUCT_AUTHORITY_MEDIA_REQUIRED_WHEN_AVAILABLE"; state: "PASS" | "FAIL"; code: "REQUIRED_MEDIA_UNRESOLVED" | null; generatedMediaUsedAsDocumentarySubstitute: false };
  reviewState: "READY_FOR_OWNER_REVIEW" | "NEEDS_ATTENTION" | "REVIEW_BLOCKED" | "BLOCKED";
  actions: {
    canonical: { label: string; href: string } | null;
    campaignHref: string;
    listHref: string;
    visualCapture: { endpoint: string; organizationId: string; siteId: string };
    ownerDecision: { endpoint: string; organizationId: string; siteId: string } | null;
    publish: { endpoint: string; organizationId: string; siteId: string; campaignId: string; targetId: string } | null;
    generatedContextualRepair:
      | {
          endpoint: string;
          organizationId: string;
          siteId: string;
          operation: "REPAIR_DRAFT_READY_GENERATED_CONTEXTUAL_MEDIA";
          label: "Generate Contextual Image" | "Replace Legacy Contextual Image" | "Reconcile Featured Contextual Image" | "Build Contextual Visual Set";
          identity: {
            campaignId: string;
            targetId: string;
            jobId: string;
            externalExecutionId: string;
            wordpressObjectId: string;
            productId: string;
            pageRevisionId: string;
            expectedStoredSha256: string;
          };
        }
      | null;
  };
  visualQa: GeneratedPageVisualQaReview;
  richComposition: { plan: RichPageCompositionPlan; identityState: "CURRENT"; currentRender: { profile: "CONTENT_ARTICLE"; certificationState: GeneratedPageVisualQaReview["certificationState"]; overallState: ReviewSignal }; proposedFindings: readonly RichPageCompositionFinding[]; safeNextAction: string; preview: { state: "PREVIEW_ONLY"; locationLabel: string; title: string; excerpt: string | null; bodyHtml: string; productId: string; productName: string; productImageUrl: string | null; productAltText: string | null; contextualImageUrl: string | null; contextualAltText: string | null; ctaLabel: string | null; href: string } };
  localizedV2: null | { state: "READY_FOR_OWNER_REVIEW" | "BLOCKED"; href: string; localizationLevel: number; contextFacts: number; applications: readonly { id: string; state: string }[]; linkCounts: Record<string, number>; media: readonly { role: string; claimClass: string; reviewState: string; source: string; productTruthReference: string | null; sha256: string; altText: string }[]; blockers: readonly string[]; claimSafety: { brandAuthorityPrecedence: true; falseProximityClaimsProhibited: true; antiClicheSafeguards: readonly string[] }; visualCertification: null | Pick<LocalThemeVisualCertification, "certificationId" | "state" | "ownerReviewRequired" | "findings"> & { viewports: readonly { label: string; overflow: number; artifactUrl: string; width: number; height: number; sha256: string }[] }; ownerQuestions: readonly string[] };
  marketMatch: null | { href: string; previewV3Href: string; signalCount: number; catalogCount: number; ranked: readonly { application: string; product: string | null; confidence: string }[]; pageStrategy: { primary: string | null; supporting: readonly string[]; crossSell: readonly string[]; rejected: number }; mutationAuthorized: false };
  appliedV3: null | { receiptId: string; status: "draft"; beforeHash: string; afterHash: string; decisionId: string; drift: string | null; comparisonHref: string; ownerReviewRequired: true };
  referencePage: null | { certificationId: string; publicUrl: string; visualCertificationId: string; ownerApprovalId: string; publicationReceiptId: string; href: string; state: "CERTIFIED" };
  themeIntegration: null | { receiptId: string; certificationId: string; state: "PASS" | "FAIL"; drift: string; href: string; visibleH1Count: number; overflow1024: number };
  wordpressStaging: null | { receiptId: string; state: "WORDPRESS_STAGED"; ownerCompositionApproved: true; wordpressObjectId: string; wordpressStatus: "draft"; wordpressAuthority: "POST_CONTENT"; storedCompositionHash: string; artifactSha: string; approvedCompositionCommit: string; mediaResolved: number; localizationCertification: "PASS"; claimCertification: "PASS"; genesisResponsiveCertification: "PASS"; wordpressStoredAuthorityCertified: true; nativeWordPressDraftRenderCertified: false; nativePreviewLimitation: string; reviewUrl: string };
  nativeRenderRepair: null | { receiptId: string; state: "READY_FOR_OWNER_NATIVE_PREVIEW"; beforeHash: string; afterHash: string; shellContract: string; featuredMediaId: 10757; duplicateThemeTitleSuppressed: true; duplicateThemeFeaturedImageSuppressed: true; certificationState: "PASS" | "FAIL"; nativePreviewAutomationAvailable: false; nativePreviewCertificationClaimed: false; captures: readonly { viewport: string; overflow: number; productMediaRatio: number; productCopyWidth: number; productHeadingLineCount: number; contextualHeadingLineCount: number }[]; ownerPreviewRequired: true };
  heroContrastRepair: null | { receiptId: string; state: "READY_FOR_OWNER_HERO_REVIEW"; beforeHash: string; afterHash: string; h1ColorBefore: string; h1ColorAfter: string; backgroundPreserved: true; certificationState: "PASS" | "FAIL"; captures: readonly { viewport: string; h1Color: string; h1Contrast: number; supportingContrast: number; primaryCtaContrast: number; secondaryCtaContrast: number; disclaimerContrast: number; overlap: boolean; overflow: number }[]; nativePreviewAutomationAvailable: false; nativePreviewCertificationClaimed: false; ownerPreviewRequired: true };
  backgroundAwareContrast: null | { contract: "GENESIS_BACKGROUND_AWARE_TEXT_CONTRAST_V1"; certificationId: string; state: "PASS" | "FAIL"; failureCount: number; ownerReviewReady: boolean; publicationReady: boolean; authority: import("@/modules/foundation/background-aware-text-contrast").GenesisRenderAuthority; generatedImageReevaluationPerformed: boolean; viewports: readonly { viewport: string; observations: number; failures: number }[] };
  durableReviewDecisionExists: boolean;
};

type WordPressDraft = { id?: number; slug?: string; status?: string; link?: string; modified_gmt?: string; featured_media?: number; title?: { raw?: string; rendered?: string }; content?: { raw?: string; rendered?: string } };
type WordPressMedia = { id?: number; source_url?: string; alt_text?: string; title?: { rendered?: string }; caption?: { rendered?: string }; description?: { rendered?: string } };
type ApprovedProductMediaAssignment = SitePageMediaAssignment & { asset: Extract<SitePageMediaAssignment["asset"], { type: "APPROVED_EXISTING" }> };

function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function stripHtml(value: string): string { return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim(); }
function sanitizePreviewHtml(value: string): string { return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<(?:iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed|form)>/gi, "").replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, "").replace(/javascript:/gi, ""); }
function internalLink(url: string, domain: string | null): boolean { if (url.startsWith("/")) return true; try { const host = new URL(url).hostname.replace(/^www\./, ""); return Boolean(domain && (host === domain.replace(/^www\./, "") || host.endsWith(`.${domain.replace(/^www\./, "")}`))); } catch { return false; } }
function approvedProductMedia(assignment: SitePageMediaAssignment | null | undefined): assignment is ApprovedProductMediaAssignment { return assignment?.role === "PRODUCT_AUTHORITY" && assignment.asset.type === "APPROVED_EXISTING"; }

export function deriveGeneratedPageReviewModel(input: {
  campaign: GlwCampaign;
  target: GlwCampaignTarget;
  job: GlwPageExecutionRecord;
  siteName: string;
  domain: string | null;
  productName: string;
  productAuthorityReference: string | null;
  productAuthoritySource: string | null;
  knowledgePack: ReturnType<typeof getGlwCampaignKnowledgePack>;
  wordpressDraft: WordPressDraft | null;
  wordpressMedia: WordPressMedia | null;
  wordpressReadState: string;
  wordpressEditUrl: string | null;
  mediaAssignments?: readonly SitePageMediaAssignment[];
  approvedProductMedia?: SitePageMediaAssignment | null;
  referenceLocations?: readonly { label: string; authority: string }[];
  localThemingBundle?: LocalPageThemingBundle | null;
  localThemeVisualCertification?: LocalThemeVisualCertification | null;
  marketMatchBundle?: MarketProductMatchBundle | null;
  visualCertification?: { certification: RenderedVisualCertification | null; decision: RenderedVisualOwnerDecision | null; certificationState: "NOT_CERTIFIED" | "CURRENT" | "STALE"; decisionState: "PENDING" | "CURRENT" | "STALE" };
  wordpressStagingReceipt?: SanAntonioStagingReceipt | null;
  wordpressStagingCertification?: SanAntonioStoredAuthorityCertification | null;
  backgroundAwareContrastCertification?: GenesisBackgroundAwareContrastCertification | null;
  authoritativeContextualMedia?: readonly { assignmentId: string | null; role: string; semanticRole: string; mediaId: string; rendered: boolean }[];
  authoritativePageRevisionIdentity?: string;
  generatedContextualReceipts?: readonly { generationId: string; campaignId: string; targetId: string; productId: string; wordpressObjectId: string; pageRevisionId: string; mediaRole: string; wordpressMediaId: number | null }[];
}): GeneratedPageReviewModel {
  const artifact = input.job.generatedDraft;
  const sourceHtml = artifact?.contentHtml ?? "";
  const liveHtml = text(input.wordpressDraft?.content?.raw ?? input.wordpressDraft?.content?.rendered);
  const headings = [...sourceHtml.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match) => ({ level: Number(match[1]), text: stripHtml(match[2] ?? "") })).filter((heading) => heading.text);
  const links = [...sourceHtml.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({ url: match[1], label: stripHtml(match[2] ?? "") })).filter((link) => link.label);
  const internalLinks = links.filter((link) => internalLink(link.url, input.domain));
  const bodySections = [...sourceHtml.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2\b|$)/gi)].slice(0, 12).map((match) => ({ heading: stripHtml(match[1] ?? ""), preview: stripHtml(match[2] ?? "").slice(0, 360) })).filter((section) => section.heading);
  const cta = [...links].reverse().find((link) => /contact|quote|request|get started|talk|plan/i.test(link.label))?.label ?? links.at(-1)?.label ?? null;
  const h1Count = headings.filter((heading) => heading.level === 1).length;
  const qa = record(input.job.qaChecks) ?? {};
  const qaChecks = Object.entries(qa).filter(([, value]) => record(value) && typeof record(value)?.ok === "boolean").map(([key, value]) => {
    const check = record(value)!;
    return { label: key.replace(/([a-z])([A-Z])/g, "$1 $2"), state: check.ok === true ? "PASS" as const : "BLOCKED" as const, detail: text(check.message) };
  });
  const qaFailures = record(input.job.qaFailureReasons) ?? {};
  const mediaAuthority = record(qa.mediaAuthority);
  const productAuthority = record(qa.productAuthority);
  const internalLinkEvidence = record(qa.internalLinks);
  const wordpressObjectId = input.job.wordpressObjectId ?? input.target.wordpressObjectId;
  const wordpressStatus = text(input.wordpressDraft?.status) || input.job.wordpressStatus;
  const expectedSlug = input.target.citySlug ?? (input.target.canonicalPath ?? input.job.slug).split("/").filter(Boolean).at(-1) ?? "";
  const wordpressTitle = text(input.wordpressDraft?.title?.raw ?? input.wordpressDraft?.title?.rendered);
  const wordpressVerified = Boolean(input.wordpressDraft && String(input.wordpressDraft.id) === wordpressObjectId && wordpressStatus === input.job.wordpressStatus && text(input.wordpressDraft.slug) === expectedSlug);
  const titleMatchesSource = Boolean(wordpressTitle && wordpressTitle === (artifact?.title ?? input.job.title));
  const contentMatchesSource = Boolean(liveHtml && stripHtml(liveHtml) === stripHtml(sourceHtml));
  const mediaId = input.wordpressMedia?.id ? String(input.wordpressMedia.id) : text(mediaAuthority?.selectedMediaId);
  const featuredMediaId = Number(input.wordpressDraft?.featured_media ?? 0) > 0
    ? String(input.wordpressDraft?.featured_media)
    : "";
  const currentContextualMedia = input.authoritativeContextualMedia ?? [];
  const pageRevisionIdentity = input.authoritativePageRevisionIdentity ?? `job:${input.job.jobId}:${input.job.updatedAt}`;
  const strictGeneratedContextualRequired = requiresGeneratedContextualMediaForOutdoorSphere({
    campaignId: input.campaign.campaignId,
    organizationId: input.campaign.organizationId,
    siteId: input.campaign.siteId,
    productId: input.campaign.productId,
  });
  const projectorEnclosureContextualRequired = requiresGeneratedContextualMediaForProjectorEnclosure({
    organizationId: input.campaign.organizationId,
    siteId: input.campaign.siteId,
    productId: input.campaign.productId,
  });
  const draftReadyContextualRepairRequired = strictGeneratedContextualRequired || projectorEnclosureContextualRequired;
  const generatedContextualAssignment = (input.mediaAssignments ?? []).find((assignment) =>
    assignment.pageRevisionId === pageRevisionIdentity
    && assignment.buildSessionId === `contextual-media:${input.target.targetId}`
    && assignment.role === "CONTEXTUAL_IN_USE"
    && assignment.asset.type === "GENERATED"
    && Boolean(assignment.wordpressReceipt?.mediaId)
  ) ?? null;
  const generatedContextualEvidence = currentContextualMedia.find((media) =>
    media.semanticRole === "CONTEXTUAL_IN_USE"
    && media.rendered
    && Boolean(media.mediaId),
  ) ?? null;
  const strictCurrentPassRenderedContext = strictGeneratedContextualRequired
    && input.visualCertification?.certificationState === "CURRENT"
    && input.visualCertification?.certification?.overallState === "PASS"
    && Boolean(generatedContextualEvidence)
    && Boolean(featuredMediaId)
    && String(generatedContextualEvidence?.mediaId ?? "") === featuredMediaId;
  const exactStrictContextualMediaId = String(generatedContextualAssignment?.wordpressReceipt?.mediaId ?? generatedContextualEvidence?.mediaId ?? "");
  const exactGeneratedContextualReceipt = (input.generatedContextualReceipts ?? []).find((receipt) =>
    receipt.campaignId === input.campaign.campaignId
    && receipt.targetId === input.target.targetId
    && receipt.productId === input.job.productId
    && receipt.wordpressObjectId === wordpressObjectId
    && receipt.pageRevisionId === pageRevisionIdentity
    && receipt.mediaRole === "CONTEXTUAL_IN_USE"
    && (exactStrictContextualMediaId ? String(receipt.wordpressMediaId ?? "") === exactStrictContextualMediaId : true),
  ) ?? null;
  const carryForwardGeneratedContextualAssignment = strictCurrentPassRenderedContext
    ? (input.mediaAssignments ?? []).find((assignment) =>
      assignment.organizationId === input.campaign.organizationId
      && assignment.siteId === input.campaign.siteId
      && assignment.pageId === input.target.targetId
      && assignment.pageRevisionId !== pageRevisionIdentity
      && assignment.buildSessionId === `contextual-media:${input.target.targetId}`
      && assignment.role === "CONTEXTUAL_IN_USE"
      && assignment.asset.type === "GENERATED"
      && Boolean(assignment.wordpressReceipt?.mediaId)
      && String(assignment.wordpressReceipt?.mediaId ?? "") === featuredMediaId
      && (!generatedContextualEvidence?.assignmentId || assignment.assignmentId === generatedContextualEvidence.assignmentId),
    ) ?? null
    : null;
  const carryForwardGeneratedContextualReceipt = carryForwardGeneratedContextualAssignment
    ? (input.generatedContextualReceipts ?? []).find((receipt) =>
      receipt.campaignId === input.campaign.campaignId
      && receipt.targetId === input.target.targetId
      && receipt.productId === input.job.productId
      && receipt.wordpressObjectId === wordpressObjectId
      && receipt.mediaRole === "CONTEXTUAL_IN_USE"
      && String(receipt.wordpressMediaId ?? "") === featuredMediaId,
    ) ?? null
    : null;
  const selectedGeneratedContextualAssignment = generatedContextualAssignment ?? carryForwardGeneratedContextualAssignment;
  const selectedGeneratedContextualReceipt = exactGeneratedContextualReceipt ?? carryForwardGeneratedContextualReceipt;
  const usedContextualCarryForward = Boolean(!generatedContextualAssignment && carryForwardGeneratedContextualAssignment && carryForwardGeneratedContextualReceipt);
  const strictContextualMediaId = String(selectedGeneratedContextualAssignment?.wordpressReceipt?.mediaId ?? generatedContextualEvidence?.mediaId ?? "");
  const generatedContextualReceipt = selectedGeneratedContextualReceipt;
  const strictGeneratedAssignmentMediaId = String(selectedGeneratedContextualAssignment?.wordpressReceipt?.mediaId ?? "");
  const strictGeneratedReceiptMediaId = String(generatedContextualReceipt?.wordpressMediaId ?? "");
  const strictGeneratedReceiptValid = Boolean(
    selectedGeneratedContextualAssignment
    && generatedContextualReceipt
    && strictGeneratedAssignmentMediaId
    && strictGeneratedReceiptMediaId
    && strictGeneratedAssignmentMediaId === strictGeneratedReceiptMediaId
    && generatedContextualReceipt.mediaRole === "CONTEXTUAL_IN_USE"
    && generatedContextualReceipt.wordpressObjectId === wordpressObjectId,
  );
  const preCaptureContextualAssignment = resolvePreCaptureContextualAssignment({
    assignments: input.mediaAssignments ?? [],
    targetId: input.target.targetId,
    pageRevisionIdentity,
    buildSessionId: `contextual-media:${input.target.targetId}`,
    featuredMediaId,
    wordpressObjectId: wordpressObjectId ?? "",
    jobId: input.job.jobId,
    jobUpdatedAt: input.job.updatedAt,
  });
  const preCaptureContextualReady = Boolean(preCaptureContextualAssignment);
  const contextualReady = strictGeneratedContextualRequired
    ? Boolean(strictGeneratedReceiptValid || preCaptureContextualReady)
    : currentContextualMedia.some((media) => media.semanticRole === "CONTEXTUAL_IN_USE" && media.rendered) || Boolean(input.job.featuredImagePresent && mediaId);
  const strictGeneratedContextualDisplay = strictGeneratedContextualRequired
    && contextualReady
    && selectedGeneratedContextualAssignment
    && selectedGeneratedContextualAssignment.wordpressReceipt;
  const exactProductAssignment = (input.mediaAssignments ?? []).find((item): item is ApprovedProductMediaAssignment => item.pageRevisionId === pageRevisionIdentity && item.slotId === "product-authority" && approvedProductMedia(item)) ?? null;
  const resolvedProductAssignment = approvedProductMedia(input.approvedProductMedia) ? input.approvedProductMedia : null;
  const productAssignment = exactProductAssignment ?? resolvedProductAssignment;
  const productMediaResolved = productAssignment !== null;
  const productMediaQa = evaluateProductAuthorityMediaRequirement({ approvedMediaAvailable: Boolean(input.productAuthorityReference), resolvedAssignment: productAssignment });
  const expectedState = input.job.state ?? input.target.stateCode;
  const locationLabel = input.target.cityName ? `${input.target.cityName}, ${expectedState}` : expectedState;
  const stagingPreservesApprovedBundle = Boolean(input.wordpressStagingReceipt && input.wordpressStagingReceipt.jobId === input.job.jobId && input.wordpressStagingReceipt.artifactSha === hashRenderedVisualContent(sourceHtml));
  const localBundle = input.localThemingBundle && (input.localThemingBundle.context.identity.pageRevisionIdentity === pageRevisionIdentity || stagingPreservesApprovedBundle) ? input.localThemingBundle : null;
  const localizationQa = evaluateLocalizationContamination({
    expectedLocation: { city: input.target.cityName ?? "", state: expectedState },
    allowedContextLocations: localBundle ? [{ label: localBundle.context.geography.region, authority: localBundle.context.contextId }] : [],
    forbiddenReferenceLocations: input.referenceLocations,
    surfaces: [
      { source: "EYEBROW", text: locationLabel },
      { source: "TITLE", text: artifact?.title ?? input.job.title },
      ...headings.map((heading) => ({ source: "HEADING" as const, text: heading.text })),
      { source: "BODY", text: stripHtml(sourceHtml) },
      { source: "CTA", text: cta },
      { source: "ALT_TEXT", text: productAssignment?.metadata.altText },
      { source: "ALT_TEXT", text: text(input.wordpressMedia?.alt_text) },
      { source: "METADATA", text: artifact?.seoTitle ?? input.job.seoTitle },
      { source: "METADATA", text: artifact?.metaDescription ?? input.job.metaDescription },
      { source: "COMPOSITION_LABEL", text: input.target.cityName },
      { source: "COMPOSITION_LABEL", text: localBundle ? JSON.stringify({ geography: localBundle.context.geography, facts: localBundle.context.facts, links: localBundle.links.links.map((link) => ({ anchorIntent: link.anchorIntent, reason: link.reason })), applications: localBundle.applications.applications.map((application) => ({ label: application.label, relationship: application.relationship })), theme: localBundle.theme.expression, media: localBundle.media.map((item) => ({ altText: item.altText })) }) : null },
    ],
  });
  const issues: ReviewIssue[] = [];
  if (!artifact) issues.push({ category: "CONTENT", severity: "BLOCKED", what: "Generated source artifact is unavailable", effect: "Structured content review cannot be completed.", safeNextStep: "Return to campaign detail and inspect the exact execution." });
  if (Object.keys(qaFailures).length > 0) issues.push({ category: "CONTENT", severity: "BLOCKED", what: "Generated content QA has failures", effect: Object.values(qaFailures).map(String).join(" "), safeNextStep: "Open campaign detail and use an existing governed repair path." });
  if (!wordpressVerified && input.target.status !== "content_ready") issues.push({ category: "WORDPRESS", severity: "WARNING", what: "Live WordPress draft could not be fully verified", effect: input.wordpressReadState, safeNextStep: "Use the authenticated WordPress edit link and confirm the exact draft identity." });
  if (productMediaQa.state === "FAIL") issues.push({ category: "IMAGE", severity: "BLOCKED", what: "Required product authority media unresolved", effect: `${productMediaQa.code}: Approved product authority exists, but no matching governed documentary asset could be resolved.`, safeNextStep: "Resolve an approved existing product asset. Generated contextual media must not substitute for product authority." });
  if (!contextualReady && !localBundle?.media.some((item) => item.role === "CONTEXTUAL_IN_USE")) issues.push({ category: "IMAGE", severity: "WARNING", what: "Contextual image unavailable", effect: "No durable featured-media receipt is available for this draft.", safeNextStep: "Review media evidence in campaign detail; do not infer an image assignment." });
  if (localizationQa.state === "FAIL") issues.push({ category: "CONTENT", severity: "BLOCKED", what: "Forbidden reference location reached owner-visible review", effect: localizationQa.forbiddenOccurrences.map((occurrence) => `${occurrence.token} in ${occurrence.source}`).join(", "), safeNextStep: "Repair deterministic presentation metadata and rerun localization QA without regenerating clean source content." });
  if (input.target.status === "content_ready" && (input.target.pageType ?? input.campaign.pageType) === "city_service" && !localBundle) issues.push({ category: "POLICY", severity: "BLOCKED", what: "Governed localized composition is unavailable", effect: "LOCAL_CONTEXT, APPLICATION_CONTEXT, semantic multi-role media, responsive composition evidence, and localized CTA hierarchy have not been assembled for this page revision.", safeNextStep: "Build a non-mutating localized composition bundle from the existing CONTENT_READY artifact before another owner review." });
  if (input.target.status === "content_ready" && localBundle && input.localThemeVisualCertification?.state !== "READY_FOR_OWNER_REVIEW") issues.push({ category: "POLICY", severity: "BLOCKED", what: "Responsive localized composition certification is incomplete", effect: input.localThemeVisualCertification ? `Certification state is ${input.localThemeVisualCertification.state}.` : "Required 1440, 1024, 768, and 375 viewport evidence is absent.", safeNextStep: "Capture and certify the exact non-mutating localized composition at all required viewports." });
  const durableHeadingReceipt = input.job.jobId === SAN_ANTONIO_STAGING_JOB_ID ? getSanAntonioDurableHeadingContrastState().receipts.at(-1) ?? null : null; const actualNativeEvidence = input.job.jobId === SAN_ANTONIO_STAGING_JOB_ID && !durableHeadingReceipt ? SAN_ANTONIO_ACTUAL_NATIVE_CONTRAST_EVIDENCE : null; const historicalNativeMismatch = input.job.jobId === SAN_ANTONIO_STAGING_JOB_ID ? SAN_ANTONIO_NATIVE_PREVIEW_CONTRAST_MISMATCH_V1 : null; const nativeContradiction = historicalNativeMismatch && !actualNativeEvidence && !durableHeadingReceipt ? historicalNativeMismatch : null; const contrastReadiness = deriveGenesisContrastReadiness({ state: actualNativeEvidence?.state ?? input.backgroundAwareContrastCertification?.state ?? null, authority: actualNativeEvidence?.authority ?? input.backgroundAwareContrastCertification?.identity.authority ?? null, nativeHostEvidenceAvailable: Boolean(actualNativeEvidence ?? historicalNativeMismatch ?? durableHeadingReceipt), higherAuthorityContradiction: Boolean(nativeContradiction) });
  if (input.wordpressStagingReceipt && !contrastReadiness.ownerReviewReady) issues.push({ category: "POLICY", severity: "BLOCKED", what: "Background-aware text contrast certification is incomplete", effect: input.backgroundAwareContrastCertification ? `${input.backgroundAwareContrastCertification.failureCount} rendered text contrast failures remain.` : "The exact staged render has no current background-aware contrast certification.", safeNextStep: "Run the shared rendered contrast gate at 1440, 1024, 768, and 375 before owner review." });
  if (nativeContradiction) issues.push({ category: "POLICY", severity: "BLOCKED", what: "Authenticated native preview contradicts lower-authority contrast certification", effect: "Product Context and Application Experience headings are dark on dark in the owner's actual WordPress preview. Exact native cascade provenance is not available in the shared browser session.", safeNextStep: "Share the authenticated native preview tab so Genesis can capture final computed styles and winning CSS rules. Do not publish or mutate contrast styles before the cascade is proven." });
  if (durableHeadingReceipt) issues.push({ category: "POLICY", severity: "BLOCKED", what: "Owner visual verification is required for the durable heading repair", effect: `Stored revision ${durableHeadingReceipt.afterHash} supersedes all prior native-browser evidence.`, safeNextStep: "The owner must refresh the authenticated WordPress preview and visually verify both dark-background headings. Do not publish." });
  const reviewState = issues.some((issue) => issue.severity === "BLOCKED") ? "REVIEW_BLOCKED" : issues.length > 0 ? "NEEDS_ATTENTION" : "READY_FOR_OWNER_REVIEW";
  const listQuery = `organizationId=${encodeURIComponent(input.campaign.organizationId)}&siteId=${encodeURIComponent(input.campaign.siteId)}`;
  const visualQa = deriveGeneratedPageVisualQaReview(input.visualCertification ?? { certification: null, decision: null, certificationState: "NOT_CERTIFIED", decisionState: "PENDING" });
  const ownerReviewEligible = !issues.some((issue) => issue.severity === "BLOCKED") && visualQa.certificationState === "CURRENT" && visualQa.overallState === "PASS" && ["draft", "publish"].includes(input.visualCertification?.certification?.identity.wordpressStatus ?? "");
  const publishEligible = input.target.status === "draft_ready"
    && wordpressVerified
    && wordpressStatus === "draft"
    && visualQa.certificationState === "CURRENT"
    && visualQa.overallState === "PASS"
    && visualQa.decisionState === "CURRENT"
    && visualQa.decision?.decision === "APPROVED"
    && input.campaign.publicationPolicy !== "draft_only";
  const generatedContextualRepairEligible = draftReadyContextualRepairRequired
    && input.target.status === "draft_ready"
    && wordpressStatus === "draft"
    && Boolean(wordpressObjectId)
    && Boolean(input.job.externalExecutionId)
    && (!contextualReady || (Boolean(selectedGeneratedContextualAssignment?.wordpressReceipt?.mediaId) && String(input.wordpressDraft?.featured_media ?? "") !== String(selectedGeneratedContextualAssignment?.wordpressReceipt?.mediaId ?? "")));
  const media = [
    productMediaResolved ? { slotId: "product-authority", role: "PRODUCT_AUTHORITY" as const, requirement: "REQUIRED" as const, assignmentId: productAssignment.assignmentId, readiness: "READY" as const, provenance: `${productAssignment.asset.authorityReference}:APPROVED_PRODUCT_REUSE` } : mediaExpectationFromAssignments({ role: "PRODUCT_AUTHORITY", requirement: "REQUIRED", slotId: "product-authority", assignments: input.mediaAssignments ?? [], pageRevisionIdentity, authorityAvailable: Boolean(input.productAuthorityReference) }),
    localBundle?.media.find((item) => item.role === "CONTEXTUAL_IN_USE") ? { slotId: "contextual-in-use", role: "CONTEXTUAL_IN_USE" as const, requirement: "DESIRED" as const, assignmentId: localBundle.media.find((item) => item.role === "CONTEXTUAL_IN_USE")!.mediaId, readiness: "READY" as const, provenance: "LOCALIZED_COMPOSITION_EVIDENCE" } : mediaExpectationFromAssignments({ role: "CONTEXTUAL_IN_USE", requirement: "DESIRED", slotId: "contextual-in-use", assignments: input.mediaAssignments ?? [], pageRevisionIdentity, legacy: contextualReady && mediaId ? { mediaId, provenance: "LEGACY_FEATURED" } : null }),
  ];
  const compositionPlan = createRichPageCompositionPlan({ planId: `composition-plan-${input.job.jobId}-${input.job.updatedAt}`, identity: { organizationId: input.job.organizationId, siteId: input.job.siteId, pageId: input.target.targetId, pageRevisionIdentity, canonicalPath: input.target.canonicalPath ?? input.job.slug, jobId: input.job.jobId, wordpressObjectId }, pageType: input.target.pageType ?? input.campaign.pageType, cta: cta ? { label: cta, destination: [...links].reverse().find((link) => link.label === cta)?.url ?? "" } : null, media, decisionSource: "Owner-approved Commercial Stainless evidence adapted through site-neutral Rich Page Composition V1.", evidenceReferences: ["visual-certification-424e2ea8-7efe-4e74-94aa-1d48c9fbbf4e", "visual-certification-11ccbc70-307e-4084-8d3a-7546dcf6bf5a"] });
  const localizedCaptures = input.localThemeVisualCertification?.captures.map((capture) => ({ ...capture, viewportClass: capture.viewport === "MOBILE_375" ? "MOBILE" as const : "DESKTOP" as const, screenshotArtifact: capture.screenshotArtifact, source: { origin: "LOCALIZED_PREVIEW", pathname: `/glw/pages/${input.job.jobId}/composition-preview-v2` }, renderer: { engine: input.localThemeVisualCertification!.rendererVersion, version: null, userAgent: null } }));
  const proposedFindings = evaluateRichPageComposition({ plan: compositionPlan, captures: input.visualCertification?.certification?.captures ?? localizedCaptures ?? [], duplicateOpeningMedia: null, cardWidths: null, proseWidths: null, headerWidth: null, primaryCtaDistinct: null });
  const linkCounts = localBundle?.links.links.reduce<Record<string, number>>((counts, link) => ({ ...counts, [link.role]: (counts[link.role] ?? 0) + 1 }), {}) ?? {};
  const applyState = input.job.jobId === "2ca74016-252b-4587-bf3c-ec9b7eb839c9" ? getDallasApplyState() : null; const applyReceipt=applyState?.receipts.at(-1)??null; const applyComparison=applyState?.comparisons?.at(-1)??null; const publicationState=input.job.jobId === "2ca74016-252b-4587-bf3c-ec9b7eb839c9"?getDallasPublicationState():null;const candidateReference=publicationState?.referenceCertifications.at(-1)??null;const reference=candidateReference&&!publicationState?.referenceRevocations.some((item)=>item.certificationId===candidateReference.certificationId)?candidateReference:null;const themeState=input.job.jobId==="2ca74016-252b-4587-bf3c-ec9b7eb839c9"?getDallasThemeIntegrationState():null;const themeReceipt=themeState?.receipts.at(-1)??null;const themeCertification=themeState?.certifications.at(-1)??null;

  return {
    identity: { title: artifact?.title ?? input.job.title, target: input.target.cityName ? `${input.target.cityName}, ${input.target.stateCode}` : input.target.stateCode, product: input.productName, site: input.siteName, domain: input.domain, campaign: input.campaign.name, campaignId: input.campaign.campaignId, targetId: input.target.targetId, canonicalPath: input.target.canonicalPath ?? input.job.slug, lifecycleState: input.target.status, publicationPolicy: input.campaign.publicationPolicy },
    wordpress: { objectId: wordpressObjectId, status: wordpressStatus, verified: wordpressVerified, titleMatchesSource, contentMatchesSource, readState: input.wordpressReadState, title: wordpressTitle || null, modifiedAt: input.wordpressDraft?.modified_gmt ?? null, editUrl: input.wordpressEditUrl, sourceUrl: input.wordpressDraft?.link ?? input.job.wordpressUrl, previewHtml: liveHtml ? sanitizePreviewHtml(liveHtml) : null },
    source: { html: sanitizePreviewHtml(sourceHtml), excerpt: artifact?.excerpt ?? null, h1: headings.find((heading) => heading.level === 1)?.text ?? null, headings, bodySections, cta, faqPresent: headings.some((heading) => /faq|frequently asked/i.test(heading.text)), internalLinks, rawHtml: sourceHtml },
    seo: { title: artifact?.seoTitle ?? input.job.seoTitle ?? null, titleState: artifact?.seoTitle || input.job.seoTitle ? "PASS" : "WARNING", metaDescription: artifact?.metaDescription ?? input.job.metaDescription ?? null, metaDescriptionState: artifact?.metaDescription || input.job.metaDescription ? "PASS" : "WARNING", canonicalState: (input.target.canonicalPath ?? "") === (artifact?.slug ?? input.job.slug) ? "PASS" : "BLOCKED", redirectState: "NOT_EVALUATED", indexabilityState: wordpressStatus === "draft" ? "PASS" : "WARNING", h1Count, h1State: h1Count === 1 ? "PASS" : "WARNING", developmentUrlLeakState: /(?:localhost|127\.0\.0\.1|\.test)(?:[/:"'])/i.test(sourceHtml) ? "BLOCKED" : "PASS", detail: `${input.job.wordCount ?? 0} words · ${links.length} rendered links` },
    images: {
      productAuthority: { state: exactProductAssignment ? "ASSIGNED" : productMediaResolved ? "RESOLVED_APPROVED" : "NOT_WIRED", imageUrl: productAssignment?.asset.type === "APPROVED_EXISTING" ? productAssignment.asset.url : null, authority: exactProductAssignment ? "Owner-approved canonical product media assigned to this exact page revision." : productMediaResolved ? "Owner-approved canonical product media resolved by exact product and authority identity for non-mutating review." : input.productAuthoritySource ?? "Approved product authority exists outside this legacy page assignment.", provenance: productAssignment?.asset.type === "APPROVED_EXISTING" ? `${productAssignment.asset.authorityReference} · ${productAssignment.asset.sha256}` : input.productAuthorityReference ?? "No target-level PRODUCT_AUTHORITY assignment is exposed.", altText: productAssignment?.metadata.altText ?? null, wordpressMediaId: productAssignment?.asset.type === "APPROVED_EXISTING" && productAssignment.asset.wordpressMediaId ? String(productAssignment.asset.wordpressMediaId) : null, renderedInCurrentWordPress: false },
      contextualInUse: {
        state: contextualReady
          ? strictGeneratedContextualRequired
            ? (strictGeneratedReceiptValid ? "GENERATED_CONTEXTUAL" : "ASSIGNED_FEATURED")
            : "LEGACY_FEATURED"
          : "MISSING",
        imageUrl: strictGeneratedContextualDisplay
          ? strictGeneratedContextualDisplay.url
          : preCaptureContextualAssignment?.asset.type === "APPROVED_EXISTING"
            ? preCaptureContextualAssignment.asset.url
          : text(input.wordpressMedia?.source_url) || null,
        authority: strictGeneratedContextualRequired
          ? (strictGeneratedReceiptValid
            ? (usedContextualCarryForward
              ? "Generated contextual assignment and receipt carried forward from prior revision under current rendered PASS evidence"
              : "Exact generated contextual assignment and receipt bound to this draft revision")
            : (preCaptureContextualReady
              ? "Current revision site-page assignment and verified WordPress receipt satisfy pre-capture contextual evidence"
              : "Generated contextual receipt required for this campaign target"))
          : (currentContextualMedia.length
            ? "Current governed rendered visual certification"
            : mediaAuthority
              ? `${text(mediaAuthority.selectedProvenance) || "Legacy execution media"}`
              : "Legacy execution evidence"),
        provenance: strictGeneratedContextualRequired
          ? (strictGeneratedReceiptValid && generatedContextualReceipt
            ? (usedContextualCarryForward
              ? `Generated receipt ${generatedContextualReceipt.generationId}; WordPress media #${generatedContextualReceipt.wordpressMediaId ?? "unknown"}; prior assignment accepted via current rendered PASS evidence.`
              : `Generated receipt ${generatedContextualReceipt.generationId}; WordPress media #${generatedContextualReceipt.wordpressMediaId ?? "unknown"}.`)
            : (preCaptureContextualAssignment
              ? `Assignment ${preCaptureContextualAssignment.assignmentId}; WordPress media #${preCaptureContextualAssignment.wordpressReceipt?.mediaId ?? "unknown"}; pre-capture evidence only.`
              : "No exact generated contextual receipt persisted for this page revision."))
          : (currentContextualMedia.length
            ? currentContextualMedia.map((item) => `${item.role}: WordPress media #${item.mediaId}`).join("; ")
            : mediaId
              ? `WordPress media #${mediaId}; selected by the legacy execution.`
              : "No WordPress media receipt persisted."),
        altText: strictGeneratedContextualDisplay
          ? selectedGeneratedContextualAssignment.metadata.altText
          : preCaptureContextualAssignment?.metadata.altText
            ? preCaptureContextualAssignment.metadata.altText
          : text(input.wordpressMedia?.alt_text) || null,
        wordpressMediaId: strictGeneratedContextualDisplay
          ? String(strictGeneratedContextualDisplay.mediaId)
          : (preCaptureContextualAssignment?.wordpressReceipt?.mediaId ? String(preCaptureContextualAssignment.wordpressReceipt.mediaId) : null)
            || (strictContextualMediaId || generatedContextualEvidence?.mediaId || currentContextualMedia.find((item) => item.semanticRole === "CONTEXTUAL_IN_USE")?.mediaId || mediaId) || null,
        assignmentId: strictGeneratedContextualDisplay
          ? selectedGeneratedContextualAssignment.assignmentId
          : preCaptureContextualAssignment?.assignmentId
            ? preCaptureContextualAssignment.assignmentId
          : generatedContextualEvidence?.assignmentId ?? null,
        grounding: strictGeneratedContextualRequired
          ? (strictGeneratedReceiptValid
            ? (usedContextualCarryForward
              ? "Generated contextual media is product-truth grounded and identity-matched to current rendered PASS evidence and featured media."
              : "Generated contextual media is product-truth grounded and bound to the exact target, job, and page revision.")
            : (preCaptureContextualReady
              ? "Pre-capture contextual evidence is current and verified, but rendered visual certification is still required for final authority."
              : "Legacy featured media is not accepted as contextual in-use authority for this campaign."))
          : (currentContextualMedia.length
            ? "Governed contextual assignments rendered in the current certified WordPress presentation."
            : productAuthority?.exactProductMatch === true
              ? "Legacy exact-product match recorded; PRODUCT_TRUTH role was not persisted."
              : "PRODUCT_TRUTH grounding not persisted."),
      },
      contractState: currentContextualMedia.length ? "MULTI_ROLE_IMAGE_STATE" : "LEGACY_IMAGE_STATE",
    },
    evidence: [
      { source: input.productName, status: productAuthority?.exactProductMatch === true ? "VERIFIED" : "AVAILABLE", usedFor: "Product identity and canonical product reference" },
      { source: `Campaign knowledge pack revision ${input.knowledgePack?.revision ?? "unknown"}`, status: input.knowledgePack?.status?.toUpperCase() ?? "AVAILABLE", usedFor: "Generation instructions and governed references" },
      { source: `${input.target.cityName ?? input.target.stateCode} target`, status: "DURABLE", usedFor: "Canonical geography and page path" },
      ...((input.knowledgePack?.authorityReferences ?? []).slice(0, 5).map((reference) => ({ source: `${reference.sourceType}: ${reference.sourceId}`, status: "GOVERNED", usedFor: reference.scope.replaceAll("_", " ") }))),
      ...(internalLinkEvidence ? [{ source: `${Number(internalLinkEvidence.linksRendered ?? 0)} internal link${Number(internalLinkEvidence.linksRendered ?? 0) === 1 ? "" : "s"}`, status: "RENDERED", usedFor: "Internal navigation and product authority" }] : []),
    ],
    trace: { jobId: input.job.jobId, externalExecutionId: input.job.externalExecutionId, generationState: input.job.status, reconciliationState: input.target.status === "draft_ready" ? "RECONCILED TO DRAFT" : input.target.status.toUpperCase(), wordpressObjectId, attemptCount: input.target.attemptCount, lastActivity: input.job.updatedAt },
    qaChecks,
    issues,
    localizationQa,
    productMediaQa,
    reviewState,
    actions: {
      canonical: input.wordpressEditUrl ? { label: "Open WordPress Draft", href: input.wordpressEditUrl } : null,
      campaignHref: `/glw/campaigns/${encodeURIComponent(input.campaign.campaignId)}?${listQuery}`,
      listHref: `/glw/campaigns?${listQuery}`,
      visualCapture: { endpoint: `/api/glw/pages/${encodeURIComponent(input.job.jobId)}/visual-certification`, organizationId: input.campaign.organizationId, siteId: input.campaign.siteId },
      ownerDecision: ownerReviewEligible && input.visualCertification?.certification ? { endpoint: `/api/glw/visual-certifications/${encodeURIComponent(input.visualCertification.certification.certificationId)}/decision`, organizationId: input.campaign.organizationId, siteId: input.campaign.siteId } : null,
      publish: publishEligible ? {
        endpoint: `/api/glw/campaigns/${encodeURIComponent(input.campaign.campaignId)}/publish`,
        organizationId: input.campaign.organizationId,
        siteId: input.campaign.siteId,
        campaignId: input.campaign.campaignId,
        targetId: input.target.targetId,
      } : null,
      generatedContextualRepair: generatedContextualRepairEligible && wordpressObjectId ? {
        endpoint: `/api/glw/pages/${encodeURIComponent(input.job.jobId)}/generated-contextual-media-repair`,
        organizationId: input.campaign.organizationId,
        siteId: input.campaign.siteId,
        operation: "REPAIR_DRAFT_READY_GENERATED_CONTEXTUAL_MEDIA",
        label: projectorEnclosureContextualRequired
          ? "Build Contextual Visual Set"
          : strictGeneratedContextualRequired && contextualReady
            ? "Reconcile Featured Contextual Image"
            : mediaId
              ? "Replace Legacy Contextual Image"
              : "Generate Contextual Image",
        identity: {
          campaignId: input.campaign.campaignId,
          targetId: input.target.targetId,
          jobId: input.job.jobId,
          externalExecutionId: input.job.externalExecutionId ?? "",
          wordpressObjectId,
          productId: input.job.productId,
          pageRevisionId: pageRevisionIdentity,
          expectedStoredSha256: hashRenderedVisualContent(liveHtml || sourceHtml),
        },
      } : null,
    },
    visualQa,
    richComposition: { plan: compositionPlan, identityState: "CURRENT", currentRender: { profile: "CONTENT_ARTICLE", certificationState: visualQa.certificationState, overallState: visualQa.overallState }, proposedFindings, safeNextAction: !productMediaResolved ? "Resolve approved PRODUCT_AUTHORITY media through site-page-media-assignment-v1 before owner review; generated media is not a documentary substitute." : !localBundle ? "Build the governed localized composition bundle from the existing CONTENT_READY artifact before owner review." : "Review the non-mutating composition preview. WordPress draft and campaign authority remain unchanged.", preview: { state: "PREVIEW_ONLY", locationLabel, title: artifact?.title ?? input.job.title, excerpt: artifact?.excerpt ?? null, bodyHtml: sanitizePreviewHtml(sourceHtml).replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, "").replace(/<img\b[^>]*>/gi, ""), productId: input.job.productId, productName: input.productName, productImageUrl: productAssignment?.asset.type === "APPROVED_EXISTING" ? productAssignment.asset.url : null, productAltText: productAssignment?.metadata.altText ?? null, contextualImageUrl: strictGeneratedContextualDisplay ? strictGeneratedContextualDisplay.url : text(input.wordpressMedia?.source_url) || null, contextualAltText: strictGeneratedContextualDisplay ? selectedGeneratedContextualAssignment.metadata.altText : text(input.wordpressMedia?.alt_text) || null, ctaLabel: cta, href: `/glw/pages/${encodeURIComponent(input.job.jobId)}/composition-preview?organizationId=${encodeURIComponent(input.job.organizationId)}&siteId=${encodeURIComponent(input.job.siteId)}` } },
    localizedV2: localBundle ? { state: input.target.status === "content_ready" ? input.localThemeVisualCertification?.state === "READY_FOR_OWNER_REVIEW" ? "READY_FOR_OWNER_REVIEW" : "BLOCKED" : localBundle.composition.validationState, href: `/glw/pages/${encodeURIComponent(input.job.jobId)}/composition-preview-v2?organizationId=${encodeURIComponent(input.job.organizationId)}&siteId=${encodeURIComponent(input.job.siteId)}`, localizationLevel: localBundle.theme.localizationLevel, contextFacts: localBundle.context.facts.length, applications: localBundle.applications.applications.map((application) => ({ id: application.applicationId, state: application.compatibility })), linkCounts, media: localBundle.media.map((item) => ({ role: item.role, claimClass: item.claimClass, reviewState: item.ownerReviewState, source: item.source, productTruthReference: item.productTruthReference, sha256: item.sha256, altText: item.altText })), blockers: [...localBundle.composition.blockers, ...(input.target.status === "content_ready" && input.localThemeVisualCertification?.state !== "READY_FOR_OWNER_REVIEW" ? ["RESPONSIVE_VISUAL_CERTIFICATION_REQUIRED"] : [])], claimSafety: { brandAuthorityPrecedence: true, falseProximityClaimsProhibited: true, antiClicheSafeguards: localBundle.theme.safeguards.antiClicheTerms }, visualCertification: input.localThemeVisualCertification ? { certificationId: input.localThemeVisualCertification.certificationId, state: input.localThemeVisualCertification.state, ownerReviewRequired: input.localThemeVisualCertification.ownerReviewRequired, findings: input.localThemeVisualCertification.findings, viewports: input.localThemeVisualCertification.captures.map((capture) => ({ label: capture.viewport, overflow: capture.horizontalOverflow, artifactUrl: `/api/glw/pages/${encodeURIComponent(input.job.jobId)}/localized-preview-v2/certification/${encodeURIComponent(capture.captureId)}?organizationId=${encodeURIComponent(input.job.organizationId)}&siteId=${encodeURIComponent(input.job.siteId)}`, width: capture.screenshotArtifact.width, height: capture.screenshotArtifact.height, sha256: capture.screenshotArtifact.sha256 })) } : null, ownerQuestions: ["Does this feel like ProjectorEnclosure?", `Does this feel relevant to ${input.target.cityName ?? input.target.stateCode}?`, `Does it avoid ${expectedState} cliché?`, "Does the product look real and correct?", "Does the in-use scene look credible?", "Does the selected application have authority?", "Do the links make the page more useful?", `Does anything imply a local office, customer, or actual ${input.target.cityName ?? input.target.stateCode} installation?`] } : null,
    marketMatch: input.marketMatchBundle ? { href: `/glw/market-opportunities/dallas?organizationId=${encodeURIComponent(input.job.organizationId)}&siteId=${encodeURIComponent(input.job.siteId)}`, previewV3Href: `/glw/pages/${encodeURIComponent(input.job.jobId)}/composition-preview-v3?organizationId=${encodeURIComponent(input.job.organizationId)}&siteId=${encodeURIComponent(input.job.siteId)}`, signalCount: input.marketMatchBundle.intelligence.signals.length, catalogCount: input.marketMatchBundle.catalog.length, ranked: input.marketMatchBundle.opportunities.map((item) => ({ application: item.applicationId, product: item.catalogItemId, confidence: item.confidence })), pageStrategy: { primary: input.marketMatchBundle.pageStrategy.primaryApplication, supporting: input.marketMatchBundle.pageStrategy.supportingApplications, crossSell: input.marketMatchBundle.pageStrategy.crossSellCatalogItemIds, rejected: input.marketMatchBundle.pageStrategy.rejectedAdjacencies.length }, mutationAuthorized: false } : null,
    appliedV3: applyReceipt ? { receiptId: applyReceipt.receiptId, status: applyReceipt.wordpressStatus, beforeHash: applyReceipt.beforeHash, afterHash: applyReceipt.afterHash, decisionId: applyReceipt.decisionId, drift: applyComparison?.drift.classification??null, comparisonHref: `/glw/pages/${encodeURIComponent(input.job.jobId)}/wordpress-comparison?organizationId=${encodeURIComponent(input.job.organizationId)}&siteId=${encodeURIComponent(input.job.siteId)}`, ownerReviewRequired: true } : null,
    referencePage:reference?{certificationId:reference.certificationId,publicUrl:reference.publicUrl,visualCertificationId:reference.publicVisualCertificationId,ownerApprovalId:reference.ownerApprovalId,publicationReceiptId:reference.publicationReceiptId,href:`/glw/pages/${encodeURIComponent(input.job.jobId)}/reference-page?organizationId=${encodeURIComponent(input.job.organizationId)}&siteId=${encodeURIComponent(input.job.siteId)}`,state:reference.state}:null,
    themeIntegration:themeReceipt&&themeCertification?{receiptId:themeReceipt.receiptId,certificationId:themeCertification.certificationId,state:themeCertification.overallState,drift:themeCertification.drift,href:`/glw/pages/${encodeURIComponent(input.job.jobId)}/theme-integration-review?organizationId=${encodeURIComponent(input.job.organizationId)}&siteId=${encodeURIComponent(input.job.siteId)}`,visibleH1Count:themeCertification.captures[0]?.themeIntegration.visibleH1Count??0,overflow1024:themeCertification.captures.find(item=>item.viewport==="DESKTOP_1024")?.horizontalOverflow??-1}:null,
    wordpressStaging: input.wordpressStagingReceipt && input.wordpressStagingCertification ? { receiptId: input.wordpressStagingReceipt.receiptId, state: "WORDPRESS_STAGED", ownerCompositionApproved: true, wordpressObjectId: input.wordpressStagingReceipt.wordpressObjectId, wordpressStatus: input.wordpressStagingReceipt.wordpressStatus, wordpressAuthority: input.wordpressStagingReceipt.wordpressAuthority, storedCompositionHash: input.wordpressStagingCertification.storedCompositionHash, artifactSha: input.wordpressStagingReceipt.artifactSha, approvedCompositionCommit: input.wordpressStagingReceipt.approvedCompositionCommit, mediaResolved: input.wordpressStagingCertification.mediaResolved, localizationCertification: input.wordpressStagingCertification.localizationContaminationGate, claimCertification: input.wordpressStagingCertification.unsupportedClaims === 0 ? "PASS" : "FAIL", genesisResponsiveCertification: input.wordpressStagingCertification.genesisCompositionCertified ? "PASS" : "FAIL", wordpressStoredAuthorityCertified: input.wordpressStagingCertification.wordpressStoredAuthorityCertified, nativeWordPressDraftRenderCertified: input.wordpressStagingCertification.nativeWordPressDraftRenderCertified, nativePreviewLimitation: input.wordpressStagingCertification.nativeWordPressPreviewLimitation, reviewUrl: input.wordpressEditUrl ?? input.wordpressStagingReceipt.wordpressUrl } : null,
    nativeRenderRepair: input.job.jobId === SAN_ANTONIO_STAGING_JOB_ID ? (() => { const state = getSanAntonioNativeRepairState(); const receipt = state.receipts.at(-1); const certification = receipt ? state.certifications.filter((item) => item.receiptId === receipt.receiptId).at(-1) : null; return receipt && certification ? { receiptId: receipt.receiptId, state: "READY_FOR_OWNER_NATIVE_PREVIEW" as const, beforeHash: receipt.beforeHash, afterHash: receipt.afterHash, shellContract: receipt.shellContract, featuredMediaId: 10757 as const, duplicateThemeTitleSuppressed: true as const, duplicateThemeFeaturedImageSuppressed: true as const, certificationState: certification.state, nativePreviewAutomationAvailable: false as const, nativePreviewCertificationClaimed: false as const, captures: certification.captures.map((capture) => ({ viewport: capture.viewport, overflow: capture.horizontalOverflow, productMediaRatio: capture.productMediaRatio, productCopyWidth: capture.productCopyWidth, productHeadingLineCount: capture.productHeadingLineCount, contextualHeadingLineCount: capture.contextualHeadingLineCount })), ownerPreviewRequired: true as const } : null; })() : null,
    heroContrastRepair: input.job.jobId === SAN_ANTONIO_STAGING_JOB_ID ? (() => { const hero = getSanAntonioHeroContrastState().receipts.at(-1); const native = getSanAntonioNativeRepairState(); const certification = native.certifications.filter((item) => item.certificationId.includes("v1_3-hero-contrast")).at(-1); return hero && certification ? { receiptId: hero.receiptId, state: "READY_FOR_OWNER_HERO_REVIEW" as const, beforeHash: hero.beforeHash, afterHash: hero.afterHash, h1ColorBefore: hero.h1ColorBefore, h1ColorAfter: hero.h1ColorAfter, backgroundPreserved: true as const, certificationState: certification.state, captures: certification.captures.map((capture) => ({ viewport: capture.viewport, h1Color: capture.heroH1Color, h1Contrast: capture.h1ContrastRatio, supportingContrast: capture.supportingCopyContrastRatio, primaryCtaContrast: capture.primaryCtaContrastRatio, secondaryCtaContrast: Math.min(capture.secondaryCtaTextContrastRatio, capture.secondaryCtaBorderContrastRatio), disclaimerContrast: capture.disclaimerContrastRatio, overlap: capture.heroTextOverlap, overflow: capture.horizontalOverflow })), nativePreviewAutomationAvailable: false as const, nativePreviewCertificationClaimed: false as const, ownerPreviewRequired: true as const } : null; })() : null,
    backgroundAwareContrast: actualNativeEvidence ? { contract: "GENESIS_BACKGROUND_AWARE_TEXT_CONTRAST_V1", certificationId: actualNativeEvidence.evidenceId, state: actualNativeEvidence.state, failureCount: actualNativeEvidence.captures.reduce((sum, capture) => sum + capture.failuresAfter, 0), ownerReviewReady: contrastReadiness.ownerReviewReady, publicationReady: contrastReadiness.publicationReady, authority: actualNativeEvidence.authority, generatedImageReevaluationPerformed: true, viewports: actualNativeEvidence.captures.map((capture) => ({ viewport: capture.viewport, observations: 84, failures: capture.failuresAfter })) } : input.backgroundAwareContrastCertification ? { contract: input.backgroundAwareContrastCertification.contract, certificationId: input.backgroundAwareContrastCertification.certificationId, state: input.backgroundAwareContrastCertification.state, failureCount: input.backgroundAwareContrastCertification.failureCount, ownerReviewReady: contrastReadiness.ownerReviewReady, publicationReady: contrastReadiness.publicationReady, authority: input.backgroundAwareContrastCertification.identity.authority, generatedImageReevaluationPerformed: input.backgroundAwareContrastCertification.generatedImageReevaluationPerformed, viewports: input.backgroundAwareContrastCertification.captures.map((capture) => ({ viewport: capture.viewport, observations: capture.results.length, failures: capture.failures })) } : null,
    durableReviewDecisionExists: visualQa.decisionState === "CURRENT" && visualQa.decision !== null,
  };
}

export function deriveGeneratedPageVisualQaReview(input: { certification: RenderedVisualCertification | null; decision: RenderedVisualOwnerDecision | null; certificationState: "NOT_CERTIFIED" | "CURRENT" | "STALE"; decisionState: "PENDING" | "CURRENT" | "STALE" }): GeneratedPageVisualQaReview {
  const certification = input.certification;
  if (!certification) return { contractExists: true, certificationState: "NOT_CERTIFIED", overallState: "NOT_EVALUATED", layoutClass: null, captureSetId: null, captures: [], findings: [], decision: null, decisionState: "PENDING", stale: false, safeNextStep: "Capture the exact governed page identity through a future authorized capture workflow.", authority: "The durable rendered visual certification contract is available, but no capture set exists for this page revision." };
  return {
    contractExists: true,
    certificationState: input.certificationState,
    overallState: input.certificationState === "STALE" ? "NOT_EVALUATED" : certification.overallState,
    layoutClass: certification.layoutClass,
    captureSetId: certification.captureSetId,
    captures: certification.captures.map((capture) => { const artifactUrl = `/api/glw/visual-certifications/${encodeURIComponent(certification.certificationId)}/artifacts/${encodeURIComponent(capture.captureId)}?organizationId=${encodeURIComponent(certification.identity.organizationId)}&siteId=${encodeURIComponent(certification.identity.siteId)}`; return { captureId: capture.captureId, viewportClass: capture.viewportClass, viewportWidth: capture.viewportWidth, viewportHeight: capture.viewportHeight, documentWidth: capture.documentWidth, documentHeight: capture.documentHeight, primaryContentWidth: capture.primaryContentBounds?.width ?? null, utilization: renderedVisualUtilization(capture), horizontalOverflow: capture.horizontalOverflow, artifactReference: artifactUrl, artifactUrl, artifactSha256: capture.screenshotArtifact.sha256, heroState: capture.hero.authority === "NOT_IDENTIFIED" ? "NOT_EVALUATED" : capture.hero.present ? "PASS" : "WARNING", mediaRendered: capture.media.filter((item) => item.rendered).length, mediaAssigned: capture.media.filter((item) => item.assigned).length, sectionCount: capture.sections.length }; }),
    findings: certification.findings,
    decision: input.decision,
    decisionState: input.decisionState,
    stale: input.certificationState === "STALE" || input.decisionState === "STALE",
    safeNextStep: input.certificationState === "STALE" ? "Recapture and re-run visual review for the current page identity." : input.decisionState === "PENDING" ? "Review the exact capture set before recording an owner decision through a governed decision workflow." : "No visual review continuation is required for the current evidence.",
    authority: `Certification ${certification.certificationId} · capture set ${certification.captureSetId} · ${certification.capturedAt}`,
  };
}

export async function buildGeneratedPageReviewModel(input: { jobId: string; organizationId?: string | null; siteId?: string | null }): Promise<GeneratedPageReviewModel | null> {
  const job = await glwPageExecutionRepository.getById(input.jobId);
  if (!job || (input.organizationId && job.organizationId !== input.organizationId) || (input.siteId && job.siteId !== input.siteId)) return null;
  const storedTarget = listAllGlwCampaignTargets().find((entry) => entry.jobId === job.jobId && entry.organizationId === job.organizationId && entry.siteId === job.siteId) ?? null;
  if (!storedTarget) return null;
  const certifications = listRenderedVisualCertifications({ organizationId: job.organizationId, siteId: job.siteId });
  const ownerDecisions = certifications.flatMap((certification) => listRenderedVisualOwnerDecisions(certification.certificationId));
  const projection = projectAuthoritativeGeneratedPage({ target: storedTarget, job, certifications, ownerDecisions });
  const target = projection.target;
  const campaign = listGlwCampaigns().find((entry) => entry.campaignId === target.campaignId) ?? null;
  const site = getSiteById(job.siteId);
  const product = getProductById(job.productId);
  if (!campaign || !site || !product) return null;

  let wordpressDraft: WordPressDraft | null = null;
  let wordpressMedia: WordPressMedia | null = null;
  let wordpressReadState = "WORDPRESS_READ_NOT_CONFIGURED";
  let wordpressEditUrl: string | null = null;
  const objectId = job.wordpressObjectId ?? target.wordpressObjectId;
  try {
    const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
    if (credential && site.integrations.wordpressApiBaseUrl && objectId) {
      const authority = createAuthenticatedWordPressReadAuthority({ configuration: { apiBaseUrl: site.integrations.wordpressApiBaseUrl, username: credential.username, applicationPassword: credential.applicationPassword, timeoutMs: 30_000 } });
      const draftRead = await authority.getJson({ path: `/pages/${objectId}`, query: new URLSearchParams({ context: "edit", _fields: "id,slug,status,link,modified_gmt,featured_media,title,content" }) });
      if (draftRead.ok && record(draftRead.body)) {
        wordpressDraft = draftRead.body as WordPressDraft;
        wordpressReadState = "AUTHENTICATED_EXACT_DRAFT_READ";
        const mediaId = Number(wordpressDraft.featured_media ?? 0);
        if (mediaId > 0) {
          const mediaRead = await authority.getJson({ path: `/media/${mediaId}`, query: new URLSearchParams({ context: "edit", _fields: "id,source_url,alt_text,title,caption,description" }) });
          if (mediaRead.ok && record(mediaRead.body)) wordpressMedia = mediaRead.body as WordPressMedia;
        }
      } else wordpressReadState = draftRead.ok ? "WORDPRESS_RESPONSE_INVALID" : draftRead.reason;
      wordpressEditUrl = `${new URL(normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl)).origin}/wp-admin/post.php?post=${encodeURIComponent(objectId)}&action=edit`;
    }
  } catch {
    wordpressReadState = "WORDPRESS_READ_UNAVAILABLE";
  }

  const sourceHtml = job.generatedDraft?.contentHtml ?? "";
  const renderedHtml = text(wordpressDraft?.content?.raw ?? wordpressDraft?.content?.rendered);
  const currentIdentity: RenderedVisualPageIdentity = { organizationId: job.organizationId, siteId: job.siteId, pageId: target.targetId, pageRevisionIdentity: projection.pageRevisionIdentity, canonicalPath: target.canonicalPath ?? job.slug, contentHash: hashRenderedVisualContent(sourceHtml), renderedContentHash: renderedHtml ? hashRenderedVisualContent(renderedHtml) : null, campaignId: campaign.campaignId, targetId: target.targetId, jobId: job.jobId, externalExecutionId: job.externalExecutionId, wordpressObjectId: objectId, wordpressStatus: wordpressDraft?.status ?? job.wordpressStatus };
  const visualCertification = getRenderedVisualCertificationState({ currentIdentity });
  const mediaAssignments = [
    ...listSitePageMediaAssignments({ organizationId: job.organizationId, siteId: job.siteId, buildSessionId: projection.contextualBuildSessionId, pageRevisionId: projection.pageRevisionIdentity }),
    ...listSitePageMediaAssignments({ organizationId: job.organizationId, siteId: job.siteId, buildSessionId: `contextual-media:${target.targetId}` }),
  ].filter((assignment, index, all) => all.findIndex((candidate) => candidate.assignmentId === assignment.assignmentId) === index);
  const localThemingBundle = getLocalPageThemingBundle({ organizationId: job.organizationId, siteId: job.siteId, jobId: job.jobId });
  const localThemeVisualCertification = localThemingBundle ? getLocalThemeVisualCertification(localThemingBundle.bundleId) : null;
  const approvedProductMedia = product.media.primaryImageReference ? resolveApprovedProductAuthorityMedia({ organizationId: job.organizationId, siteId: job.siteId, productId: job.productId, authorityReference: product.media.primaryImageReference }) : null;
  const generatedContextualReceipts = listGeneratedContextualMedia({ organizationId: job.organizationId, siteId: job.siteId, targetId: target.targetId })
    .map((record) => ({
      generationId: record.generationId,
      campaignId: record.campaignId,
      targetId: record.targetId,
      productId: record.productId,
      wordpressObjectId: record.wordpressObjectId,
      pageRevisionId: record.pageRevisionId,
      mediaRole: record.mediaRole,
      wordpressMediaId: record.wordpressMediaId,
    }));
  const referenceLocations = listAllGlwCampaignTargets().filter((entry) => entry.organizationId === job.organizationId && entry.siteId === job.siteId && entry.cityName && entry.targetId !== target.targetId).map((entry) => ({ label: entry.cityName!, authority: `CAMPAIGN_TARGET:${entry.targetId}` }));
  const marketMatchBundle = target.citySlug === "dallas" ? getMarketProductMatchBundle({ organizationId: job.organizationId, marketId: "market-dallas-north-texas" }) : null;
  const stagingState = job.jobId === SAN_ANTONIO_STAGING_JOB_ID ? getSanAntonioStagingState() : null; const wordpressStagingReceipt = stagingState?.receipts.at(-1) ?? null; const wordpressStagingCertification = stagingState?.certifications.filter((item) => item.receiptId === wordpressStagingReceipt?.receiptId).at(-1) ?? null; const currentRenderedHash = renderedHtml ? hashRenderedVisualContent(renderedHtml) : null; const backgroundAwareContrastCertification = currentRenderedHash ? listGenesisBackgroundAwareContrastCertifications().filter((item) => item.identity.organizationId === job.organizationId && item.identity.siteId === job.siteId && item.identity.pageId === (objectId ?? target.targetId) && item.identity.renderedContentHash === currentRenderedHash).at(-1) ?? null : null;
  return deriveGeneratedPageReviewModel({ campaign, target, job, siteName: site.displayName, domain: site.domain, productName: product.displayName, productAuthorityReference: product.media.primaryImageReference, productAuthoritySource: product.authorityProvenance?.sourceType ?? null, knowledgePack: getGlwCampaignKnowledgePack(campaign.campaignId), wordpressDraft, wordpressMedia, wordpressReadState, wordpressEditUrl, mediaAssignments, approvedProductMedia, referenceLocations, localThemingBundle, localThemeVisualCertification, marketMatchBundle, visualCertification, wordpressStagingReceipt, wordpressStagingCertification, backgroundAwareContrastCertification, authoritativeContextualMedia: projection.contextualMedia, authoritativePageRevisionIdentity: projection.pageRevisionIdentity, generatedContextualReceipts });
}