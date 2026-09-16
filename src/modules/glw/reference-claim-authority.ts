import { createHash } from "node:crypto";
import { load } from "cheerio";
import type { GlwGeneratedDraftArtifact } from "./page-execution";
import { isGlwPlanningOrConfirmationGuidance } from "./reference-claim-disposition";

export const GLW_REFERENCE_QA_POLICY_VERSION = "GLW_REFERENCE_CLAIM_AUTHORITY_V1_2";

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
  { claimClass: "CLIMATE", pattern: /(?:climate|temperature swings?|extreme temperatures?|hot summers?|snowy winters?|local lighting conditions|weather conditions?|snow removal|humidity|precipitation|\bwind\b|\bsnow\b|\bheat\b)/gi },
  { claimClass: "PRODUCT_CAPABILITY", pattern: /(?:outdoor readability|readable outdoors?|support interactivity|interactive content|broad visibility|requires? sensors?|input devices?|networking support|control systems?|moving images?|dynamic media|flexible programming|content programming|all-direction audience viewing)/gi },
  { claimClass: "PRODUCT_SPECIFICATION", pattern: /(?:technical specifications?|performance ratings?|product specifications?|anti-glare|dimming|color[- ]temperature|360(?:°|-degree)|panoramic|multidirectional|curved mounting|custom site adaptation|seamless rounded)/gi },
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
    .replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, " ")
    .replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, ". ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ").trim();
}

function isRegulatoryEnumerationContext(claimText: string, claimClass: GlwReferenceClaimClass): boolean {
  if (claimClass !== "INTERACTIVITY") return false;
  const regulatory = /\b(?:rules?|codes?|ordinances?|permits?|permitting|zoning|regulatory|HOA)\b/i.test(claimText);
  const enumeration = /(?:^|[,;])\s*interactive\s*(?:,|;|\bor\b|\band\b)/i.test(claimText)
    || /\b(?:illuminated|electronic|digital|temporary|permanent)\s*,\s*interactive\s*,\s*(?:or|and)\s*[a-z-]+/i.test(claimText);
  const capabilityPredicate = /\b(?:product|system|sphere|display|service|functionality)\b.{0,60}\b(?:supports?|provides?|includes?|allows?|enables?|offers?|features?)\b/i.test(claimText)
    || /\binteractive\s+(?:capabilit(?:y|ies)|functionality|features?|content|experiences?|apps?|controls?)\b/i.test(claimText);
  return regulatory && enumeration && !capabilityPredicate;
}

function isComparisonTable(cells: readonly string[]): boolean {
  if (cells.length < 6) return false;
  const tableText = cells.join(" ");
  return /\b(?:feature|consideration|criteria|attribute|factor|aspect|category)\b/i.test(tableText)
    && /\b(?:visibility|viewing|form factor|space requirement|content creation|audience experience|brand impact|installation complexity)\b/i.test(tableText)
    && /\b(?:sphere|spherical|curved)\b/i.test(tableText)
    && /\b(?:flat|traditional|conventional)\b/i.test(tableText);
}

function headingsFromHtml(html: string): string[] {
  return [...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function containsEmbeddedUnsupportedPremise(claimText: string, claimClass: GlwReferenceClaimClass): boolean {
  const normalized = claimText.replace(/\s+/g, " ").trim();
  if (claimClass === "CLIMATE") {
    return /\bIndiana(?:'s|’s)?\s+(?:varied environments?|winters?|summers?)\b/i.test(normalized)
      || /\byear-round environmental changes common in Indiana\b/i.test(normalized)
      || /\([^)]*\b(?:humidity|wind|snow|heat|precipitation|salt)\b[^)]*\)/i.test(normalized)
      || /:\s*[^.?!]*\b(?:extreme temperatures?|wind|snow|humidity|precipitation|salt)\b/i.test(normalized);
  }
  if (["PRODUCT_CAPABILITY", "PRODUCT_SPECIFICATION", "INTERACTIVITY", "INSTALLATION_CAPABILITY", "PERFORMANCE"].includes(claimClass)) {
    return /\b(?:360(?:°|-degree)|panoramic|multidirectional|moving images?|dynamic media|flexible programming|content programming|custom site adaptation|curved mounting|all-direction audience viewing)\b/i.test(normalized);
  }
  return false;
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
    if (!claimText || seen.has(key) || isRegulatoryEnumerationContext(claimText, rule.claimClass)) return;
    seen.add(key);
    const mapping = mappings.find((candidate) =>
      candidate.claimClass === rule.claimClass
      && normalizedAssertion(candidate.supportedAssertion) === normalizedAssertion(claimText));
    const conceptual = !mapping
      && !containsEmbeddedUnsupportedPremise(claimText, rule.claimClass)
      && isGlwPlanningOrConfirmationGuidance(claimText);
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
  const $ = load(input.artifact.contentHtml ?? "", null, false);
  $("table").each((_, table) => {
    const cells = $(table).find("th,td").map((__, cell) => $(cell).text().replace(/\s+/g, " ").trim()).get().filter(Boolean);
    if (isComparisonTable(cells)) {
      const aggregate = `${cells.join(" ")} .`;
      for (const rule of RULES) {
        if (new RegExp(rule.pattern.source, rule.pattern.flags).test(aggregate)) evaluate(rule, aggregate);
      }
      return;
    }
    for (const cell of cells) {
      for (const rule of RULES) {
        if (new RegExp(rule.pattern.source, rule.pattern.flags).test(cell)) evaluate(rule, cell);
      }
    }
  });

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