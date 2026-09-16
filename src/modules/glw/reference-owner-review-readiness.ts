import * as cheerio from "cheerio";
import type { GlwGeneratedDraftArtifact } from "./page-execution";
import { evaluateGlwReferenceClaimAuthority, type GlwClaimAuthorityFinding } from "./reference-claim-authority";

export const GLW_REFERENCE_COMPOSITION_STANDARD_VERSION = "GLW_REFERENCE_COMPOSITION_STANDARD_V1" as const;
export const GLW_CANONICALIZATION_COPY_QUALITY_VERSION = "GLW_CANONICALIZATION_COPY_QUALITY_V1" as const;

export const GLW_REQUIRED_REFERENCE_COMPOSITION = [
  "VISUAL_HERO",
  "PRODUCT_IDENTITY",
  "PRODUCT_AUTHORITY_MEDIA",
  "LOCALIZED_INTRODUCTION",
  "APPLICATIONS",
  "PLANNING_BUYER_GUIDANCE",
  "VISUAL_APPLICATION_SECTION",
  "AUTHORIZED_COMPARISON_OR_EVALUATION",
  "CTA",
  "SEO",
  "RESPONSIVE_COMPOSITION",
  "MEDIA_PROVENANCE",
  "CLAIM_AUTHORITY",
  "ACTUAL_HOST_VISUAL_CERTIFICATION",
] as const;

export type GlwReferenceMediaReadiness = {
  productAuthorityMediaAvailable: boolean;
  productAuthorityMediaCount: number;
  contextualMediaCount: number;
  applicationMediaCount: number;
  localContextualMediaCount: number;
  featuredMediaId: number | null;
};

export type GlwReferenceOwnerReviewReadiness = {
  standardVersion: typeof GLW_REFERENCE_COMPOSITION_STANDARD_VERSION;
  ready: boolean;
  pageClassification: "LONG_FORM_ARTICLE" | "RICH_REFERENCE_COMPOSITION";
  semantic: {
    ok: boolean;
    findings: readonly GlwClaimAuthorityFinding[];
    unsupportedFactualClaims: number;
    locationFactEscapes: number;
    productFactEscapes: number;
    comparisonFactEscapes: number;
    buyerQuestionPremiseEscapes: number;
  };
  copyQuality: {
    version: typeof GLW_CANONICALIZATION_COPY_QUALITY_VERSION;
    ok: boolean;
    failures: readonly { code: string; text: string }[];
  };
  media: GlwReferenceMediaReadiness & { richMediaCount: number };
  composition: Readonly<Record<typeof GLW_REQUIRED_REFERENCE_COMPOSITION[number], boolean>>;
  blockers: readonly string[];
};

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapedPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasBuyerQuestionPremise(value: string, stateName: string): boolean {
  const text = normalize(value);
  const state = escapedPattern(stateName);
  return /\?/.test(text) && (
    /\([^)]*\b(?:humidity|wind|snow|heat|precipitation|salt|temperature)\b[^)]*\)/i.test(text)
    || new RegExp(`\\b${state}(?:'s|’s)?\\s+(?:winters?|summers?|varied environments?)\\b`, "i").test(text)
    || new RegExp(`\\byear-round environmental changes common in ${state}\\b`, "i").test(text)
  );
}

function qualityFailures($: cheerio.CheerioAPI): Array<{ code: string; text: string }> {
  const failures: Array<{ code: string; text: string }> = [];
  $("p,li").each((_, element) => {
    const text = normalize($(element).text());
    if ((text.match(/\bconcept\b/gi) ?? []).length > 1) failures.push({ code: "REPEATED_CONCEPT_TAUTOLOGY", text });
    if (/\bOne possible concept a project team could consider is\b/i.test(text)) failures.push({ code: "MECHANICAL_CANONICALIZATION_PHRASE", text });
  });
  const supplierQuestions = $("p,li").map((_, element) => /selected supplier|supplier confirm/i.test($(element).text()) ? 1 : 0).get().reduce((sum, value) => sum + value, 0);
  if (supplierQuestions > 5) failures.push({ code: "EXCESSIVE_SUPPLIER_QUESTION_REPETITION", text: `${supplierQuestions} supplier-question constructions.` });
  return failures;
}

export function evaluateGlwReferenceOwnerReviewReadiness(input: {
  artifact: GlwGeneratedDraftArtifact;
  media: GlwReferenceMediaReadiness;
  actualHostVisualCertified: boolean;
  target: { productName: string; productCanonicalPath: string; stateName: string };
  authority?: Parameters<typeof evaluateGlwReferenceClaimAuthority>[0]["authority"];
}): GlwReferenceOwnerReviewReadiness {
  const $ = cheerio.load(input.artifact.contentHtml, null, false);
  const claims = evaluateGlwReferenceClaimAuthority({ artifact: input.artifact, authority: input.authority ?? null });
  const unsupported = claims.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED");
  const tableCellTexts = new Set($("table td,table th").map((_, cell) => normalize($(cell).text())).get());
  const allText = normalize($.text());
  const buyerQuestionPremiseEscapes = $("p,li,td").map((_, element) => hasBuyerQuestionPremise($(element).text(), input.target.stateName) ? 1 : 0).get().reduce((sum, value) => sum + value, 0);
  const failures = qualityFailures($);
  const richMediaCount = $("img,figure,video,picture").length;
  const headings = $("h2,h3").map((_, element) => normalize($(element).text())).get().join(" | ");
    const introductoryText = $("h1").first().nextUntil("h2,h3").filter("p").map((_, element) => normalize($(element).text())).get().join(" ");
    const hasRole = (role: string) => $(`[data-composition-role="${role}"]`).length > 0;
  const composition = {
    VISUAL_HERO: hasRole("hero") && $("[data-composition-role=hero] img,[data-composition-role=hero] picture,[data-composition-role=hero] video").length > 0,
    PRODUCT_IDENTITY: new RegExp(escapedPattern(input.target.productName), "i").test($("h1").first().text()) && input.artifact.contentHtml.includes(input.target.productCanonicalPath),
    PRODUCT_AUTHORITY_MEDIA: input.media.productAuthorityMediaCount > 0 && input.media.featuredMediaId !== null,
      LOCALIZED_INTRODUCTION: new RegExp(`\\b${escapedPattern(input.target.stateName)}\\b`, "i").test($("h1").first().text()) && new RegExp(`\\b${escapedPattern(input.target.stateName)}\\b`, "i").test(introductoryText),
    APPLICATIONS: /applications|potential concepts|uses/i.test(headings),
      PLANNING_BUYER_GUIDANCE: $("[data-reference-section=PLANNING_GUIDANCE]").length > 0 || /\bplan(?:ning)?\b|what to ask|buyer/i.test(headings),
    VISUAL_APPLICATION_SECTION: (input.media.contextualMediaCount + input.media.applicationMediaCount + input.media.localContextualMediaCount) > 0 && hasRole("visual-application"),
    AUTHORIZED_COMPARISON_OR_EVALUATION: $("table").length === 0 || unsupported.every((finding) => !tableCellTexts.has(normalize(finding.claimText))),
    CTA: /contact|request|discuss|consult/i.test(allText),
    SEO: Boolean(input.artifact.seoTitle?.trim() && input.artifact.metaDescription?.trim() && input.artifact.focusKeyphrase?.trim()),
    RESPONSIVE_COMPOSITION: $("[data-composition-contract]").length > 0,
    MEDIA_PROVENANCE: $("[data-media-authority],[data-media-provenance]").length > 0,
    CLAIM_AUTHORITY: claims.ok && buyerQuestionPremiseEscapes === 0,
    ACTUAL_HOST_VISUAL_CERTIFICATION: input.actualHostVisualCertified,
  } satisfies Record<typeof GLW_REQUIRED_REFERENCE_COMPOSITION[number], boolean>;
  const blockers = [
    ...Object.entries(composition).filter(([, passed]) => !passed).map(([requirement]) => requirement),
    ...(failures.length ? ["CANONICALIZATION_COPY_QUALITY"] : []),
  ];
  return {
    standardVersion: GLW_REFERENCE_COMPOSITION_STANDARD_VERSION,
    ready: blockers.length === 0,
    pageClassification: richMediaCount > 0 && composition.VISUAL_HERO && composition.RESPONSIVE_COMPOSITION ? "RICH_REFERENCE_COMPOSITION" : "LONG_FORM_ARTICLE",
    semantic: {
      ok: claims.ok && buyerQuestionPremiseEscapes === 0,
      findings: claims.findings,
      unsupportedFactualClaims: unsupported.length,
      locationFactEscapes: unsupported.filter((finding) => finding.claimClass === "LOCATION_FACT" || finding.claimClass === "CLIMATE").length,
      productFactEscapes: unsupported.filter((finding) => ["PRODUCT_CAPABILITY", "PRODUCT_SPECIFICATION", "INTERACTIVITY", "PERFORMANCE", "INSTALLATION_CAPABILITY"].includes(finding.claimClass)).length,
      comparisonFactEscapes: unsupported.filter((finding) => tableCellTexts.has(normalize(finding.claimText))).length,
      buyerQuestionPremiseEscapes,
    },
    copyQuality: { version: GLW_CANONICALIZATION_COPY_QUALITY_VERSION, ok: failures.length === 0, failures },
    media: { ...input.media, richMediaCount },
    composition,
    blockers,
  };
}
