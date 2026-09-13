import "server-only";

import { createAuthenticatedWordPressReadAuthority, normalizeWordPressApiBaseUrl } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getProductById } from "@/modules/foundation/product-repository";
import { createRichPageCompositionPlan, evaluateRichPageComposition, mediaExpectationFromAssignments, type RichPageCompositionFinding, type RichPageCompositionPlan } from "@/modules/foundation/rich-page-composition";
import { getRenderedVisualCertificationState } from "@/modules/foundation/rendered-visual-certification-repository";
import { hashRenderedVisualContent, renderedVisualUtilization, type RenderedVisualCertification, type RenderedVisualFinding, type RenderedVisualOwnerDecision, type RenderedVisualPageIdentity } from "@/modules/foundation/rendered-visual-certification";
import { listSitePageMediaAssignments, type SitePageMediaAssignment } from "@/modules/foundation/site-page-media-assignment";
import { getLocalPageThemingBundle, type LocalPageThemingBundle } from "@/modules/foundation/local-context-page-theming-repository";
import { getLocalThemeVisualCertification } from "@/modules/foundation/local-theme-visual-certification-repository";
import type { LocalThemeVisualCertification } from "@/modules/foundation/local-theme-visual-certification";
import { getMarketProductMatchBundle, type MarketProductMatchBundle } from "@/modules/foundation/local-market-product-match-repository";
import { getDallasApplyState } from "./dallas-rich-composition-apply-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import type { GlwCampaign } from "./campaign-types";
import type { GlwCampaignTarget } from "./campaign-target-repository";
import type { GlwPageExecutionRecord } from "./page-execution";
import { listGlwCampaigns } from "./campaign-repository";
import { listAllGlwCampaignTargets } from "./campaign-target-repository";
import { getGlwCampaignKnowledgePack } from "./campaign-reference-repository";
import { glwPageExecutionRepository } from "./page-execution-repository";

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
    productAuthority: { state: "ASSIGNED" | "NOT_WIRED"; imageUrl: string | null; authority: string; provenance: string; altText: string | null; wordpressMediaId: string | null; renderedInCurrentWordPress: false };
    contextualInUse: { state: "LEGACY_FEATURED" | "MISSING"; imageUrl: string | null; authority: string; provenance: string; altText: string | null; wordpressMediaId: string | null; grounding: string };
    contractState: "LEGACY_IMAGE_STATE" | "MULTI_ROLE_IMAGE_STATE";
  };
  evidence: readonly { source: string; status: string; usedFor: string }[];
  trace: { jobId: string; externalExecutionId: string | null; generationState: string; reconciliationState: string; wordpressObjectId: string | null; attemptCount: number; lastActivity: string };
  qaChecks: readonly { label: string; state: ReviewSignal; detail: string }[];
  issues: readonly ReviewIssue[];
  reviewState: "READY_FOR_OWNER_REVIEW" | "NEEDS_ATTENTION" | "BLOCKED";
  actions: { canonical: { label: string; href: string } | null; campaignHref: string; listHref: string; visualCapture: { endpoint: string; organizationId: string; siteId: string } };
  visualQa: GeneratedPageVisualQaReview;
  richComposition: { plan: RichPageCompositionPlan; identityState: "CURRENT"; currentRender: { profile: "CONTENT_ARTICLE"; certificationState: GeneratedPageVisualQaReview["certificationState"]; overallState: ReviewSignal }; proposedFindings: readonly RichPageCompositionFinding[]; safeNextAction: string; preview: { state: "PREVIEW_ONLY"; title: string; excerpt: string | null; bodyHtml: string; productName: string; productImageUrl: string | null; productAltText: string | null; contextualImageUrl: string | null; contextualAltText: string | null; ctaLabel: string | null; href: string } };
  localizedV2: null | { state: "READY_FOR_OWNER_REVIEW" | "BLOCKED"; href: string; localizationLevel: number; contextFacts: number; applications: readonly { id: string; state: string }[]; linkCounts: Record<string, number>; media: readonly { role: string; claimClass: string; reviewState: string }[]; blockers: readonly string[]; claimSafety: { brandAuthorityPrecedence: true; falseProximityClaimsProhibited: true; antiClicheSafeguards: readonly string[] }; visualCertification: null | Pick<LocalThemeVisualCertification, "certificationId" | "state" | "ownerReviewRequired" | "findings"> & { viewports: readonly { label: string; overflow: number }[] }; ownerQuestions: readonly string[] };
  marketMatch: null | { href: string; previewV3Href: string; signalCount: number; catalogCount: number; ranked: readonly { application: string; product: string | null; confidence: string }[]; pageStrategy: { primary: string | null; supporting: readonly string[]; crossSell: readonly string[]; rejected: number }; mutationAuthorized: false };
  appliedV3: null | { receiptId: string; status: "draft"; beforeHash: string; afterHash: string; decisionId: string; drift: string | null; comparisonHref: string; ownerReviewRequired: true };
  durableReviewDecisionExists: false;
};

type WordPressDraft = { id?: number; slug?: string; status?: string; link?: string; modified_gmt?: string; featured_media?: number; title?: { raw?: string; rendered?: string }; content?: { raw?: string; rendered?: string } };
type WordPressMedia = { id?: number; source_url?: string; alt_text?: string; title?: { rendered?: string }; caption?: { rendered?: string }; description?: { rendered?: string } };

function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function stripHtml(value: string): string { return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim(); }
function sanitizePreviewHtml(value: string): string { return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<(?:iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed|form)>/gi, "").replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, "").replace(/javascript:/gi, ""); }
function internalLink(url: string, domain: string | null): boolean { if (url.startsWith("/")) return true; try { const host = new URL(url).hostname.replace(/^www\./, ""); return Boolean(domain && (host === domain.replace(/^www\./, "") || host.endsWith(`.${domain.replace(/^www\./, "")}`))); } catch { return false; } }

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
  localThemingBundle?: LocalPageThemingBundle | null;
  localThemeVisualCertification?: LocalThemeVisualCertification | null;
  marketMatchBundle?: MarketProductMatchBundle | null;
  visualCertification?: { certification: RenderedVisualCertification | null; decision: RenderedVisualOwnerDecision | null; certificationState: "NOT_CERTIFIED" | "CURRENT" | "STALE"; decisionState: "PENDING" | "CURRENT" | "STALE" };
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
  const contextualReady = Boolean(input.job.featuredImagePresent && mediaId);
  const pageRevisionIdentity = `job:${input.job.jobId}:${input.job.updatedAt}`;
  const productAssignment = (input.mediaAssignments ?? []).find((item) => item.pageRevisionId === pageRevisionIdentity && item.role === "PRODUCT_AUTHORITY" && item.slotId === "product-authority" && item.asset.type === "APPROVED_EXISTING") ?? null;
  const issues: ReviewIssue[] = [];
  if (!artifact) issues.push({ category: "CONTENT", severity: "BLOCKED", what: "Generated source artifact is unavailable", effect: "Structured content review cannot be completed.", safeNextStep: "Return to campaign detail and inspect the exact execution." });
  if (Object.keys(qaFailures).length > 0) issues.push({ category: "CONTENT", severity: "BLOCKED", what: "Generated content QA has failures", effect: Object.values(qaFailures).map(String).join(" "), safeNextStep: "Open campaign detail and use an existing governed repair path." });
  if (!wordpressVerified) issues.push({ category: "WORDPRESS", severity: "WARNING", what: "Live WordPress draft could not be fully verified", effect: input.wordpressReadState, safeNextStep: "Use the authenticated WordPress edit link and confirm the exact draft identity." });
  if (!productAssignment) issues.push({ category: "IMAGE", severity: "WARNING", what: "Product authority not wired", effect: "Approved product authority exists, but this legacy page has not been assigned through the multi-role media adapter.", safeNextStep: "Keep the draft unpublished and add the bounded legacy-to-multi-role media adapter." });
  if (!contextualReady) issues.push({ category: "IMAGE", severity: "WARNING", what: "Contextual image unavailable", effect: "No durable featured-media receipt is available for this draft.", safeNextStep: "Review media evidence in campaign detail; do not infer an image assignment." });
  const reviewState = issues.some((issue) => issue.severity === "BLOCKED") ? "BLOCKED" : issues.length > 0 ? "NEEDS_ATTENTION" : "READY_FOR_OWNER_REVIEW";
  const listQuery = `organizationId=${encodeURIComponent(input.campaign.organizationId)}&siteId=${encodeURIComponent(input.campaign.siteId)}`;
  const visualQa = deriveGeneratedPageVisualQaReview(input.visualCertification ?? { certification: null, decision: null, certificationState: "NOT_CERTIFIED", decisionState: "PENDING" });
  const media = [
    mediaExpectationFromAssignments({ role: "PRODUCT_AUTHORITY", requirement: "REQUIRED", slotId: "product-authority", assignments: input.mediaAssignments ?? [], pageRevisionIdentity, authorityAvailable: Boolean(input.productAuthorityReference) }),
    mediaExpectationFromAssignments({ role: "CONTEXTUAL_IN_USE", requirement: "DESIRED", slotId: "contextual-in-use", assignments: input.mediaAssignments ?? [], pageRevisionIdentity, legacy: contextualReady && mediaId ? { mediaId, provenance: "LEGACY_FEATURED" } : null }),
  ];
  const compositionPlan = createRichPageCompositionPlan({ planId: `composition-plan-${input.job.jobId}-${input.job.updatedAt}`, identity: { organizationId: input.job.organizationId, siteId: input.job.siteId, pageId: input.target.targetId, pageRevisionIdentity, canonicalPath: input.target.canonicalPath ?? input.job.slug, jobId: input.job.jobId, wordpressObjectId }, pageType: input.target.pageType ?? input.campaign.pageType, cta: cta ? { label: cta, destination: [...links].reverse().find((link) => link.label === cta)?.url ?? "" } : null, media, decisionSource: "Owner-approved Commercial Stainless evidence adapted through site-neutral Rich Page Composition V1.", evidenceReferences: ["visual-certification-424e2ea8-7efe-4e74-94aa-1d48c9fbbf4e", "visual-certification-11ccbc70-307e-4084-8d3a-7546dcf6bf5a"] });
  const proposedFindings = evaluateRichPageComposition({ plan: compositionPlan, captures: input.visualCertification?.certification?.captures ?? [], duplicateOpeningMedia: null, cardWidths: null, proseWidths: null, headerWidth: null, primaryCtaDistinct: null });
  const localBundle = input.localThemingBundle && input.localThemingBundle.context.identity.pageRevisionIdentity === pageRevisionIdentity ? input.localThemingBundle : null;
  const linkCounts = localBundle?.links.links.reduce<Record<string, number>>((counts, link) => ({ ...counts, [link.role]: (counts[link.role] ?? 0) + 1 }), {}) ?? {};
  const applyState = input.job.jobId === "2ca74016-252b-4587-bf3c-ec9b7eb839c9" ? getDallasApplyState() : null; const applyReceipt=applyState?.receipts.at(-1)??null; const applyComparison=applyState?.comparisons?.at(-1)??null;

  return {
    identity: { title: artifact?.title ?? input.job.title, target: input.target.cityName ? `${input.target.cityName}, ${input.target.stateCode}` : input.target.stateCode, product: input.productName, site: input.siteName, domain: input.domain, campaign: input.campaign.name, campaignId: input.campaign.campaignId, targetId: input.target.targetId, canonicalPath: input.target.canonicalPath ?? input.job.slug, lifecycleState: input.target.status, publicationPolicy: input.campaign.publicationPolicy },
    wordpress: { objectId: wordpressObjectId, status: wordpressStatus, verified: wordpressVerified, titleMatchesSource, contentMatchesSource, readState: input.wordpressReadState, title: wordpressTitle || null, modifiedAt: input.wordpressDraft?.modified_gmt ?? null, editUrl: input.wordpressEditUrl, sourceUrl: input.wordpressDraft?.link ?? input.job.wordpressUrl, previewHtml: liveHtml ? sanitizePreviewHtml(liveHtml) : null },
    source: { html: sanitizePreviewHtml(sourceHtml), excerpt: artifact?.excerpt ?? null, h1: headings.find((heading) => heading.level === 1)?.text ?? null, headings, bodySections, cta, faqPresent: headings.some((heading) => /faq|frequently asked/i.test(heading.text)), internalLinks, rawHtml: sourceHtml },
    seo: { title: artifact?.seoTitle ?? input.job.seoTitle ?? null, titleState: artifact?.seoTitle || input.job.seoTitle ? "PASS" : "WARNING", metaDescription: artifact?.metaDescription ?? input.job.metaDescription ?? null, metaDescriptionState: artifact?.metaDescription || input.job.metaDescription ? "PASS" : "WARNING", canonicalState: (input.target.canonicalPath ?? "") === (artifact?.slug ?? input.job.slug) ? "PASS" : "BLOCKED", redirectState: "NOT_EVALUATED", indexabilityState: wordpressStatus === "draft" ? "PASS" : "WARNING", h1Count, h1State: h1Count === 1 ? "PASS" : "WARNING", developmentUrlLeakState: /(?:localhost|127\.0\.0\.1|\.test)(?:[/:"'])/i.test(sourceHtml) ? "BLOCKED" : "PASS", detail: `${input.job.wordCount ?? 0} words · ${links.length} rendered links` },
    images: {
      productAuthority: { state: productAssignment ? "ASSIGNED" : "NOT_WIRED", imageUrl: productAssignment?.asset.type === "APPROVED_EXISTING" ? productAssignment.asset.url : null, authority: productAssignment ? "Owner-approved canonical product media assigned to this exact page revision." : input.productAuthoritySource ?? "Approved product authority exists outside this legacy page assignment.", provenance: productAssignment?.asset.type === "APPROVED_EXISTING" ? `${productAssignment.asset.authorityReference} · ${productAssignment.asset.sha256}` : input.productAuthorityReference ?? "No target-level PRODUCT_AUTHORITY assignment is exposed.", altText: productAssignment?.metadata.altText ?? null, wordpressMediaId: productAssignment?.asset.type === "APPROVED_EXISTING" && productAssignment.asset.wordpressMediaId ? String(productAssignment.asset.wordpressMediaId) : null, renderedInCurrentWordPress: false },
      contextualInUse: { state: contextualReady ? "LEGACY_FEATURED" : "MISSING", imageUrl: text(input.wordpressMedia?.source_url) || null, authority: mediaAuthority ? `${text(mediaAuthority.selectedProvenance) || "Legacy execution media"}` : "Legacy execution evidence", provenance: mediaId ? `WordPress media #${mediaId}; selected by the legacy execution.` : "No WordPress media receipt persisted.", altText: text(input.wordpressMedia?.alt_text) || null, wordpressMediaId: mediaId || null, grounding: productAuthority?.exactProductMatch === true ? "Legacy exact-product match recorded; PRODUCT_TRUTH role was not persisted." : "PRODUCT_TRUTH grounding not persisted." },
      contractState: "LEGACY_IMAGE_STATE",
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
    reviewState,
    actions: { canonical: input.wordpressEditUrl ? { label: "Open WordPress Draft", href: input.wordpressEditUrl } : null, campaignHref: `/glw/campaigns/${encodeURIComponent(input.campaign.campaignId)}?${listQuery}`, listHref: `/glw/campaigns?${listQuery}`, visualCapture: { endpoint: `/api/glw/pages/${encodeURIComponent(input.job.jobId)}/visual-certification`, organizationId: input.campaign.organizationId, siteId: input.campaign.siteId } },
    visualQa,
    richComposition: { plan: compositionPlan, identityState: "CURRENT", currentRender: { profile: "CONTENT_ARTICLE", certificationState: visualQa.certificationState, overallState: visualQa.overallState }, proposedFindings, safeNextAction: compositionPlan.blockers.includes("PRODUCT_AUTHORITY_NOT_WIRED") ? "Wire the approved PRODUCT_AUTHORITY asset through site-page-media-assignment-v1 before any rich-page generation or WordPress change." : "Review the non-mutating composition preview. WordPress draft and campaign authority remain unchanged.", preview: { state: "PREVIEW_ONLY", title: artifact?.title ?? input.job.title, excerpt: artifact?.excerpt ?? null, bodyHtml: sanitizePreviewHtml(sourceHtml).replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, "").replace(/<img\b[^>]*>/gi, ""), productName: input.productName, productImageUrl: productAssignment?.asset.type === "APPROVED_EXISTING" ? productAssignment.asset.url : null, productAltText: productAssignment?.metadata.altText ?? null, contextualImageUrl: text(input.wordpressMedia?.source_url) || null, contextualAltText: text(input.wordpressMedia?.alt_text) || null, ctaLabel: cta, href: `/glw/pages/${encodeURIComponent(input.job.jobId)}/composition-preview?organizationId=${encodeURIComponent(input.job.organizationId)}&siteId=${encodeURIComponent(input.job.siteId)}` } },
    localizedV2: localBundle ? { state: localBundle.composition.validationState, href: `/glw/pages/${encodeURIComponent(input.job.jobId)}/composition-preview-v2?organizationId=${encodeURIComponent(input.job.organizationId)}&siteId=${encodeURIComponent(input.job.siteId)}`, localizationLevel: localBundle.theme.localizationLevel, contextFacts: localBundle.context.facts.length, applications: localBundle.applications.applications.map((application) => ({ id: application.applicationId, state: application.compatibility })), linkCounts, media: localBundle.media.map((item) => ({ role: item.role, claimClass: item.claimClass, reviewState: item.ownerReviewState })), blockers: localBundle.composition.blockers, claimSafety: { brandAuthorityPrecedence: true, falseProximityClaimsProhibited: true, antiClicheSafeguards: localBundle.theme.safeguards.antiClicheTerms }, visualCertification: input.localThemeVisualCertification ? { certificationId: input.localThemeVisualCertification.certificationId, state: input.localThemeVisualCertification.state, ownerReviewRequired: input.localThemeVisualCertification.ownerReviewRequired, findings: input.localThemeVisualCertification.findings, viewports: input.localThemeVisualCertification.captures.map((capture) => ({ label: capture.viewport, overflow: capture.horizontalOverflow })) } : null, ownerQuestions: ["Does this feel like ProjectorEnclosure?", "Does this feel relevant to Dallas / North Texas?", "Does it avoid Texas cliché?", "Does the product look real and correct?", "Does the in-use scene look credible?", "Does projection mapping communicate a major application?", "Do the links make the page more useful?", "Does anything imply a local office, customer, or actual Dallas installation?"] } : null,
    marketMatch: input.marketMatchBundle ? { href: `/glw/market-opportunities/dallas?organizationId=${encodeURIComponent(input.job.organizationId)}&siteId=${encodeURIComponent(input.job.siteId)}`, previewV3Href: `/glw/pages/${encodeURIComponent(input.job.jobId)}/composition-preview-v3?organizationId=${encodeURIComponent(input.job.organizationId)}&siteId=${encodeURIComponent(input.job.siteId)}`, signalCount: input.marketMatchBundle.intelligence.signals.length, catalogCount: input.marketMatchBundle.catalog.length, ranked: input.marketMatchBundle.opportunities.map((item) => ({ application: item.applicationId, product: item.catalogItemId, confidence: item.confidence })), pageStrategy: { primary: input.marketMatchBundle.pageStrategy.primaryApplication, supporting: input.marketMatchBundle.pageStrategy.supportingApplications, crossSell: input.marketMatchBundle.pageStrategy.crossSellCatalogItemIds, rejected: input.marketMatchBundle.pageStrategy.rejectedAdjacencies.length }, mutationAuthorized: false } : null,
    appliedV3: applyReceipt ? { receiptId: applyReceipt.receiptId, status: applyReceipt.wordpressStatus, beforeHash: applyReceipt.beforeHash, afterHash: applyReceipt.afterHash, decisionId: applyReceipt.decisionId, drift: applyComparison?.drift.classification??null, comparisonHref: `/glw/pages/${encodeURIComponent(input.job.jobId)}/wordpress-comparison?organizationId=${encodeURIComponent(input.job.organizationId)}&siteId=${encodeURIComponent(input.job.siteId)}`, ownerReviewRequired: true } : null,
    durableReviewDecisionExists: false,
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
  const target = listAllGlwCampaignTargets().find((entry) => entry.jobId === job.jobId && entry.organizationId === job.organizationId && entry.siteId === job.siteId) ?? null;
  if (!target) return null;
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
  const currentIdentity: RenderedVisualPageIdentity = { organizationId: job.organizationId, siteId: job.siteId, pageId: target.targetId, pageRevisionIdentity: `job:${job.jobId}:${job.updatedAt}`, canonicalPath: target.canonicalPath ?? job.slug, contentHash: hashRenderedVisualContent(sourceHtml), renderedContentHash: renderedHtml ? hashRenderedVisualContent(renderedHtml) : null, campaignId: campaign.campaignId, targetId: target.targetId, jobId: job.jobId, externalExecutionId: job.externalExecutionId, wordpressObjectId: objectId, wordpressStatus: job.wordpressStatus };
  const visualCertification = getRenderedVisualCertificationState({ currentIdentity });
  const mediaAssignments = listSitePageMediaAssignments({ organizationId: job.organizationId, siteId: job.siteId, buildSessionId: `glw-job:${job.jobId}`, pageRevisionId: currentIdentity.pageRevisionIdentity });
  const localThemingBundle = getLocalPageThemingBundle({ organizationId: job.organizationId, siteId: job.siteId, jobId: job.jobId });
  const localThemeVisualCertification = localThemingBundle ? getLocalThemeVisualCertification(localThemingBundle.bundleId, "localized-rich-preview-v2.1") : null;
  const marketMatchBundle = getMarketProductMatchBundle({ organizationId: job.organizationId, marketId: "market-dallas-north-texas" });
  return deriveGeneratedPageReviewModel({ campaign, target, job, siteName: site.displayName, domain: site.domain, productName: product.displayName, productAuthorityReference: product.media.primaryImageReference, productAuthoritySource: product.authorityProvenance?.sourceType ?? null, knowledgePack: getGlwCampaignKnowledgePack(campaign.campaignId), wordpressDraft, wordpressMedia, wordpressReadState, wordpressEditUrl, mediaAssignments, localThemingBundle, localThemeVisualCertification, marketMatchBundle, visualCertification });
}