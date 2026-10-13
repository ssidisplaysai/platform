import "server-only";

import { createHash } from "node:crypto";
import { load } from "cheerio";
import { evaluateCustomerFacingCopyQuality } from "@/modules/foundation/customer-facing-copy-quality";
import { runGovernedRenderCapture, type CaptureAuthority } from "@/modules/foundation/governed-render-capture-orchestrator";
import type { RenderedVisualCertification } from "@/modules/foundation/rendered-visual-certification";
import type { GenesisWordPressExactStatusTransitionResult } from "@/modules/foundation/wordpress-publish-writer";
import { transitionGenesisWordPressPageStatus } from "@/modules/foundation/wordpress-publish-writer";
import type { SiteConfiguration } from "@/modules/foundation/types";
import {
  consumeExactPublicationRollbackGrant,
  EXACT_WORDPRESS_PUBLICATION,
  EXACT_WORDPRESS_ROLLBACK,
  issueExactPublicationRollbackGrant,
  issueExactPublicationRollbackPreflight,
  recordExactPublicationRollbackReceipt,
  type ExactPublicationRollbackContext,
  type ExactPublicationRollbackGrant,
  type ExactPublicationRollbackPreflight,
} from "./exact-publication-rollback-authority";
import type { GlwTrustedOperatorPrincipal } from "./trusted-operator-principal";
import { evaluateGlwReferenceClaimAuthority } from "./reference-claim-authority";
import { evaluateGlwStateLocalizationContamination } from "./state-localization-contamination";

export type ExactWordPressAuthoritySnapshot = {
  organizationId: string;
  siteId: string;
  campaignId: string;
  productId: string;
  targetId: string;
  stateCode: string;
  wordpressObjectId: string;
  parentObjectId: string;
  slug: string;
  canonicalPath: string;
  status: "draft" | "publish";
  rawPostContent: string;
  title: string;
  featuredMediaId: number;
};

export type ActualPublicHostSafetyEvidence = {
  certification: RenderedVisualCertification;
  canonicalHttpStatus: 200;
  canonicalUrl: string;
  correctH1: true;
  brokenImages: 0;
  clippedHeadings: 0;
  internalGovernanceLanguage: 0;
  previewOrDevLinks: 0;
  unexpectedStateContamination: 0;
  unsupportedFactualRegression: 0;
};

export type ExactPublicationRollbackAdapters = {
  transitionStatus?: typeof transitionGenesisWordPressPageStatus;
  readExactWordPressAuthority: () => Promise<ExactWordPressAuthoritySnapshot>;
  verifyPublicCanonical?: () => Promise<{ status: number; finalUrl: string; canonicalUrl: string | null }>;
  certifyActualPublicHost?: () => Promise<ActualPublicHostSafetyEvidence>;
};

export function storedPostContentSha(rawPostContent: string): string {
  return createHash("sha256").update(rawPostContent.trim()).digest("hex");
}

export function extractExactPublicRichPageClaimContent(html: string): string {
  const $ = load(html);
  const roots = $(".saw-page");
  if (roots.length !== 1) throw new Error("EXACT_PUBLIC_HOST_RICH_PAGE_ROOT_MISMATCH");
  return roots.first().html() ?? "";
}

export async function verifyExactPublicCanonical(input: { context: ExactPublicationRollbackContext; site: SiteConfiguration; fetcher?: typeof fetch }) {
  const expectedUrl = new URL(input.context.canonicalPath, input.site.canonicalUrl).toString();
  const response = await (input.fetcher ?? fetch)(expectedUrl, { redirect: "follow", cache: "no-store", headers: { "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" }, signal: AbortSignal.timeout(30_000) });
  const html = await response.text();
  const $ = load(html);
  return { status: response.status, finalUrl: response.url || expectedUrl, canonicalUrl: $("link[rel=canonical]").first().attr("href")?.trim() ?? null };
}

export async function certifyExactPublicRichReference(input: { context: ExactPublicationRollbackContext; site: SiteConfiguration; principal: GlwTrustedOperatorPrincipal; fetcher?: typeof fetch }): Promise<ActualPublicHostSafetyEvidence> {
  const expectedUrl = new URL(input.context.canonicalPath, input.site.canonicalUrl).toString();
  const response = await (input.fetcher ?? fetch)(expectedUrl, { redirect: "follow", cache: "no-store", headers: { "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" }, signal: AbortSignal.timeout(30_000) });
  if (response.status !== 200) throw new Error("EXACT_PUBLIC_HOST_HTTP_200_REQUIRED");
  const html = await response.text();
  const $ = load(html);
  const canonicalUrl = $("link[rel=canonical]").first().attr("href")?.trim() ?? "";
  const h1 = $("h1").map((_, element) => $(element).text().replace(/\s+/g, " ").trim()).get();
  const links = $("a[href]").map((_, element) => $(element).attr("href") ?? "").get();
  const publicText = $("main").text().replace(/\s+/g, " ").trim();
  const richPageContent = extractExactPublicRichPageClaimContent(html);
  const copy = evaluateCustomerFacingCopyQuality(publicText);
  const contamination = evaluateGlwStateLocalizationContamination({ contentHtml: html, expectedStateCode: input.context.stateCode });
  const artifact = { title: input.context.expectedH1, contentHtml: richPageContent, slug: input.context.canonicalPath, excerpt: null, seoTitle: $("title").text().trim() || null, metaDescription: $("meta[name=description]").attr("content")?.trim() ?? null, focusKeyphrase: null };
  const claims = evaluateGlwReferenceClaimAuthority({ artifact, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
  const mediaAssignments = $("img[src][data-media-role]").map((index, element) => {
    const role = $(element).attr("data-media-role") as "PRODUCT_AUTHORITY" | "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE" | "LOCAL_CONTEXTUAL_ATMOSPHERE";
    return { assignmentId: `public:${input.context.targetId}:${index}`, semanticRole: role, mediaId: $(element).attr("data-media-id") ?? null, sourceUrl: new URL($(element).attr("src")!, expectedUrl).toString(), contextId: input.context.storedPostContentSha };
  }).get();
  const authority: CaptureAuthority = { identity: { organizationId: input.context.organizationId, siteId: input.context.siteId, pageId: `${input.context.targetId}-public`, pageRevisionIdentity: `public:${input.context.wordpressObjectId}:${input.context.storedPostContentSha}`, canonicalPath: input.context.canonicalPath, contentHash: input.context.storedPostContentSha, renderedContentHash: null, campaignId: input.context.campaignId, targetId: input.context.targetId, jobId: null, externalExecutionId: null, wordpressObjectId: input.context.wordpressObjectId, wordpressStatus: "publish" }, targetUrl: expectedUrl, allowedOrigins: [new URL(input.site.canonicalUrl).origin, "https://fonts.googleapis.com", "https://fonts.gstatic.com"], internalGenesisOrigin: null, internalAuthorization: null, layoutClass: "FULL_WIDTH_MARKETING_PAGE", mediaAssignments };
  const capture = await runGovernedRenderCapture({ authority, mode: "FORCE", actor: input.principal.principalId });
  const clippedHeadings = capture.certification.captures.reduce((sum, viewport) => sum + viewport.sections.filter((section) => section.headingBounds && (section.headingBounds.x < section.bounds.x - 1 || section.headingBounds.x + section.headingBounds.width > section.bounds.x + section.bounds.width + 1)).length, 0);
  const brokenImages = capture.certification.captures.reduce((sum, viewport) => sum + viewport.media.filter((media) => !media.rendered).length, 0);
  const previewOrDevLinks = links.filter((href) => /(?:localhost|127\.0\.0\.1|\.test|preview|visual-certification|rich-reference-candidate)/i.test(href)).length;
  return { certification: capture.certification, canonicalHttpStatus: 200, canonicalUrl, correctH1: h1.length === 1 && h1[0] === input.context.expectedH1 ? true : (() => { throw new Error("EXACT_PUBLIC_HOST_H1_MISMATCH"); })(), brokenImages: brokenImages as 0, clippedHeadings: clippedHeadings as 0, internalGovernanceLanguage: copy.internalGovernanceLanguageExposed as 0, previewOrDevLinks: previewOrDevLinks as 0, unexpectedStateContamination: contamination.contaminations.length as 0, unsupportedFactualRegression: claims.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED").length as 0 };
}

function normalizedPath(value: string): string {
  const path = `/${value.trim().replace(/^\/+|\/+$/g, "")}/`;
  return path === "//" ? "/" : path;
}

function exactSnapshotMatches(context: ExactPublicationRollbackContext, snapshot: ExactWordPressAuthoritySnapshot): boolean {
  return snapshot.organizationId === context.organizationId
    && snapshot.siteId === context.siteId
    && snapshot.campaignId === context.campaignId
    && snapshot.productId === context.productId
    && snapshot.targetId === context.targetId
    && snapshot.stateCode === context.stateCode
    && snapshot.wordpressObjectId === context.wordpressObjectId
    && snapshot.parentObjectId === context.parentObjectId
    && snapshot.slug === context.slug
    && normalizedPath(snapshot.canonicalPath) === context.canonicalPath
    && snapshot.status === context.expectedCurrentStatus
    && snapshot.title === context.expectedTitle
    && snapshot.featuredMediaId === context.featuredMediaId
    && storedPostContentSha(snapshot.rawPostContent) === context.storedPostContentSha;
}

export function assertExactPublicationPreflight(input: {
  context: ExactPublicationRollbackContext;
  snapshot: ExactWordPressAuthoritySnapshot;
  draftCertification: RenderedVisualCertification;
}): void {
  if (input.context.operation !== EXACT_WORDPRESS_PUBLICATION) throw new Error("EXACT_PUBLICATION_OPERATION_REQUIRED");
  if (!exactSnapshotMatches(input.context, input.snapshot)) throw new Error("EXACT_PUBLICATION_WORDPRESS_AUTHORITY_MISMATCH");
  const certification = input.draftCertification;
  if (certification.certificationId !== input.context.visualCertificationId
    || certification.overallState !== "PASS"
    || certification.layoutClass !== "FULL_WIDTH_MARKETING_PAGE"
    || certification.identity.organizationId !== input.context.organizationId
    || certification.identity.siteId !== input.context.siteId
    || certification.identity.campaignId !== input.context.campaignId
    || certification.identity.wordpressObjectId !== input.context.wordpressObjectId
    || certification.identity.wordpressStatus !== "draft"
    || normalizedPath(certification.identity.canonicalPath) !== input.context.canonicalPath
    || certification.identity.contentHash !== input.context.storedPostContentSha
    || (certification.identity.targetId !== null && certification.identity.targetId !== input.context.targetId)) {
    throw new Error("EXACT_PUBLICATION_VISUAL_CERTIFICATION_MISMATCH");
  }
  const desktop = certification.captures.find((capture) => capture.viewportClass === "DESKTOP" && capture.viewportWidth === 1440 && capture.viewportHeight === 1000);
  const mobile = certification.captures.find((capture) => capture.viewportClass === "MOBILE" && capture.viewportWidth === 375 && capture.viewportHeight === 812);
  if (!desktop || !mobile) throw new Error("EXACT_PUBLICATION_ACTUAL_HOST_DRAFT_CERTIFICATION_REQUIRED");
}

export function assertExactRollbackPreflight(input: {
  context: ExactPublicationRollbackContext;
  snapshot: ExactWordPressAuthoritySnapshot;
  publicationReceipt: { receiptId: string; wordpressObjectId: string; afterContentSha: string; afterStatus: "publish" | "draft" };
}): void {
  if (input.context.operation !== EXACT_WORDPRESS_ROLLBACK) throw new Error("EXACT_ROLLBACK_OPERATION_REQUIRED");
  if (!exactSnapshotMatches(input.context, input.snapshot)) throw new Error("EXACT_ROLLBACK_WORDPRESS_AUTHORITY_MISMATCH");
  if (input.publicationReceipt.receiptId !== input.context.sourcePublicationReceiptId || input.publicationReceipt.wordpressObjectId !== input.context.wordpressObjectId || input.publicationReceipt.afterStatus !== "publish" || input.publicationReceipt.afterContentSha !== input.context.storedPostContentSha) throw new Error("EXACT_ROLLBACK_PUBLICATION_RECEIPT_MISMATCH");
}

export function issueVerifiedExactOperationPreflight(input: {
  context: ExactPublicationRollbackContext;
  principal: GlwTrustedOperatorPrincipal;
  snapshot: ExactWordPressAuthoritySnapshot;
  draftCertification?: RenderedVisualCertification;
  publicationReceipt?: { receiptId: string; wordpressObjectId: string; afterContentSha: string; afterStatus: "publish" | "draft" };
  now?: Date;
}): ExactPublicationRollbackPreflight {
  if (input.context.operation === EXACT_WORDPRESS_PUBLICATION) {
    if (!input.draftCertification) throw new Error("EXACT_PUBLICATION_VISUAL_CERTIFICATION_REQUIRED");
    assertExactPublicationPreflight({ context: input.context, snapshot: input.snapshot, draftCertification: input.draftCertification });
  } else {
    if (!input.publicationReceipt) throw new Error("EXACT_ROLLBACK_PUBLICATION_RECEIPT_REQUIRED");
    assertExactRollbackPreflight({ context: input.context, snapshot: input.snapshot, publicationReceipt: input.publicationReceipt });
  }
  return issueExactPublicationRollbackPreflight({ context: input.context, principal: input.principal, preflightVerified: true, now: input.now });
}

export function issueVerifiedExactOperationGrant(input: {
  preflightId: string;
  context: ExactPublicationRollbackContext;
  principal: GlwTrustedOperatorPrincipal;
  now?: Date;
}): ExactPublicationRollbackGrant {
  return issueExactPublicationRollbackGrant(input);
}

export function assertActualPublicHostCertification(input: {
  context: ExactPublicationRollbackContext;
  evidence: ActualPublicHostSafetyEvidence;
}): void {
  const { certification } = input.evidence;
  const captures = certification.captures;
  const desktop = captures.find((capture) => capture.viewportClass === "DESKTOP" && capture.viewportWidth === 1440 && capture.viewportHeight === 1000);
  const mobile = captures.find((capture) => capture.viewportClass === "MOBILE" && capture.viewportWidth === 375 && capture.viewportHeight === 812);
  const capturePass = (capture: typeof desktop) => Boolean(capture
    && capture.horizontalOverflow === 0
    && capture.hero.present
    && capture.hero.headingBounds
    && capture.hero.primaryCtaBounds
    && !capture.hostIntegration.headerOverlap
    && !capture.hostIntegration.footerOverlap
    && capture.hostIntegration.blankImageContainers === 0
    && capture.media.every((media) => media.rendered)
    && capture.media.some((media) => (media.semanticRole === "CONTEXTUAL_IN_USE" || media.semanticRole === "APPLICATION_EXPERIENCE") && media.rendered));
  if (certification.certificationId === input.context.visualCertificationId
    || certification.overallState !== "PASS"
    || certification.identity.organizationId !== input.context.organizationId
    || certification.identity.siteId !== input.context.siteId
    || certification.identity.campaignId !== input.context.campaignId
    || certification.identity.targetId !== input.context.targetId
    || certification.identity.wordpressObjectId !== input.context.wordpressObjectId
    || certification.identity.wordpressStatus !== "publish"
    || certification.identity.contentHash !== input.context.storedPostContentSha
    || normalizedPath(certification.identity.canonicalPath) !== input.context.canonicalPath
    || !capturePass(desktop)
    || !capturePass(mobile)
    || input.evidence.canonicalHttpStatus !== 200
    || normalizedPath(new URL(input.evidence.canonicalUrl).pathname) !== input.context.canonicalPath
    || !input.evidence.correctH1
    || input.evidence.brokenImages !== 0
    || input.evidence.clippedHeadings !== 0
    || input.evidence.internalGovernanceLanguage !== 0
    || input.evidence.previewOrDevLinks !== 0
    || input.evidence.unexpectedStateContamination !== 0
    || input.evidence.unsupportedFactualRegression !== 0) {
    throw new Error("EXACT_PUBLIC_HOST_CERTIFICATION_FAILED");
  }
}

export async function executeAuthorizedExactWordPressOperation(input: {
  context: ExactPublicationRollbackContext;
  principal: GlwTrustedOperatorPrincipal;
  preflightId: string;
  grantId: string;
  site: SiteConfiguration;
  adapters: ExactPublicationRollbackAdapters;
  now?: Date;
}) {
  const claim = consumeExactPublicationRollbackGrant({ preflightId: input.preflightId, grantId: input.grantId, context: input.context, principal: input.principal, now: input.now });
  const before = await input.adapters.readExactWordPressAuthority();
  if (!exactSnapshotMatches(input.context, before)) throw new Error("EXACT_OPERATION_BEFORE_READBACK_MISMATCH");
  const transition = input.adapters.transitionStatus ?? transitionGenesisWordPressPageStatus;
  const mutation: GenesisWordPressExactStatusTransitionResult = await transition({ site: input.site, identity: { wordpressObjectId: input.context.wordpressObjectId, parentObjectId: input.context.parentObjectId, slug: input.context.slug, expectedTitle: input.context.expectedTitle, featuredMediaId: input.context.featuredMediaId, storedPostContentSha: input.context.storedPostContentSha }, expectedStatus: input.context.expectedCurrentStatus, intendedStatus: input.context.intendedStatus });
  if (!mutation.ok) throw new Error(`EXACT_OPERATION_WORDPRESS_${mutation.state.toUpperCase()}`);
  const after = await input.adapters.readExactWordPressAuthority();
  const afterContext = { ...input.context, expectedCurrentStatus: input.context.intendedStatus };
  if (!exactSnapshotMatches(afterContext, after)) throw new Error("EXACT_OPERATION_AFTER_READBACK_MISMATCH");

  if (input.context.operation === EXACT_WORDPRESS_ROLLBACK) {
    return recordExactPublicationRollbackReceipt({ context: input.context, principal: input.principal, claimId: claim.claimId, beforeStatus: "publish", afterStatus: "draft", beforeContentSha: storedPostContentSha(before.rawPostContent), afterContentSha: storedPostContentSha(after.rawPostContent), publicCanonicalHttpStatus: null, publicCertificationId: null, lifecycleState: "ROLLED_BACK", mutationPerformed: true, now: input.now });
  }

  let publicHttpStatus: number | null = null;
  try {
    if (!input.adapters.verifyPublicCanonical || !input.adapters.certifyActualPublicHost) throw new Error("EXACT_PUBLICATION_PUBLIC_CERTIFICATION_ADAPTER_REQUIRED");
    const canonical = await input.adapters.verifyPublicCanonical();
    publicHttpStatus = canonical.status;
    const expectedUrl = new URL(input.context.canonicalPath, input.site.canonicalUrl).toString();
    if (canonical.status !== 200 || canonical.finalUrl !== expectedUrl || canonical.canonicalUrl !== expectedUrl) throw new Error("EXACT_PUBLICATION_CANONICAL_HTTP_VERIFICATION_FAILED");
    const evidence = await input.adapters.certifyActualPublicHost();
    assertActualPublicHostCertification({ context: input.context, evidence });
    return recordExactPublicationRollbackReceipt({ context: input.context, principal: input.principal, claimId: claim.claimId, beforeStatus: "draft", afterStatus: "publish", beforeContentSha: storedPostContentSha(before.rawPostContent), afterContentSha: storedPostContentSha(after.rawPostContent), publicCanonicalHttpStatus: 200, publicCertificationId: evidence.certification.certificationId, lifecycleState: "PUBLIC_CERTIFIED", mutationPerformed: true, now: input.now });
  } catch (error) {
    recordExactPublicationRollbackReceipt({ context: input.context, principal: input.principal, claimId: claim.claimId, beforeStatus: "draft", afterStatus: "publish", beforeContentSha: storedPostContentSha(before.rawPostContent), afterContentSha: storedPostContentSha(after.rawPostContent), publicCanonicalHttpStatus: publicHttpStatus, publicCertificationId: null, lifecycleState: "PUBLIC_CERTIFICATION_FAILED", mutationPerformed: true, now: input.now });
    throw error;
  }
}
