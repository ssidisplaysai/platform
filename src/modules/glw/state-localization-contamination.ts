import { GLW_CAMPAIGN_US_STATES } from "./campaign-geography";

export const GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_VERSION = "GLW_STATE_LOCALIZATION_CONTAMINATION_V1";

export type GlwStateLocalizationContamination = {
  stateCode: string;
  stateName: string;
  evidence: string;
};

function contentText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:nav|header|footer)\b[^>]*>[\s\S]*?<\/(?:nav|header|footer)>/gi, " ")
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\s+(?=[A-Z][A-Za-z ]{2,40}:)/).map((value) => value.trim()).filter(Boolean);
}

function isAuthorizedComparison(sentence: string, stateName: string, authorized: ReadonlySet<string>): boolean {
  return authorized.has(stateName.toUpperCase())
    && new RegExp(`\\b(?:compare(?:d|s|ing)?(?:\\s+[^.]{0,40})?\\s+(?:to|with)|comparison\\s+(?:to|with)|unlike|versus|vs\\.?|in contrast to)\\s+${stateName}\\b`, "i").test(sentence);
}

function assertsTargetContext(sentence: string, stateName: string): boolean {
  const escaped = stateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:\\b(?:in|across|throughout|for|serving)\\s+${escaped}\\b|\\b${escaped}(?:'s|’)\\s+(?:market|climate|weather|venues?|businesses?|organizations?|projects?|customers?|installations?|regulations?|requirements?)\\b|\\b${escaped}\\s+(?:market|climate|weather|venues?|businesses?|organizations?|projects?|customers?|installations?|regulations?|requirements?)\\b)`, "i").test(sentence);
}

export function evaluateGlwStateLocalizationContamination(input: {
  contentHtml: string;
  expectedStateCode: string;
  authorizedComparisonStateCodes?: readonly string[];
}): { ok: boolean; policyVersion: string; expectedStatePresent: boolean; contaminations: readonly GlwStateLocalizationContamination[] } {
  const expected = GLW_CAMPAIGN_US_STATES.find((state) => state.code === input.expectedStateCode.toUpperCase());
  const text = contentText(input.contentHtml);
  const authorizedCodes = new Set((input.authorizedComparisonStateCodes ?? []).map((code) => code.toUpperCase()));
  const authorizedNames = new Set(GLW_CAMPAIGN_US_STATES.filter((state) => authorizedCodes.has(state.code)).map((state) => state.name.toUpperCase()));
  const contaminations: GlwStateLocalizationContamination[] = [];

  for (const sentence of sentences(text)) {
    for (const state of GLW_CAMPAIGN_US_STATES) {
      if (state.code === expected?.code || !new RegExp(`\\b${state.name}\\b`, "i").test(sentence)) continue;
      if (isAuthorizedComparison(sentence, state.name, authorizedNames)) continue;
      if (assertsTargetContext(sentence, state.name)) contaminations.push({ stateCode: state.code, stateName: state.name, evidence: sentence });
    }
  }

  const expectedStatePresent = Boolean(expected && new RegExp(`\\b${expected.name}\\b`, "i").test(text));
  return {
    ok: expectedStatePresent && contaminations.length === 0,
    policyVersion: GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_VERSION,
    expectedStatePresent,
    contaminations,
  };
}
