import { createHash } from "node:crypto";

import type { GlwCampaignTarget } from "./campaign-target-repository";
import type {
  DallasActualVisualCertification,
  DallasApplyReceipt,
  DallasPreviewWordPressComparison,
} from "./dallas-rich-composition-apply";
import type { DallasThemeCertification, DallasThemeRepairReceipt } from "./dallas-public-theme-integration";

export const DALLAS_REFERENCE_PAGE_PUBLICATION_CONTRACT = "dallas-reference-page-certify-and-publish-v1" as const;
export const DALLAS_REFERENCE_PAGE_REPUBLICATION_CONTRACT = "dallas-reference-page-republish-after-theme-repair-v1" as const;
export const DALLAS_CAMPAIGN_ID = "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-texas-cities" as const;
export const DALLAS_TARGET_ID = `${DALLAS_CAMPAIGN_ID.replace(/^campaign-/, "target-campaign-")}-tx-dallas` as const;
export const DALLAS_JOB_ID = "2ca74016-252b-4587-bf3c-ec9b7eb839c9" as const;
export const DALLAS_WORDPRESS_OBJECT_ID = "13084" as const;
export const DALLAS_APPROVED_CONTENT_HASH = "77df4b25869341cadbce741bf0932e6abe7f97728b1e9207e66a5306f8c9200b" as const;
export const DALLAS_CANONICAL_PATH = "fan-cooled-projector-enclosures/texas/dallas" as const;
export const DALLAS_THEME_REPAIR_COMMIT = "92a88872998ed697edad8975068f1c3a30fd43fe" as const;

export type DallasThemePublicationIdentity = {
  repairCommit: typeof DALLAS_THEME_REPAIR_COMMIT;
  repairReceiptId: string;
  certificationId: string;
  certificationHash: string;
  ownerReviewArtifact: string;
  template: "elementor_header_footer";
  hideTitle: "yes";
  themeIntegrationReady: true;
  drift: "NONE" | "MINOR";
};

export type DallasPublicationIdentity = {
  organizationId: "ssi";
  siteId: "site-ssi-projectorenclosure";
  campaignId: typeof DALLAS_CAMPAIGN_ID;
  targetId: typeof DALLAS_TARGET_ID;
  jobId: typeof DALLAS_JOB_ID;
  externalExecutionId: "579510";
  wordpressObjectId: typeof DALLAS_WORDPRESS_OBJECT_ID;
  parentId: 13083;
  title: "Fan Cooled Projector Enclosures in Dallas";
  slug: "dallas";
  canonicalPath: typeof DALLAS_CANONICAL_PATH;
  contentHash: typeof DALLAS_APPROVED_CONTENT_HASH;
  seoHash: string;
  featuredMediaId: 10757;
  semanticMediaHash: string;
  semanticMediaRoles: readonly string[];
  compositionIdentity: DallasApplyReceipt["exactIdentity"];
  localContextId: string;
  localThemeProfileId: string;
  applicationAuthorityId: string;
  marketStrategyHash: string;
  localLinkGraphId: string;
  actualVisualCertificationId: string;
  actualVisualCertificationHash: string;
  previewWordPressComparisonId: string;
  previewWordPressDrift: "NONE" | "MINOR";
  themeIntegration: DallasThemePublicationIdentity;
};

export type DallasPublicationReadiness = {
  CONTENT_READY: boolean;
  SEO_READY: boolean;
  MEDIA_READY: boolean;
  LINKS_READY: boolean;
  VISUAL_READY: boolean;
  CLAIM_SAFE: boolean;
  RESPONSIVE_READY: boolean;
  THEME_INTEGRATION_READY: boolean;
  OWNER_APPROVED: boolean;
  PUBLICATION_READY: boolean;
  PUBLICATION_APPROVED: boolean;
  failures: readonly string[];
};

export type DallasPublicationApproval = { approvalId: string; decision: "APPROVED_FOR_PUBLICATION" | "APPROVED_FOR_REPUBLICATION_AFTER_THEME_REPAIR"; ownerStatement: "approved"; source: "OWNER_ACTUAL_WORDPRESS_COMPARISON_REVIEW" | "OWNER_REPAIRED_THEME_INTEGRATION_REVIEW"; identity: DallasPublicationIdentity; approvedAt: string };
export type DallasPublicationIntent = { intentId: string; contract: typeof DALLAS_REFERENCE_PAGE_PUBLICATION_CONTRACT | typeof DALLAS_REFERENCE_PAGE_REPUBLICATION_CONTRACT; approvalId: string; identity: DallasPublicationIdentity; expectedPublicUrl: string; rollbackArtifactId: string; createdAt: string; state: "READY" | "CONSUMED" };
export type DallasWordPressPublicationReceipt = { publicationReceiptId: string; intentId: string; approvalId: string; wordpressObjectId: typeof DALLAS_WORDPRESS_OBJECT_ID; beforeStatus: "draft"; afterStatus: "publish"; contentHash: typeof DALLAS_APPROVED_CONTENT_HASH; seoHash: string; publicUrl: string; mutationPerformed: boolean; verifiedAt: string };
export type DallasPublicLinkResult = { url: string; classification: "INTERNAL_DIRECT" | "INTERNAL_REDIRECT" | "INTERNAL_BROKEN" | "EXTERNAL_VERIFIED" | "EXTERNAL_UNAVAILABLE"; status: number; finalUrl: string | null };
export type DallasPublicCapture = { captureId: string; viewport: "DESKTOP_1440" | "DESKTOP_1024" | "TABLET_768" | "MOBILE_375"; width: number; height: number; documentWidth: number; documentHeight: number; horizontalOverflow: number; renderedContentHash: string; mediaRolesRendered: readonly string[]; themeIntegration: { visibleH1Count: number; visibleH1Texts: readonly string[]; duplicateThemeTitleVisible: boolean; duplicateThemeFeaturedMediaVisible: boolean; globalHeaderPresent: boolean; globalFooterPresent: boolean; fontAuthorityExpected: boolean; headerActionsContained: boolean; quoteCtaContained: boolean }; artifact: { reference: string; sha256: string; bytes: number; width: number; height: number }; capturedAt: string };
export type DallasPublicVisualCertification = { certificationId: string; publicationReceiptId: string; publicUrl: string; captures: readonly DallasPublicCapture[]; findings: readonly { code: string; state: "PASS" | "WARNING" | "FAIL"; summary: string }[]; overallState: "PASS" | "WARNING" | "FAIL"; createdAt: string };
export type DallasPublicVerification = { verificationId: string; publicationReceiptId: string; requestedUrl: string; finalUrl: string; redirectChain: readonly string[]; httpStatus: number; https: boolean; canonical: string; title: string; metaDescription: string; indexability: "INDEXABLE" | "NOINDEX" | "UNKNOWN"; h1Count: number; semanticMediaRoles: readonly string[]; mediaLoaded: readonly { role: string; url: string; status: number; sha256: string | null }[]; links: readonly DallasPublicLinkResult[]; contentHash: string; seoHash: string; featuredMediaId: number; claimSafe: boolean; devLeak: boolean; verifiedAt: string };
export type DallasDraftPublicComparison = { comparisonId: string; publicationReceiptId: string; publicVerificationId: string; publicVisualCertificationId: string; classification: "NONE" | "MINOR" | "MATERIAL" | "CRITICAL"; reasons: readonly string[]; createdAt: string };
export type DallasCampaignReconciliationReceipt = { reconciliationReceiptId: string; publicationReceiptId: string; campaignId: typeof DALLAS_CAMPAIGN_ID; targetId: typeof DALLAS_TARGET_ID; jobId: typeof DALLAS_JOB_ID; beforeState: "draft_ready"; afterState: "published"; dispatchPerformed: false; newExecutionCreated: false; newDispatchDateCreated: false; reconciledAt: string };
export type DallasReferencePageCertification = { certificationId: string; contract: "GENESIS_REFERENCE_PAGE_V1"; state: "CERTIFIED"; identity: DallasPublicationIdentity; publicUrl: string; publicationReceiptId: string; publicVerificationId: string; publicVisualCertificationId: string; ownerApprovalId: string; reconciliationReceiptId: string; reusableRules: readonly string[]; dallasSpecificExpressions: readonly string[]; createdAt: string };
export type DallasReferencePageRevocation = { revocationId: string; certificationId: string; reason: "PUBLIC_VISIBLE_DUPLICATE_H1_AND_THEME_OVERFLOW"; wordpressRestoredToDraft: true; campaignRestoredToDraftReady: true; executionRestoredToDraft: true; revokedAt: string };
export type DallasPublicationAuditEvent = { eventId: string; action: "OWNER_PUBLICATION_APPROVED" | "PUBLICATION_INTENT_CREATED" | "WORDPRESS_PUBLISHED" | "POST_PUBLISH_READBACK_VERIFIED" | "PUBLIC_VERIFIED" | "PUBLIC_VISUAL_CERTIFIED" | "PUBLIC_DRIFT_EVALUATED" | "CAMPAIGN_RECONCILED" | "REFERENCE_CERTIFIED" | "PUBLICATION_ROLLED_BACK" | "REFERENCE_REVOKED"; at: string; detail: Record<string, string | number | boolean | null> };

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const REQUIRED_ROLES = ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"] as const;

export function selectExactDallasPublicationTarget(targets: readonly GlwCampaignTarget[]): GlwCampaignTarget {
  const target = targets.find((item) => item.targetId === DALLAS_TARGET_ID);
  if (!target || target.campaignId !== DALLAS_CAMPAIGN_ID || target.organizationId !== "ssi" || target.siteId !== "site-ssi-projectorenclosure" || target.stateCode !== "TX" || target.citySlug !== "dallas" || target.status !== "draft_ready" || target.jobId !== DALLAS_JOB_ID || target.wordpressObjectId !== DALLAS_WORDPRESS_OBJECT_ID) {
    throw new Error("DALLAS_PUBLICATION_TARGET_IDENTITY_STALE");
  }
  return target;
}

export function freezeDallasPublicationIdentity(input: {
  receipt: DallasApplyReceipt;
  certification: DallasActualVisualCertification;
  comparison: DallasPreviewWordPressComparison;
  themeReceipt: DallasThemeRepairReceipt;
  themeCertification: DallasThemeCertification;
  repairCommit: string;
  ownerReviewArtifact: string;
  readback: {
    organizationId: string;
    siteId: string;
    wordpressObjectId: string;
    status: string;
    parent: number;
    title: string;
    slug: string;
    contentHash: string;
    seoHash: string;
    featuredMediaId: number;
    semanticMediaRoles: readonly string[];
  };
}): DallasPublicationIdentity {
  const { receipt, certification, comparison, themeReceipt, themeCertification, readback } = input;
  const roles = [...new Set(readback.semanticMediaRoles)].sort();
  const expectedRoles = [...REQUIRED_ROLES].sort();
  if (
    readback.organizationId !== "ssi"
    || readback.siteId !== "site-ssi-projectorenclosure"
    || readback.wordpressObjectId !== DALLAS_WORDPRESS_OBJECT_ID
    || readback.status !== "draft"
    || readback.parent !== 13083
    || readback.title !== "Fan Cooled Projector Enclosures in Dallas"
    || readback.slug !== "dallas"
    || readback.contentHash !== DALLAS_APPROVED_CONTENT_HASH
    || readback.seoHash !== "01adf755d77249323a55cb652671cda7f6e38431feda5d1e1267c00fbdad2f71"
    || readback.featuredMediaId !== 10757
    || JSON.stringify(roles) !== JSON.stringify(expectedRoles)
    || receipt.afterHash !== readback.contentHash
    || receipt.wordpressObjectId !== DALLAS_WORDPRESS_OBJECT_ID
    || receipt.wordpressStatus !== "draft"
    || receipt.exactIdentity.campaignId !== DALLAS_CAMPAIGN_ID
    || receipt.exactIdentity.targetId !== DALLAS_TARGET_ID
    || receipt.exactIdentity.jobId !== DALLAS_JOB_ID
    || receipt.exactIdentity.wordpressObjectId !== DALLAS_WORDPRESS_OBJECT_ID
    || certification.receiptId !== receipt.receiptId
    || certification.wordpressObjectId !== DALLAS_WORDPRESS_OBJECT_ID
    || certification.contentHash !== readback.contentHash
    || certification.overallState !== "PASS"
    || comparison.receiptId !== receipt.receiptId
    || comparison.actualCertificationId !== certification.certificationId
    || (comparison.drift.classification !== "NONE" && comparison.drift.classification !== "MINOR")
    || input.repairCommit !== DALLAS_THEME_REPAIR_COMMIT
    || themeReceipt.wordpressObjectId !== DALLAS_WORDPRESS_OBJECT_ID
    || themeReceipt.afterTemplate !== "elementor_header_footer"
    || themeReceipt.afterPageSettings.hide_title !== "yes"
    || themeReceipt.bodyHashAfter !== readback.contentHash
    || themeReceipt.seoHashAfter !== readback.seoHash
    || themeReceipt.featuredMediaAfter !== 10757
    || themeCertification.receiptId !== themeReceipt.receiptId
    || !themeCertification.themeIntegrationReady
    || themeCertification.overallState !== "PASS"
    || (themeCertification.drift !== "NONE" && themeCertification.drift !== "MINOR")
    || themeCertification.captures.length !== 4
    || themeCertification.captures.some((capture) => capture.horizontalOverflow !== 0 || capture.themeIntegration.visibleH1Count !== 1 || capture.themeIntegration.duplicateThemeTitleVisible || capture.themeIntegration.duplicateThemeFeaturedMediaVisible)
    || !input.ownerReviewArtifact
  ) {
    throw new Error("DALLAS_PUBLICATION_APPROVAL_IDENTITY_STALE");
  }

  return {
    organizationId: "ssi",
    siteId: "site-ssi-projectorenclosure",
    campaignId: DALLAS_CAMPAIGN_ID,
    targetId: DALLAS_TARGET_ID,
    jobId: DALLAS_JOB_ID,
    externalExecutionId: "579510",
    wordpressObjectId: DALLAS_WORDPRESS_OBJECT_ID,
    parentId: 13083,
    title: "Fan Cooled Projector Enclosures in Dallas",
    slug: "dallas",
    canonicalPath: DALLAS_CANONICAL_PATH,
    contentHash: DALLAS_APPROVED_CONTENT_HASH,
    seoHash: readback.seoHash,
    featuredMediaId: 10757,
    semanticMediaHash: receipt.exactIdentity.semanticMediaHash,
    semanticMediaRoles: REQUIRED_ROLES,
    compositionIdentity: receipt.exactIdentity,
    localContextId: receipt.exactIdentity.localContextId,
    localThemeProfileId: receipt.exactIdentity.localThemeProfileId,
    applicationAuthorityId: receipt.exactIdentity.applicationAuthorityId,
    marketStrategyHash: receipt.exactIdentity.pageStrategyHash,
    localLinkGraphId: receipt.exactIdentity.localLinkGraphId,
    actualVisualCertificationId: certification.certificationId,
    actualVisualCertificationHash: hash(certification),
    previewWordPressComparisonId: comparison.comparisonId,
    previewWordPressDrift: comparison.drift.classification,
    themeIntegration: {
      repairCommit: DALLAS_THEME_REPAIR_COMMIT,
      repairReceiptId: themeReceipt.receiptId,
      certificationId: themeCertification.certificationId,
      certificationHash: hash(themeCertification),
      ownerReviewArtifact: input.ownerReviewArtifact,
      template: "elementor_header_footer",
      hideTitle: "yes",
      themeIntegrationReady: true,
      drift: themeCertification.drift,
    },
  };
}

export function evaluateDallasPublicationReadiness(input: {
  html: string;
  identity: DallasPublicationIdentity;
  h1Count: number;
  linksValid: boolean;
  mediaValid: boolean;
  responsiveValid: boolean;
  themeIntegrationReady: boolean;
  publicationApproved: boolean;
}): DallasPublicationReadiness {
  const devLeak = /(?:localhost|127\.0\.0\.1|:(?:3001|3002|3003)\b|\/glw\/|composition-preview|staging)/i.test(input.html);
  const unsupportedClaim = /(?:our|the) Dallas (?:office|staff|team)|Dallas (?:customer|installation|project|venue) (?:uses|using|completed by)/i.test(input.html);
  const contentReady = input.identity.contentHash === DALLAS_APPROVED_CONTENT_HASH && input.h1Count === 1 && !devLeak;
  const gates = {
    CONTENT_READY: contentReady,
    SEO_READY: /^[a-f0-9]{64}$/.test(input.identity.seoHash),
    MEDIA_READY: input.mediaValid && input.identity.semanticMediaRoles.length === 4,
    LINKS_READY: input.linksValid && !devLeak,
    VISUAL_READY: Boolean(input.identity.actualVisualCertificationId),
    CLAIM_SAFE: !unsupportedClaim,
    RESPONSIVE_READY: input.responsiveValid,
    THEME_INTEGRATION_READY: input.themeIntegrationReady && input.identity.themeIntegration.themeIntegrationReady,
    OWNER_APPROVED: input.publicationApproved,
    PUBLICATION_APPROVED: input.publicationApproved,
  };
  const checks = { ...gates, PUBLICATION_READY: Object.values(gates).every(Boolean) };
  return {
    ...checks,
    failures: Object.entries(checks).filter(([, ready]) => !ready).map(([name]) => name),
  };
}

export function evaluateDallasPublicEvidence(input: { expectedUrl: string; finalUrl: string; status: number; canonical: string; title: string; expectedTitle: string; indexability: "INDEXABLE" | "NOINDEX" | "UNKNOWN"; h1Count: number; roles: readonly string[]; links: readonly DallasPublicLinkResult[]; devLeak: boolean; claimSafe: boolean; mediaValid: boolean }) {
  const normalized = (value: string) => { try { const url = new URL(value); url.hash = ""; return url.toString(); } catch { return "INVALID"; } };
  const checks = { HTTPS: input.finalUrl.startsWith("https://"), HTTP_200: input.status === 200, FINAL_URL: normalized(input.finalUrl) === normalized(input.expectedUrl), CANONICAL: normalized(input.canonical) === normalized(input.expectedUrl), TITLE: input.title.includes(input.expectedTitle), INDEXABILITY: input.indexability === "INDEXABLE", H1: input.h1Count === 1, SEMANTIC_MEDIA: REQUIRED_ROLES.every((role) => input.roles.includes(role)), MEDIA_LOAD: input.mediaValid, INTERNAL_LINKS: !input.links.some((item) => item.classification === "INTERNAL_BROKEN"), DEV_LEAK: !input.devLeak, CLAIM_SAFE: input.claimSafe };
  return { ...checks, failures: Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => name) };
}

export function evaluateDallasDraftPublicDrift(input: { approvedContentHash: string; postPublishContentHash: string; expectedRoles: readonly string[]; publicRoles: readonly string[]; expectedLinks: readonly string[]; publicLinks: readonly string[]; publicHtml: string }): { classification: "NONE" | "MINOR" | "MATERIAL" | "CRITICAL"; reasons: readonly string[] } {
  const rolesMatch = input.expectedRoles.every((role) => input.publicRoles.includes(role)); const linksMatch = [...new Set(input.expectedLinks)].every((link) => input.publicLinks.includes(link)); const ctasMatch = /Request project review/i.test(input.publicHtml) && /Discuss your project/i.test(input.publicHtml); const applicationMatch = /Projection mapping/i.test(input.publicHtml); const localMatch = /Dallas|North Texas/i.test(input.publicHtml);
  if (input.approvedContentHash !== input.postPublishContentHash || !rolesMatch) return { classification: "CRITICAL", reasons: [input.approvedContentHash !== input.postPublishContentHash ? "APPROVED_CONTENT_CHANGED" : "SEMANTIC_MEDIA_CHANGED"] };
  const reasons = [...(linksMatch ? [] : ["LINK_GRAPH_CHANGED"]), ...(ctasMatch ? [] : ["CTA_HIERARCHY_CHANGED"]), ...(applicationMatch ? [] : ["APPLICATION_EMPHASIS_CHANGED"]), ...(localMatch ? [] : ["LOCALIZATION_CHANGED"])];
  return reasons.length ? { classification: "MATERIAL", reasons } : { classification: "MINOR", reasons: ["NORMAL_PUBLIC_WORDPRESS_THEME_CHROME"] };
}