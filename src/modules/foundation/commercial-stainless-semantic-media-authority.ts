import type { IntentionalMediaReuseDeclaration, SemanticMediaPolicyResult } from "./semantic-media-reuse-policy";

export const COMMERCIAL_STAINLESS_SEMANTIC_MEDIA_REUSE_POLICY = "COMMERCIAL_STAINLESS_SEMANTIC_MEDIA_REUSE_POLICY_V1";
export const COMMERCIAL_STAINLESS_WAVE1_COMPOSITION_AUTHORITY = "commercial-stainless-wave1-approved:c1d94a4b80661397a67d1ba8674c0ea8f71c3e19";

const PAGE17_EDUCATION_SOURCE = "https://commercialstainlesscounters.com/wp-content/uploads/2026/09/education.jpg";

export function commercialStainlessMediaReuseDeclarations(publicUrl: string): IntentionalMediaReuseDeclaration[] {
  if (new URL(publicUrl).pathname !== "/markets/education/") return [];
  return [{
    declarationId: "commercial-stainless-page17-education-hero-application-v1",
    mediaSourceIdentity: PAGE17_EDUCATION_SOURCE,
    allowedInstances: [
      { semanticRole: "HERO_MEDIA", sectionIdentity: "wr-hero.wr-hero--industry:0", compositionRole: "PRIMARY_HERO" },
      { semanticRole: "APPLICATION_EXPERIENCE", sectionIdentity: "wr-split:3", compositionRole: "CONTEXTUAL_SUPPORT" },
    ],
    authorityReference: COMMERCIAL_STAINLESS_WAVE1_COMPOSITION_AUTHORITY,
    ownerApproved: true,
    claimClass: "CONCEPTUAL",
    misleadingDocumentaryReuse: false,
  }];
}

export type CommercialStainlessSemanticReuseStatus = "NO_DUPLICATE_SOURCE_REUSE" | "GOVERNED_INTENTIONAL_REUSE" | "OWNER_REVIEW_REQUIRED" | "REJECTED_DUPLICATION";

export function commercialStainlessSemanticReuseStatus(result: SemanticMediaPolicyResult): CommercialStainlessSemanticReuseStatus {
  if (result.findings.length === 0) return "NO_DUPLICATE_SOURCE_REUSE";
  if (result.pass && result.findings.every((finding) => finding.classification === "INTENTIONAL_SEMANTIC_REUSE")) return "GOVERNED_INTENTIONAL_REUSE";
  if (result.findings.some((finding) => finding.classification === "UNRESOLVED_DUPLICATION")) return "OWNER_REVIEW_REQUIRED";
  return "REJECTED_DUPLICATION";
}