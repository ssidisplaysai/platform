import { createHash } from "node:crypto";
import type { GlwGeneratedDraftArtifact } from "./page-execution";
import { isGlwPlanningOrConfirmationGuidance } from "./reference-claim-disposition";

export const GLW_REFERENCE_QA_POLICY_VERSION = "GLW_REFERENCE_CLAIM_AUTHORITY_V1_1";

export const GLW_REFERENCE_CLAIM_CLASSES = [
  "LOCATION_FACT", "MARKET_ADOPTION", "CLIMATE", "PRODUCT_CAPABILITY",
  "PRODUCT_SPECIFICATION", "DURABILITY", "INGRESS_PROTECTION", "BRIGHTNESS",
  "INTERACTIVITY", "REMOTE_MANAGEMENT", "INSTALLATION_SERVICE", "TRAINING",
  "WARRANTY", "SERVICE_AVAILABILITY", "PRICING", "INVENTORY", "PERFORMANCE",
  "INSTALLATION_CAPABILITY", "SERVICE_CAPABILITY",
] as const;

export type GlwReferenceClaimClass = typeof GLW_REFERENCE_CLAIM_CLASSES[number];
export type GlwClaimAuthorityStatus = "SUPPORTED" | "APPROVED_CONCEPTUAL" | "REVIEW_REQUIRED" | "UNSUPPORTED";
export type GlwClaimAuthorityKind = "PRODUCT_TRUTH" | "REFERENCE_SUPPORTED" | "SITE_AUTHORITY_SUPPORTED" | "LOCAL_AUTHORITY_SUPPORTED" | "CONCEPTUAL" | "UNSUPPORTED";

export type GlwClaimAuthorityFinding = {
  claimClass: GlwReferenceClaimClass;
  claimText: string;
  authoritySource: string | null;
  authorityStatus: GlwClaimAuthorityStatus;
  authorityKind: GlwClaimAuthorityKind;
  predicateId: string;
};

export type GlwProtectedClaimAuthorityMapping = {
  authoritativeFactReferenceId: string;
  claimClass: GlwReferenceClaimClass;
  supportedAssertion: string;
};

type ClaimRule = {
  claimClass: GlwReferenceClaimClass;
  pattern: RegExp;
};

const RULES: readonly ClaimRule[] = [
  { claimClass: "MARKET_ADOPTION", pattern: /(?:\btrends?\b|\badoption\b|\bgrowth\b|increasing use|\bpopularity\b|market movement|industry direction|regional demand|(?:venues?|businesses?|organizations?).{0,80}(?:continue to adopt|increasingly adopt|growing demand|adoption))/gi },
  { claimClass: "CLIMATE", pattern: /(?:climate|temperature swings?|local lighting conditions|weather conditions?)/gi },
  { claimClass: "PRODUCT_CAPABILITY", pattern: /(?:outdoor readability|readable outdoors?|support interactivity|interactive content|broad visibility|requires? sensors?|input devices?|networking support|control systems?)/gi },
  { claimClass: "PRODUCT_SPECIFICATION", pattern: /(?:technical specifications?|performance ratings?|product specifications?|anti-glare|dimming|color[- ]temperature)/gi },
  { claimClass: "DURABILITY", pattern: /(?:weatherproof construction|weatherproof|withstand moisture|uv exposure|durability ratings?)/gi },
  { claimClass: "INGRESS_PROTECTION", pattern: /(?:ingress protection|\bingress\b|\bIP\d{2}\b)/gi },
  { claimClass: "BRIGHTNESS", pattern: /(?:brightness ratings?|\bnits?\b|high-brightness)/gi },
  { claimClass: "INTERACTIVITY", pattern: /(?:motion sensors?|mobile apps?|social feeds?|interactive)/gi },
  { claimClass: "REMOTE_MANAGEMENT", pattern: /(?:remote.{0,24}diagnostics?|remote management|remote monitoring)/gi },
  { claimClass: "INSTALLATION_SERVICE", pattern: /(?:local installation assistance|installation services?|turnkey installation)/gi },
  { claimClass: "TRAINING", pattern: /(?:operator training|staff training|\btraining\b)/gi },
  { claimClass: "WARRANTY", pattern: /(?:warrant(?:y|ies)|warranty coverage)/gi },
  { claimClass: "SERVICE_AVAILABILITY", pattern: /(?:timely service response|service availability|local support|service response)/gi },
  { claimClass: "PRICING", pattern: /(?:\bpricing\b|\bprice(?:s|d)?\b|\bcosts?\b)/gi },
  { claimClass: "INVENTORY", pattern: /(?:in stock|current inventory|inventory availability|available now)/gi },
  { claimClass: "LOCATION_FACT", pattern: /(?:Illinois|Indiana).{0,100}(?:requires?|is home to|nearly always|statewide)/gi },
  { claimClass: "PERFORMANCE", pattern: /(?:guaranteed performance|improves? performance|performance through|high-performance)/gi },
  { claimClass: "INSTALLATION_CAPABILITY", pattern: /(?:we|our team|the company).{0,60}(?:installs?|handles? installation|provides? installation)/gi },
  { claimClass: "SERVICE_CAPABILITY", pattern: /(?:we|our team|the company).{0,60}(?:services?|maintains?|provides? support)/gi },
];

function textFromHtml(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, ". ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ").trim();
}

function headingsFromHtml(html: string): string[] {
  return [...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizedAssertion(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function sentenceAt(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf(". ", index), text.lastIndexOf("! ", index), text.lastIndexOf("? ", index));
  const candidates = [text.indexOf(". ", index), text.indexOf("! ", index), text.indexOf("? ", index)].filter((value) => value >= 0);
  const end = candidates.length ? Math.min(...candidates) + 1 : text.length;
  return text.slice(start < 0 ? 0 : start + 2, end).trim();
}

export function evaluateGlwReferenceClaimAuthority(input: {
  artifact: GlwGeneratedDraftArtifact;
  authority?: {
    references: readonly { referenceId: string; role: string }[];
    authoritativeFactReferenceIds: readonly string[];
    supportedClaimMappings: readonly GlwProtectedClaimAuthorityMapping[];
  } | null;
}): { ok: boolean; policyVersion: string; findings: readonly GlwClaimAuthorityFinding[]; failureReasons: Readonly<Record<string, string>> } {
  const text = textFromHtml(input.artifact.contentHtml ?? "");
  const findings: GlwClaimAuthorityFinding[] = [];
  const seen = new Set<string>();
  const classifiedAuthoritativeIds = new Set((input.authority?.references ?? [])
    .filter((reference) => reference.role === "authoritative_fact")
    .map((reference) => reference.referenceId));
  const authoritativeIds = new Set((input.authority?.authoritativeFactReferenceIds ?? [])
    .filter((referenceId) => classifiedAuthoritativeIds.has(referenceId)));
  const mappings = (input.authority?.supportedClaimMappings ?? []).filter((mapping) =>
    authoritativeIds.has(mapping.authoritativeFactReferenceId)
    && mapping.supportedAssertion.trim());

  const evaluate = (rule: ClaimRule, claimText: string) => {
    const key = `${rule.claimClass}:${claimText}`;
    if (!claimText || seen.has(key)) return;
    seen.add(key);
    const mapping = mappings.find((candidate) =>
      candidate.claimClass === rule.claimClass
      && normalizedAssertion(candidate.supportedAssertion) === normalizedAssertion(claimText));
    const conceptual = !mapping && isGlwPlanningOrConfirmationGuidance(claimText);
    findings.push({
      claimClass: rule.claimClass,
      claimText,
      authoritySource: mapping?.authoritativeFactReferenceId ?? (conceptual ? "EXPLICIT_CONCEPTUAL_FRAMING" : null),
      authorityStatus: mapping ? "SUPPORTED" : conceptual ? "APPROVED_CONCEPTUAL" : "UNSUPPORTED",
      authorityKind: mapping ? "REFERENCE_SUPPORTED" : conceptual ? "CONCEPTUAL" : "UNSUPPORTED",
      predicateId: `unsupportedClaim.${rule.claimClass}`,
    });
  };

  for (const rule of RULES) {
    for (const match of text.matchAll(new RegExp(rule.pattern.source, rule.pattern.flags))) {
      const claimText = sentenceAt(text, match.index ?? 0);
      evaluate(rule, claimText);
    }
  }

  const marketRule = RULES.find((rule) => rule.claimClass === "MARKET_ADOPTION")!;
  for (const heading of headingsFromHtml(input.artifact.contentHtml ?? "")) {
    if (new RegExp(marketRule.pattern.source, marketRule.pattern.flags).test(heading)) evaluate(marketRule, heading);
  }

  const unsupported = findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED");
  return {
    ok: unsupported.length === 0,
    policyVersion: GLW_REFERENCE_QA_POLICY_VERSION,
    findings,
    failureReasons: Object.fromEntries(unsupported.map((finding, index) => [
      `${finding.predicateId}.${index + 1}`,
      `${finding.claimClass}: ${finding.claimText}`,
    ])),
  };
}

export function fingerprintGlwAuthority(value: unknown): string {
  const serialized = value instanceof Uint8Array
    ? value
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
  return createHash("sha256").update(serialized).digest("hex");
}