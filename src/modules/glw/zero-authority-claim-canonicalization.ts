import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { GlwGeneratedDraftArtifact } from "./page-execution";
import type { GlwClaimAuthorityFinding, GlwReferenceClaimClass } from "./reference-claim-authority";

export const GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_VERSION =
  "GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_V1" as const;

export type GlwZeroAuthorityDisposition =
  | "REMOVE"
  | "CONVERT_TO_BUYER_QUESTION"
  | "CONVERT_TO_CONCEPTUAL_APPLICATION"
  | "BLOCK";

export type GlwZeroAuthorityTransformation = {
  claimClasses: readonly GlwReferenceClaimClass[];
  originalText: string;
  canonicalText: string | null;
  disposition: GlwZeroAuthorityDisposition;
  safeToTransform: boolean;
  ruleId: string;
};

export type GlwZeroAuthorityCanonicalizationReceipt = {
  receiptId: string;
  policyVersion: typeof GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_VERSION;
  policyFingerprint: string;
  rawArtifactSha256: string;
  canonicalizedArtifactSha256: string | null;
  authoritativeFactReferenceCount: 0;
  transformations: readonly GlwZeroAuthorityTransformation[];
  blockedClaims: readonly string[];
  consumesN8nExecution: false;
  modelInvoked: false;
};

const POLICY = {
  version: GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_VERSION,
  appliesWhenAuthoritativeFactReferenceIdsEmpty: true,
  rules: [
    "Remove nonessential unsupported local-market assertions beginning with a named geography followed by is home to.",
    "Convert an unsupported capability assertion beginning with This allows for and containing interactive meaning to a canonical supplier-dependent buyer question.",
    "Convert labeled application examples containing interactive meaning to explicitly conceptual applications without asserting product capability.",
    "Block every protected claim that does not match an allowlisted meaning-reducing transformation.",
  ],
} as const;

export const GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_FINGERPRINT = sha256(JSON.stringify(POLICY));

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueBlockingSpans(findings: readonly GlwClaimAuthorityFinding[]): Map<string, GlwReferenceClaimClass[]> {
  const spans = new Map<string, GlwReferenceClaimClass[]>();
  for (const finding of findings) {
    if (finding.authorityStatus !== "UNSUPPORTED") continue;
    const text = normalizeText(finding.claimText);
    const classes = spans.get(text) ?? [];
    if (!classes.includes(finding.claimClass)) classes.push(finding.claimClass);
    spans.set(text, classes);
  }
  return spans;
}

function transformationFor(text: string, claimClasses: readonly GlwReferenceClaimClass[]): GlwZeroAuthorityTransformation {
  if (claimClasses.includes("LOCATION_FACT") && /^[A-Z][A-Za-z .'-]+ is home to\b/.test(text)) {
    return { claimClasses, originalText: text, canonicalText: null, disposition: "REMOVE", safeToTransform: true, ruleId: "REMOVE_UNSUPPORTED_LOCAL_MARKET_ASSERTION" };
  }

  if (claimClasses.includes("INTERACTIVITY") && /^This allows for\b/i.test(text) && /\binteractive\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "Does the selected system support the interactive concept being considered, and what additional hardware or connectivity would be required, if any?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "CAPABILITY_ASSERTION_TO_SUPPLIER_QUESTION",
    };
  }

  if (claimClasses.some((claimClass) => ["PRODUCT_CAPABILITY", "INTERACTIVITY", "REMOTE_MANAGEMENT"].includes(claimClass))
    && /^(?:The|This|A|An) (?:selected )?(?:system|product|sphere|display)\s+(?:supports?|provides?|includes?|requires?|allows?)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "Does the selected system support the project concept being considered, and what additional hardware, connectivity, or services would the supplier require, if any?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "GENERIC_CAPABILITY_TO_SUPPLIER_QUESTION",
    };
  }

  if (claimClasses.includes("CLIMATE") && /\b(?:climate|weather|temperature|seasonal)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "What environmental conditions should the project team ask the selected supplier and qualified professionals to evaluate for the proposed installation?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "CLIMATE_ASSERTION_TO_BUYER_QUESTION",
    };
  }

  if (claimClasses.includes("WARRANTY") && /\bwarrant(?:y|ies)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "Which warranty terms can the selected supplier confirm in writing for the proposed configuration?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "WARRANTY_ASSERTION_TO_BUYER_QUESTION",
    };
  }

  if (claimClasses.includes("PRICING") && /\b(?:pricing|price|cost)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "What pricing and project-cost information can the selected supplier confirm for the proposed configuration?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "PRICING_ASSERTION_TO_BUYER_QUESTION",
    };
  }

  if (claimClasses.includes("MARKET_ADOPTION") && /\b(?:trend|adoption|growth|increasing use|popularity|market movement|industry direction|regional demand)\b/i.test(text)) {
    return { claimClasses, originalText: text, canonicalText: null, disposition: "REMOVE", safeToTransform: true, ruleId: "REMOVE_UNSUPPORTED_MARKET_ASSERTION" };
  }

  const labeledApplication = text.match(/^([^:]{2,80}):\s*(.+)$/);
  if (labeledApplication && claimClasses.includes("INTERACTIVITY") && /\binteractive\b/i.test(labeledApplication[2])) {
    const label = labeledApplication[1].trim();
    const context = labeledApplication[2]
      .replace(/\bprogrammed interactive content\b/gi, "a conceptual interactive content program")
      .replace(/^Interactive experiences\b/i, "an interactive experience concept");
    return {
      claimClasses,
      originalText: text,
      canonicalText: `${label}: One possible concept a project team could consider is ${context.charAt(0).toLowerCase()}${context.slice(1)}`,
      disposition: "CONVERT_TO_CONCEPTUAL_APPLICATION",
      safeToTransform: true,
      ruleId: "LABELED_APPLICATION_TO_EXPLICIT_CONCEPT",
    };
  }

  return { claimClasses, originalText: text, canonicalText: null, disposition: "BLOCK", safeToTransform: false, ruleId: "AMBIGUOUS_PROTECTED_ASSERTION" };
}

function replaceElementText(html: string, originalText: string, canonicalText: string | null): string | null {
  if (html.includes(originalText)) return html.replace(originalText, canonicalText ?? "");
  const $ = cheerio.load(html, null, false);
  const exact = $("p, li").filter((_, element) => normalizeText($(element).text()) === originalText).first();
  if (!exact.length) return null;
  if (canonicalText === null) exact.remove();
  else exact.text(canonicalText);
  return $.html();
}

export function canonicalizeGlwZeroAuthorityClaims(input: {
  rawArtifact: GlwGeneratedDraftArtifact;
  authoritativeFactReferenceIds: readonly string[];
  findings: readonly GlwClaimAuthorityFinding[];
}): {
  ok: boolean;
  rawArtifact: GlwGeneratedDraftArtifact;
  canonicalizedArtifact: GlwGeneratedDraftArtifact | null;
  receipt: GlwZeroAuthorityCanonicalizationReceipt;
} {
  const rawArtifact = structuredClone(input.rawArtifact);
  const rawArtifactSha256 = sha256(rawArtifact.contentHtml);
  if (input.authoritativeFactReferenceIds.length > 0) {
    return {
      ok: false,
      rawArtifact,
      canonicalizedArtifact: null,
      receipt: {
        receiptId: `glw-zero-authority-${rawArtifactSha256.slice(0, 24)}-blocked`,
        policyVersion: GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_VERSION,
        policyFingerprint: GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_FINGERPRINT,
        rawArtifactSha256,
        canonicalizedArtifactSha256: null,
        authoritativeFactReferenceCount: 0,
        transformations: [],
        blockedClaims: ["ZERO_AUTHORITY_POLICY_NOT_APPLICABLE"],
        consumesN8nExecution: false,
        modelInvoked: false,
      },
    };
  }

  const transformations = [...uniqueBlockingSpans(input.findings)].map(([text, claimClasses]) =>
    transformationFor(text, claimClasses));
  const blockedClaims = transformations.filter((entry) => !entry.safeToTransform).map((entry) => entry.originalText);
  let contentHtml = rawArtifact.contentHtml;

  if (blockedClaims.length === 0) {
    for (const transformation of transformations) {
      const next = replaceElementText(contentHtml, transformation.originalText, transformation.canonicalText);
      if (next === null) {
        blockedClaims.push(transformation.originalText);
        break;
      }
      contentHtml = next;
    }
  }

  const canonicalizedArtifact = blockedClaims.length === 0
    ? { ...rawArtifact, contentHtml }
    : null;
  const canonicalizedArtifactSha256 = canonicalizedArtifact ? sha256(canonicalizedArtifact.contentHtml) : null;

  return {
    ok: Boolean(canonicalizedArtifact),
    rawArtifact,
    canonicalizedArtifact,
    receipt: {
      receiptId: `glw-zero-authority-${rawArtifactSha256.slice(0, 12)}-${canonicalizedArtifactSha256?.slice(0, 12) ?? "blocked"}`,
      policyVersion: GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_VERSION,
      policyFingerprint: GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_FINGERPRINT,
      rawArtifactSha256,
      canonicalizedArtifactSha256,
      authoritativeFactReferenceCount: 0,
      transformations,
      blockedClaims,
      consumesN8nExecution: false,
      modelInvoked: false,
    },
  };
}
