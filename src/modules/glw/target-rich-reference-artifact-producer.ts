import { createHash } from "node:crypto";
import { load } from "cheerio";

import { evaluateCustomerFacingCopyQuality } from "@/modules/foundation/customer-facing-copy-quality";
import type { SharedRichPageProductionProfile } from "@/modules/foundation/shared-rich-page-production-authority";
import type { SitePageMediaAssignment } from "@/modules/foundation/site-page-media-assignment";
import type { GlwGeneratedDraftArtifact } from "./page-execution";
import { evaluateGlwReferenceClaimAuthority } from "./reference-claim-authority";
import { evaluateGlwReferenceOwnerReviewReadiness } from "./reference-owner-review-readiness";
import { evaluateGlwStateLocalizationContamination } from "./state-localization-contamination";
import { canonicalizeGlwZeroAuthorityClaims } from "./zero-authority-claim-canonicalization";

export const TARGET_RICH_REFERENCE_ARTIFACT_PRODUCER_VERSION = "GENESIS_TARGET_RICH_REFERENCE_ARTIFACT_PRODUCER_V1" as const;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function replaceText(root: ReturnType<typeof load>, from: string, to: string): void {
  root(".saw-page").find("*").contents().filter((_, node) => node.type === "text").each((_, node) => {
    const textNode = node as typeof node & { data?: string };
    if (textNode.data?.includes(from)) textNode.data = textNode.data.replaceAll(from, to);
  });
}

export function produceTargetRichReferenceArtifact(input: {
  target: { targetId: string; stateCode: string; stateName: string; canonicalPath: string };
  product: { productId: string; productName: string; canonicalPath: string };
  semanticArtifact: GlwGeneratedDraftArtifact;
  referenceArtifactHtml: string;
  mediaAssignments: readonly SitePageMediaAssignment[];
  profile: SharedRichPageProductionProfile;
}): {
  artifact: GlwGeneratedDraftArtifact;
  artifactSha: string;
  semanticArtifactSha: string;
  deterministicCanonicalizationUsed: boolean;
  qa: { unsupportedFactualClaims: number; geographicEvidenceEscapes: number; comparisonAuthorityEscapes: number; buyerQuestionPremiseEscapes: number; unexpectedStateContamination: number; internalGovernanceLanguage: number; customerFacingCopyQuality: "PASS" };
} {
  if (input.profile.selector.productId !== input.product.productId || input.profile.selector.pageType !== "LOCATION_SERVICE" || !input.profile.host.suppressNativeTitle) throw new Error("TARGET_RICH_REFERENCE_HOST_PROFILE_MISMATCH");
  const rawClaims = evaluateGlwReferenceClaimAuthority({ artifact: input.semanticArtifact, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
  const canonicalization = canonicalizeGlwZeroAuthorityClaims({ rawArtifact: input.semanticArtifact, authoritativeFactReferenceIds: [], findings: rawClaims.findings });
  if (!canonicalization.ok || !canonicalization.canonicalizedArtifact) throw new Error("TARGET_RICH_REFERENCE_CANONICALIZATION_BLOCKED");
  const semanticArtifact = canonicalization.canonicalizedArtifact;
  const claims = evaluateGlwReferenceClaimAuthority({ artifact: semanticArtifact, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
  if (!claims.ok) throw new Error("TARGET_RICH_REFERENCE_CLAIM_AUTHORITY_FAILED");

  const $ = load(input.referenceArtifactHtml, null, false);
  const root = $(".saw-page");
  if (root.length !== 1 || root.find("h1").length !== 1) throw new Error("TARGET_RICH_REFERENCE_REFERENCE_ARTIFACT_INVALID");
  const referenceH1 = root.find("h1").first().text().replace(/\s+/g, " ").trim();
  const referenceState = referenceH1.replace(new RegExp(`^${input.product.productName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} in `), "").trim();
  if (!referenceState || referenceState === referenceH1) throw new Error("TARGET_RICH_REFERENCE_REFERENCE_STATE_INVALID");
  replaceText($, referenceState, input.target.stateName);
  root.attr("data-target-id", input.target.targetId).attr("data-semantic-input-sha", sha256(semanticArtifact.contentHtml)).attr("data-media-provenance", "governed-product-media");
  root.find("[data-reference-section=HERO]").attr("data-composition-role", "hero").attr("data-media-authority", "PRODUCT_AUTHORITY");
  root.find("[data-reference-section=PRODUCT_IDENTITY]").attr("data-composition-role", "visual-application").attr("data-media-authority", "CONTEXTUAL_IN_USE");
  root.find("h1").first().text(`${input.product.productName} in ${input.target.stateName}`);

  const assignments = new Map(input.mediaAssignments.map((assignment) => [assignment.role, assignment]));
  for (const [role, selector] of [["PRODUCT_AUTHORITY", "[data-media-role=PRODUCT_AUTHORITY]"], ["CONTEXTUAL_IN_USE", "[data-media-role=CONTEXTUAL_IN_USE]"]] as const) {
    const assignment = assignments.get(role);
    if (!assignment || assignment.asset.type !== "APPROVED_EXISTING") throw new Error(`TARGET_RICH_REFERENCE_${role}_MEDIA_REQUIRED`);
    root.find(selector).attr("src", assignment.asset.url).attr("data-media-id", assignment.approval.candidateId).attr("data-media-role", role);
  }

  const contentHtml = $.html();
  const artifact: GlwGeneratedDraftArtifact = {
    title: `${input.product.productName} in ${input.target.stateName}`,
    contentHtml,
    slug: input.target.canonicalPath,
    excerpt: `Plan a ${input.product.productName} project in ${input.target.stateName} around the location, audience, content, and timeline.`,
    seoTitle: `${input.product.productName} in ${input.target.stateName} | Project Planning`,
    metaDescription: `Plan a ${input.product.productName} project in ${input.target.stateName} with approved product imagery and practical evaluation questions.`,
    focusKeyphrase: `${input.product.productName.toLowerCase()} ${input.target.stateName}`,
  };
  const finalClaims = evaluateGlwReferenceClaimAuthority({ artifact, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
  const contamination = evaluateGlwStateLocalizationContamination({ contentHtml, expectedStateCode: input.target.stateCode });
  const copy = evaluateCustomerFacingCopyQuality($(".saw-page").text().replace(/\s+/g, " ").trim());
  const review = evaluateGlwReferenceOwnerReviewReadiness({ artifact, target: { productName: input.product.productName, productCanonicalPath: input.product.canonicalPath, stateName: input.target.stateName }, media: { productAuthorityMediaAvailable: true, productAuthorityMediaCount: 1, contextualMediaCount: 1, applicationMediaCount: assignments.has("APPLICATION_EXPERIENCE") ? 1 : 0, localContextualMediaCount: 0, featuredMediaId: 1 }, actualHostVisualCertified: false, authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] } });
  const unsupported = finalClaims.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED");
  const blockers = [...(unsupported.length ? ["CLAIM_AUTHORITY"] : []), ...(contamination.contaminations.length ? ["STATE_CONTAMINATION"] : []), ...(!copy.pass ? ["COPY_QUALITY"] : []), ...(!review.semantic.ok ? ["OWNER_SEMANTIC_READINESS"] : [])];
  if (blockers.length) throw new Error(`TARGET_RICH_REFERENCE_COMPOSED_QA_FAILED:${blockers.join(",")}`);
  return { artifact, artifactSha: sha256(contentHtml), semanticArtifactSha: sha256(input.semanticArtifact.contentHtml), deterministicCanonicalizationUsed: canonicalization.receipt.transformations.length > 0, qa: { unsupportedFactualClaims: 0, geographicEvidenceEscapes: review.semantic.locationFactEscapes, comparisonAuthorityEscapes: review.semantic.comparisonFactEscapes, buyerQuestionPremiseEscapes: review.semantic.buyerQuestionPremiseEscapes, unexpectedStateContamination: 0, internalGovernanceLanguage: copy.internalGovernanceLanguageExposed, customerFacingCopyQuality: "PASS" } };
}
