export type GlwClaimDisposition =
  | "REMOVE"
  | "REWRITE_AS_CONCEPTUAL"
  | "GROUND_FROM_EXISTING_AUTHORITY"
  | "REQUIRES_NEW_AUTHORITATIVE_SOURCE"
  | "QA_FALSE_POSITIVE";

export const GLW_REFERENCE_CLAIM_DISPOSITION_VERSION = "GLW_REFERENCE_CLAIM_DISPOSITION_V1";

export type GlwClaimDispositionProjection = {
  currentPredicateResult: "SUPPORTED" | "APPROVED_CONCEPTUAL" | "UNSUPPORTED";
  blocking: boolean;
  disposition: GlwClaimDisposition;
  reason: string;
  requiredAuthority: string;
};

export function isGlwPlanningOrConfirmationGuidance(claimText: string): boolean {
  const normalized = claimText.replace(/\s+/g, " ").trim();
  return normalized.endsWith("?")
    || /\b(?:does not|do not|did not|is not|are not|cannot|can't|without|rather than|instead of|not to)\b/i.test(normalized)
    || /^(?:if|when|before|where|depending on|ask\b|request\b|confirm\b|verify\b|consider\b)/i.test(normalized)
    || /^the same rule applies to\b/i.test(normalized)
    || /\b(?:if .+ (?:is|are) being considered|should be confirmed|requires? (?:its|their) own .+ review|consult .+ for official|request written confirmation|ask which|information to gather|project planning|procurement checklist|compare complete system implications)\b/i.test(normalized)
    || /\b(?:could|may|might|concept|conceptual|ask whether|verify with|confirm with|depending on)\b/i.test(normalized)
    || /^always confirm technical specifications with experts\b/i.test(normalized)
    || /^buying criteria\b[\s\S]*\bevaluate\b[\s\S]*\b(?:warranty terms|total cost of ownership)\b/i.test(normalized)
    || /^permitting oversight:\s*never begin installation before[\s\S]*\b(?:rules are confirmed|required permits secured)\b/i.test(normalized);
}

function requiredAuthority(claimClass: string): string {
  if (["CLIMATE", "LOCATION_FACT"].includes(claimClass)) return "Approved state/local authority";
  if (["PRODUCT_SPECIFICATION", "DURABILITY", "INTERACTIVITY"].includes(claimClass)) return "Approved product authority";
  if (["WARRANTY", "PRICING"].includes(claimClass)) return "Approved commercial policy authority";
  return "Approved authoritative factual source";
}

export function projectGlwClaimDisposition(input: {
  claimClass: string;
  claimText: string;
  authorityStatus?: string | null;
}): GlwClaimDispositionProjection {
  if (input.authorityStatus === "SUPPORTED") {
    return { currentPredicateResult: "SUPPORTED", blocking: false, disposition: "GROUND_FROM_EXISTING_AUTHORITY", reason: "The claim is bound to approved authority.", requiredAuthority: requiredAuthority(input.claimClass) };
  }
  if (input.authorityStatus === "APPROVED_CONCEPTUAL" || isGlwPlanningOrConfirmationGuidance(input.claimText)) {
    return { currentPredicateResult: "APPROVED_CONCEPTUAL", blocking: false, disposition: "QA_FALSE_POSITIVE", reason: "This is narrowly phrased planning or confirmation guidance, not an asserted factual claim.", requiredAuthority: "None while retained as planning or confirmation guidance" };
  }
  if (/\b(?:skimping on weatherproofing or durability invites costly repairs|modern digital solutions offer high-impact visuals while minimizing energy consumption|explore our outdoor digital sphere solutions for additional product specifications)\b/i.test(input.claimText)) {
    return { currentPredicateResult: "UNSUPPORTED", blocking: true, disposition: "REMOVE", reason: "The sentence asserts an unsupported factual capability or result and should be omitted.", requiredAuthority: requiredAuthority(input.claimClass) };
  }
  if (input.claimClass === "INTERACTIVITY"
    || /\b(?:use anti-glare coatings or strategic placement|review available power sources and consult electrical contractors)\b/i.test(input.claimText)) {
    return { currentPredicateResult: "UNSUPPORTED", blocking: true, disposition: "REWRITE_AS_CONCEPTUAL", reason: "The text asserts an unsupported capability or result that may only be framed as a possible use case.", requiredAuthority: requiredAuthority(input.claimClass) };
  }
  return { currentPredicateResult: "UNSUPPORTED", blocking: true, disposition: "REQUIRES_NEW_AUTHORITATIVE_SOURCE", reason: "No supplied authoritative source supports this factual statement.", requiredAuthority: requiredAuthority(input.claimClass) };
}
