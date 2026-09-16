import * as cheerio from "cheerio";
import { LOCALIZED_COMPOSITION_PLAN_CONTRACT, type LocalizedCompositionPlanV2 } from "@/modules/foundation/local-context-page-theming";
import { evaluateSitePageImagePackage, type SitePageMediaAssignment, type SitePageMediaRole } from "@/modules/foundation/site-page-media-assignment";
import { RENDERED_VISUAL_CERTIFICATION_CONTRACT, type RenderedVisualCertification } from "@/modules/foundation/rendered-visual-certification";
import type { GlwGeneratedDraftArtifact } from "./page-execution";
import { evaluateGlwReferenceOwnerReviewReadiness } from "./reference-owner-review-readiness";

export const GLW_RICH_REFERENCE_COMPOSITION_VERSION = "GLW_RICH_REFERENCE_COMPOSITION_V1" as const;
export const GLW_COMPARISON_AUTHORITY_VERSION = "GLW_COMPARISON_AUTHORITY_V1" as const;

export const GLW_RICH_REFERENCE_SECTION_ROLES = [
  "HERO",
  "PRODUCT_IDENTITY",
  "LOCALIZED_INTRODUCTION",
  "APPLICATIONS",
  "PRODUCT_OR_EVALUATION",
  "PLANNING_GUIDANCE",
  "VISUAL_APPLICATION",
  "CTA",
] as const;
export type GlwRichReferenceSectionRole = typeof GLW_RICH_REFERENCE_SECTION_ROLES[number];

export const GLW_RICH_REFERENCE_COMPOSITION_CONTRACT = {
  version: GLW_RICH_REFERENCE_COMPOSITION_VERSION,
  reusedContracts: {
    compositionPlan: LOCALIZED_COMPOSITION_PLAN_CONTRACT,
    mediaAssignment: "site-page-media-assignment-v1",
    visualCertification: RENDERED_VISUAL_CERTIFICATION_CONTRACT,
  },
  articleHtmlIsSemanticInputOnly: true,
  silentArticleFallbackAllowed: false,
  sections: {
    HERO: { contentAuthority: "SEMANTIC_CONTENT", claimAuthority: "CLAIM_QA", mediaAuthority: ["PRODUCT_AUTHORITY", "LOCAL_CONTEXTUAL_ATMOSPHERE"], required: true, fallback: "BLOCK_IF_NO_GROUNDED_HERO" },
    PRODUCT_IDENTITY: { contentAuthority: "PRODUCT_IDENTITY", claimAuthority: "MAPPED_PRODUCT_FACTS_ONLY", mediaAuthority: ["PRODUCT_AUTHORITY"], required: true, fallback: "BLOCK_IF_PRODUCT_MEDIA_REQUIRED_BUT_MISSING" },
    LOCALIZED_INTRODUCTION: { contentAuthority: "LOCAL_CONTEXT", claimAuthority: "LOCAL_AUTHORITY_OR_NEUTRAL_PLANNING", mediaAuthority: [], required: true, fallback: "AUTHORITY_NEUTRAL_COPY" },
    APPLICATIONS: { contentAuthority: "APPLICATION_AUTHORITY", claimAuthority: "SUPPORTED_OR_CONCEPTUAL", mediaAuthority: ["APPLICATION_EXPERIENCE"], required: true, fallback: "CONCEPTUAL_COPY_WITHOUT_PRODUCT_CAPABILITY" },
    PRODUCT_OR_EVALUATION: { contentAuthority: "PRODUCT_OR_COMPARISON_AUTHORITY", claimAuthority: "CELL_LEVEL_AUTHORITY", mediaAuthority: ["PRODUCT_AUTHORITY"], required: true, fallback: "EVALUATION_FRAMEWORK" },
    PLANNING_GUIDANCE: { contentAuthority: "BUYER_GUIDANCE", claimAuthority: "AUTHORITY_NEUTRAL_QUESTIONS", mediaAuthority: [], required: true, fallback: "BLOCK_PREMISE_SMUGGLING" },
    VISUAL_APPLICATION: { contentAuthority: "APPLICATION_AUTHORITY", claimAuthority: "SUPPORTED_OR_CONCEPTUAL", mediaAuthority: ["CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE"], required: true, fallback: "BLOCK_IF_REQUIRED_MEDIA_MISSING" },
    CTA: { contentAuthority: "SITE_CONVERSION_AUTHORITY", claimAuthority: "NO_UNVERIFIED_SERVICE_PROMISE", mediaAuthority: [], required: true, fallback: "CONTACT_FOR_CONFIRMATION" },
  },
} as const;

export type GlwComparisonAuthority = {
  mode: "FACTUAL_COMPARISON" | "EVALUATION_FRAMEWORK";
  authorizedCellTexts: readonly string[];
};

export type GlwRichReferenceReadinessInput = {
  artifact: GlwGeneratedDraftArtifact;
  compositionPlan: LocalizedCompositionPlanV2 | null;
  mediaAssignments: readonly SitePageMediaAssignment[];
  pageRevisionId: string;
  approvedProductMediaAvailable: boolean;
  comparisonAuthority: GlwComparisonAuthority;
  visualCertification: RenderedVisualCertification | null;
};

export type GlwRichReferenceReadiness = {
  contractVersion: typeof GLW_RICH_REFERENCE_COMPOSITION_VERSION;
  ready: boolean;
  state: "READY_FOR_OWNER_REVIEW" | "REFERENCE_COMPOSITION_BLOCKED";
  articleHtmlFinalPresentationAuthority: false;
  existingCompositionReused: true;
  sectionRoles: Readonly<Record<GlwRichReferenceSectionRole, boolean>>;
  mediaRoles: Readonly<Record<SitePageMediaRole, boolean>>;
  comparison: { version: typeof GLW_COMPARISON_AUTHORITY_VERSION; state: "PASS" | "BLOCKED"; mode: GlwComparisonAuthority["mode"]; unauthorizedCells: readonly string[] };
  copyQuality: ReturnType<typeof evaluateGlwReferenceOwnerReviewReadiness>["copyQuality"];
  blockers: readonly string[];
};

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function comparisonReadiness($: cheerio.CheerioAPI, authority: GlwComparisonAuthority): GlwRichReferenceReadiness["comparison"] {
  const cells = $("table td").map((_, cell) => $(cell).text().replace(/\s+/g, " ").trim()).get().filter(Boolean);
  if (!cells.length) return { version: GLW_COMPARISON_AUTHORITY_VERSION, state: "PASS", mode: authority.mode, unauthorizedCells: [] };
  if (authority.mode === "EVALUATION_FRAMEWORK") {
    const unsafe = cells.filter((cell) => !/\?$/.test(cell) && !/^(?:Category|Question|What to compare|Buyer evaluation)$/i.test(cell));
    return { version: GLW_COMPARISON_AUTHORITY_VERSION, state: unsafe.length ? "BLOCKED" : "PASS", mode: authority.mode, unauthorizedCells: unsafe };
  }
  const authorized = new Set(authority.authorizedCellTexts.map(normalize));
  const unauthorizedCells = cells.filter((cell) => !authorized.has(normalize(cell)));
  return { version: GLW_COMPARISON_AUTHORITY_VERSION, state: unauthorizedCells.length ? "BLOCKED" : "PASS", mode: authority.mode, unauthorizedCells };
}

export function evaluateGlwRichReferenceReadiness(input: GlwRichReferenceReadinessInput): GlwRichReferenceReadiness {
  const $ = cheerio.load(input.artifact.contentHtml, null, false);
  const sectionRoles = Object.fromEntries(GLW_RICH_REFERENCE_SECTION_ROLES.map((role) => [role, $(`[data-reference-section="${role}"]`).length > 0])) as Record<GlwRichReferenceSectionRole, boolean>;
  const mediaRoles = Object.fromEntries((["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"] as SitePageMediaRole[]).map((role) => [role, input.mediaAssignments.some((assignment) => assignment.pageRevisionId === input.pageRevisionId && assignment.role === role)])) as Record<SitePageMediaRole, boolean>;
  const imagePackage = evaluateSitePageImagePackage({ assignments: input.mediaAssignments, pageRevisionId: input.pageRevisionId, approvedProductImageAvailable: input.approvedProductMediaAvailable, contextualPolicy: "REQUIRED" });
  const currentAssignments = input.mediaAssignments.filter((assignment) => assignment.pageRevisionId === input.pageRevisionId);
  const invalidProductMedia = currentAssignments.some((assignment) => assignment.role === "PRODUCT_AUTHORITY"
    && (assignment.asset.type !== "APPROVED_EXISTING"
      || !assignment.asset.productId
      || !assignment.asset.authorityReference.startsWith("wordpress-media:")));
  const ungroundedContextualMedia = currentAssignments.some((assignment) =>
    (assignment.role === "CONTEXTUAL_IN_USE" || assignment.role === "APPLICATION_EXPERIENCE")
    && assignment.asset.type === "GENERATED"
    && !assignment.asset.referenceInputs.some((reference) => reference.role === "PRODUCT_TRUTH"));
  const comparison = comparisonReadiness($, input.comparisonAuthority);
  const ownerReview = evaluateGlwReferenceOwnerReviewReadiness({
    artifact: input.artifact,
    media: {
      productAuthorityMediaAvailable: input.approvedProductMediaAvailable,
      productAuthorityMediaCount: mediaRoles.PRODUCT_AUTHORITY ? 1 : 0,
      contextualMediaCount: mediaRoles.CONTEXTUAL_IN_USE ? 1 : 0,
      applicationMediaCount: mediaRoles.APPLICATION_EXPERIENCE ? 1 : 0,
      localContextualMediaCount: mediaRoles.LOCAL_CONTEXTUAL_ATMOSPHERE ? 1 : 0,
      featuredMediaId: imagePackage.productAuthorityImage?.wordpressReceipt?.mediaId ?? null,
    },
    actualHostVisualCertified: input.visualCertification?.overallState === "PASS",
    authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] },
  });
  const compositionPlanReady = input.compositionPlan?.contract === LOCALIZED_COMPOSITION_PLAN_CONTRACT
    && input.compositionPlan.validationState === "READY_FOR_OWNER_REVIEW"
    && input.compositionPlan.wordpressMutationAuthorized === false;
  const visualReady = input.visualCertification?.contract === RENDERED_VISUAL_CERTIFICATION_CONTRACT
    && input.visualCertification.overallState === "PASS"
    && input.visualCertification.layoutClass === "FULL_WIDTH_MARKETING_PAGE";
  const blockers = [
    ...(!compositionPlanReady ? ["LOCALIZED_COMPOSITION_PLAN_REQUIRED"] : []),
    ...Object.entries(sectionRoles).filter(([, ready]) => !ready).map(([role]) => `SECTION_${role}_REQUIRED`),
    ...imagePackage.blockers,
    ...(invalidProductMedia ? ["PRODUCT_AUTHORITY_MEDIA_UNVERIFIED"] : []),
    ...(ungroundedContextualMedia ? ["CONTEXTUAL_MEDIA_PRODUCT_TRUTH_REQUIRED"] : []),
    ...(!mediaRoles.APPLICATION_EXPERIENCE ? ["APPLICATION_EXPERIENCE_MEDIA_REQUIRED"] : []),
    ...(comparison.state === "BLOCKED" ? ["COMPARISON_AUTHORITY_REQUIRED"] : []),
    ...(!ownerReview.copyQuality.ok ? ["CANONICALIZATION_COPY_QUALITY"] : []),
    ...(!ownerReview.semantic.ok ? ["CLAIM_AUTHORITY"] : []),
    ...(!visualReady ? ["RENDERED_VISUAL_CERTIFICATION_REQUIRED"] : []),
  ];
  return {
    contractVersion: GLW_RICH_REFERENCE_COMPOSITION_VERSION,
    ready: blockers.length === 0,
    state: blockers.length ? "REFERENCE_COMPOSITION_BLOCKED" : "READY_FOR_OWNER_REVIEW",
    articleHtmlFinalPresentationAuthority: false,
    existingCompositionReused: true,
    sectionRoles,
    mediaRoles,
    comparison,
    copyQuality: ownerReview.copyQuality,
    blockers,
  };
}
