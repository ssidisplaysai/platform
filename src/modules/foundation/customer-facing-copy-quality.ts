export const CUSTOMER_FACING_COPY_QUALITY_VERSION = "GENESIS_CUSTOMER_FACING_COPY_QUALITY_V1" as const;

export const INTERNAL_GOVERNANCE_LANGUAGE_PATTERNS: readonly RegExp[] = [
  /owner-approved/i,
  /authority mapping/i,
  /PRODUCT_AUTHORITY/i,
  /CONTEXTUAL_IN_USE/i,
  /APPLICATION_EXPERIENCE/i,
  /approved dataset/i,
  /unsupported factual claim/i,
  /unknown fact/i,
  /canonicalization/i,
  /claim governance/i,
  /semantic input/i,
  /candidate SHA/i,
  /fingerprint/i,
  /proper authority/i,
  /visual authority/i,
];

export type CustomerFacingCopyQualityResult = {
  contract: typeof CUSTOMER_FACING_COPY_QUALITY_VERSION;
  internalGovernanceLanguageExposed: number;
  matchedPatterns: readonly string[];
  pass: boolean;
};

export function evaluateCustomerFacingCopyQuality(visibleText: string): CustomerFacingCopyQualityResult {
  const normalized = visibleText.replace(/\s+/g, " ").trim();
  const matchedPatterns = INTERNAL_GOVERNANCE_LANGUAGE_PATTERNS.filter((pattern) => pattern.test(normalized)).map((pattern) => pattern.source);
  return { contract: CUSTOMER_FACING_COPY_QUALITY_VERSION, internalGovernanceLanguageExposed: matchedPatterns.length, matchedPatterns, pass: matchedPatterns.length === 0 };
}
