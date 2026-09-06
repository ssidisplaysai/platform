export const SEO_REMEDIATION_POLICY_VERSION = "genesis-bounded-seo-remediation-v1" as const;
export type SeoApprovalMode = "MANUAL_EXACT" | "POLICY_BOUNDED" | "AUTONOMOUS_VERIFIED";

export type SeoRemediationDecision = {
  eligible: boolean;
  mode: SeoApprovalMode;
  blockers: readonly string[];
  autonomousWritesEnabled: false;
};

export function evaluateSeoRemediation(input: {
  mode: SeoApprovalMode;
  ownershipEstablished: boolean;
  searchIntentEstablished: boolean;
  productAuthorityEstablished: boolean;
  unsupportedMetaClaimIdentified: boolean;
  replacementUsesVerifiedFactsOrPlanningLanguage: boolean;
  focusKeywordUnchanged: boolean;
  yoastTitleUnchanged: boolean;
  pageTitleUnchanged: boolean;
  slugUnchanged: boolean;
  canonicalUnchanged: boolean;
  robotsUnchanged: boolean;
  ownershipUnchanged: boolean;
  semanticAuditPassed: boolean;
  exactRollbackAvailable: boolean;
  competingOwnership: boolean;
  legalOrComplianceLanguage: boolean;
  confidence: "DETERMINISTIC" | "REVIEW_REQUIRED";
}): SeoRemediationDecision {
  const blockers: string[] = [];
  for (const [condition, code] of [
    [input.ownershipEstablished, "OWNERSHIP_UNRESOLVED"],
    [input.searchIntentEstablished, "SEARCH_INTENT_UNRESOLVED"],
    [input.productAuthorityEstablished, "PRODUCT_AUTHORITY_MISSING"],
    [input.unsupportedMetaClaimIdentified, "UNSUPPORTED_META_NOT_IDENTIFIED"],
    [input.replacementUsesVerifiedFactsOrPlanningLanguage, "REPLACEMENT_EXCEEDS_AUTHORITY"],
    [input.focusKeywordUnchanged, "FOCUS_KEYWORD_CHANGE"],
    [input.yoastTitleUnchanged, "YOAST_TITLE_CHANGE"],
    [input.pageTitleUnchanged, "PAGE_TITLE_CHANGE"],
    [input.slugUnchanged, "SLUG_CHANGE"],
    [input.canonicalUnchanged, "CANONICAL_CHANGE"],
    [input.robotsUnchanged, "ROBOTS_CHANGE"],
    [input.ownershipUnchanged, "OWNERSHIP_CHANGE"],
    [input.semanticAuditPassed, "SEMANTIC_AUDIT_FAILED"],
    [input.exactRollbackAvailable, "ROLLBACK_UNAVAILABLE"],
  ] as const) if (!condition) blockers.push(code);
  if (input.competingOwnership) blockers.push("COMPETING_OWNERSHIP");
  if (input.legalOrComplianceLanguage) blockers.push("LEGAL_OR_COMPLIANCE_REVIEW");
  if (input.confidence !== "DETERMINISTIC") blockers.push("CONFIDENCE_BELOW_THRESHOLD");
  if (input.mode === "AUTONOMOUS_VERIFIED") blockers.push("AUTONOMOUS_WRITES_DISABLED");
  return { eligible: blockers.length === 0, mode: input.mode, blockers, autonomousWritesEnabled: false };
}

export const PROJECTORENCLOSURE_APPROVED_META_EVIDENCE = Object.freeze([
  { pageId: 11862, intent: "restaurant and bar installations", approvalMode: "MANUAL_EXACT" },
  { pageId: 11865, intent: "event venue installations", approvalMode: "MANUAL_EXACT" },
  { pageId: 11868, intent: "attractions and immersive experiences", approvalMode: "MANUAL_EXACT" },
  { pageId: 11874, intent: "wellness installations", approvalMode: "MANUAL_EXACT" },
  { pageId: 11871, intent: "golf simulator installations", approvalMode: "MANUAL_EXACT" },
] as const);