import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { GlwGeneratedDraftArtifact } from "./page-execution";
import {
  evaluateGlwReferenceClaimAuthority,
  type GlwClaimAuthorityFinding,
  type GlwProtectedClaimAuthorityMapping,
  type GlwReferenceClaimClass,
} from "./reference-claim-authority";

export const GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_VERSION =
  "GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_V2_2" as const;

export type GlwZeroAuthorityDisposition =
  | "REMOVE"
  | "CONVERT_TO_BUYER_QUESTION"
  | "CONVERT_TO_CONCEPTUAL_APPLICATION"
  | "REPLACE_WITH_EVALUATION_FRAMEWORK"
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
    "Remove nonessential climate, cost-planning, market, and product-assumption statements when deletion preserves surrounding commercial meaning.",
    "Replace unsupported product comparison tables with an authority-neutral buyer evaluation framework.",
    "Convert unsupported environmental, specification, training, and installation-responsibility assertions to authority-neutral buyer questions.",
    "Preserve spherical geometry while removing unsupported engagement or performance meaning.",
    "Reduce repeated supplier-question constructions with an authority-neutral project documentation question.",
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

  if (claimClasses.includes("CLIMATE") && (
    /\badd unique planning challenges and opportunities\b/i.test(text)
    || /^Audience Comfort:\s*In winter months\b/i.test(text)
  )) {
    return { claimClasses, originalText: text, canonicalText: null, disposition: "REMOVE", safeToTransform: true, ruleId: "REMOVE_NONESSENTIAL_CLIMATE_ASSERTION" };
  }

  if (claimClasses.includes("CLIMATE")) {
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

  if (claimClasses.includes("PRICING") && /^Engage Early:\s*Begin supplier conversations\b/i.test(text)) {
    return { claimClasses, originalText: text, canonicalText: null, disposition: "REMOVE", safeToTransform: true, ruleId: "REMOVE_NONESSENTIAL_COST_PLANNING_ASSERTION" };
  }

  if (claimClasses.includes("PRICING") && /\b(?:pricing|price|costs?)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "What pricing and project-cost information can the selected supplier confirm for the proposed configuration?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "PRICING_ASSERTION_TO_BUYER_QUESTION",
    };
  }

  if (claimClasses.includes("MARKET_ADOPTION") && /\b(?:trends?|adoption|growth|increasing use|popularity|market movement|industry direction|regional demand)\b/i.test(text)) {
    return { claimClasses, originalText: text, canonicalText: null, disposition: "REMOVE", safeToTransform: true, ruleId: "REMOVE_UNSUPPORTED_MARKET_ASSERTION" };
  }

  if (claimClasses.includes("PRODUCT_SPECIFICATION")
    && /\bOutdoor Digital Sphere\b/i.test(text)
    && /\bConventional LED (?:Panel|Display)\b/i.test(text)
    && /\b(?:Visual Form Factor|Viewing Angles|Installation Complexity)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: null,
      disposition: "REPLACE_WITH_EVALUATION_FRAMEWORK",
      safeToTransform: true,
      ruleId: "UNSUPPORTED_COMPARISON_TO_BUYER_EVALUATION_FRAMEWORK",
    };
  }

  if (claimClasses.includes("PRODUCT_SPECIFICATION")
    && text.length > 120
    && /\b(?:Feature|Consideration)\b/i.test(text)
    && /\b(?:Form Factor|Viewing Directions?|Viewing Angles?)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: null,
      disposition: "REPLACE_WITH_EVALUATION_FRAMEWORK",
      safeToTransform: true,
      ruleId: "UNSUPPORTED_STRUCTURED_COMPARISON_TO_BUYER_EVALUATION_FRAMEWORK",
    };
  }

  if (claimClasses.includes("PRODUCT_SPECIFICATION") && (
    /^Which content production approaches work best for\b/i.test(text)
    || /^Underestimating the importance of content planning\b/i.test(text)
    || /^Spherical, multidirectional$/i.test(text)
  )) {
    return { claimClasses, originalText: text, canonicalText: null, disposition: "REMOVE", safeToTransform: true, ruleId: "REMOVE_NONESSENTIAL_PRODUCT_ASSUMPTION" };
  }

  if (claimClasses.includes("PRODUCT_SPECIFICATION") && /^Explore our .+ solutions for additional product specifications, turnkey package details, and display options\.?$/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "Review the product page and ask the selected supplier which display options and project-planning information apply to the proposed configuration.",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "GENERIC_SPECIFICATION_CTA_TO_SUPPLIER_QUESTION",
    };
  }

  if (claimClasses.includes("PRODUCT_SPECIFICATION") && /\b(?:brightness|anti-glare|product specifications?)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "Which display specifications can the selected supplier confirm in writing for the proposed configuration?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "PRODUCT_SPECIFICATION_ASSERTION_TO_SUPPLIER_QUESTION",
    };
  }

  if (claimClasses.includes("PRODUCT_SPECIFICATION")
    && /\b360(?:°|-degree)\b/i.test(text)
    && /\b(?:engagement|viewing|visible|audience|presence|immersive)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "Spherical display geometry; confirm project-specific viewing directions and content requirements.",
      disposition: "CONVERT_TO_CONCEPTUAL_APPLICATION",
      safeToTransform: true,
      ruleId: "SPHERICAL_GEOMETRY_WITHOUT_ENGAGEMENT_CLAIM",
    };
  }

  if (claimClasses.includes("DURABILITY") && /\b(?:weatherproof(?:ing)?|weather-resistant|environmental resistance|durability)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "Which environmental protection and durability requirements can the selected supplier confirm for the intended site exposure?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "DURABILITY_ASSERTION_TO_ENVIRONMENTAL_REQUIREMENT_QUESTION",
    };
  }

  if (claimClasses.includes("INGRESS_PROTECTION")) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "Which ingress-protection requirements and documented ratings should the selected supplier confirm for the intended site exposure?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "INGRESS_ASSERTION_TO_SUPPLIER_QUESTION",
    };
  }

  if (claimClasses.includes("TRAINING")) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "What operational documentation, handoff, and training can the selected supplier confirm for the proposed project?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "TRAINING_ASSERTION_TO_SUPPLIER_QUESTION",
    };
  }

  if (claimClasses.includes("INSTALLATION_CAPABILITY")) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "Which installation responsibilities should the project team assign and document for the proposed project?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "INSTALLATION_ASSERTION_TO_RESPONSIBILITY_QUESTION",
    };
  }

  if (claimClasses.includes("SERVICE_CAPABILITY") && /\b(?:cleaning|maintenance|dust|pollen|residue|image quality)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "What maintenance and cleaning requirements should the selected supplier confirm for the proposed installation?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "SERVICE_MAINTENANCE_ASSERTION_TO_SUPPLIER_QUESTION",
    };
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

  if (claimClasses.includes("INTERACTIVITY") && (
    /^(?:A|An)\b.*\binteractive (?:experience|installation)\b/i.test(text)
    || /^(?:Conceptualize|Imagine|Explore|Consider)\b.*\binteractive\b/i.test(text)
  )) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "One possible concept a project team could consider is an interactive experience, subject to confirmation of the selected system and project requirements.",
      disposition: "CONVERT_TO_CONCEPTUAL_APPLICATION",
      safeToTransform: true,
      ruleId: "UNLABELED_INTERACTIVITY_TO_EXPLICIT_CONCEPT",
    };
  }

  return { claimClasses, originalText: text, canonicalText: null, disposition: "BLOCK", safeToTransform: false, ruleId: "AMBIGUOUS_PROTECTED_ASSERTION" };
}

const BUYER_EVALUATION_FRAMEWORK = `<div data-authority-neutral-evaluation-framework="true"><h3>Buyer evaluation framework</h3><ul><li><strong>Audience and viewing:</strong> What viewing directions and distances should the project team evaluate?</li><li><strong>Content planning:</strong> What content approach should the project team review for the proposed display?</li><li><strong>Site planning:</strong> What placement, access, and installation constraints should qualified professionals review?</li></ul></div>`;

function applyAcrossAdjacentTextElements(
  $: ReturnType<typeof cheerio.load>,
  transformation: GlwZeroAuthorityTransformation,
): string | null {
  const elements = $("p,li,td,th,dt,dd").toArray();
  const matches: Array<{ first: typeof elements[number]; last: typeof elements[number]; before: string; after: string }> = [];
  for (let index = 0; index < elements.length - 1; index += 1) {
    const first = elements[index];
    const last = elements[index + 1];
    const firstText = normalizeText($(first).text());
    const lastText = normalizeText($(last).text());
    const combined = `${firstText} ${lastText}`;
    const offset = combined.indexOf(transformation.originalText);
    const matchEnd = offset + transformation.originalText.length;
    if (offset < 0 || offset > firstText.length || matchEnd <= firstText.length + 1) continue;
    matches.push({
      first,
      last,
      before: firstText.slice(0, offset).trim(),
      after: lastText.slice(matchEnd - firstText.length - 1).trim(),
    });
  }
  if (matches.length !== 1) return null;
  const match = matches[0];
  const replacement = [match.before, transformation.canonicalText].filter(Boolean).join(" ");
  $(match.first).text(replacement);
  if (match.after) $(match.last).text(match.after);
  else $(match.last).remove();
  return $.html();
}

function applyTransformation(html: string, transformation: GlwZeroAuthorityTransformation): string | null {
  const $ = cheerio.load(html, null, false);
  if (transformation.disposition === "REPLACE_WITH_EVALUATION_FRAMEWORK") {
    const table = $("table").filter((_, element) => {
      const cells = $(element).find("th,td").map((__, cell) => normalizeText($(cell).text())).get();
      const tableText = cells.join(" ");
      return transformation.originalText.startsWith(tableText)
        || (cells.includes("Outdoor Digital Sphere")
          && cells.some((cell) => /^Conventional LED (?:Panel|Display)$/i.test(cell))
          && cells.includes("Visual Form Factor"));
    }).first();
    if (!table.length) return null;
    const heading = table.prevAll("h2,h3").first();
    if (heading.length) heading.text("Buyer Evaluation Framework");
    table.replaceWith(BUYER_EVALUATION_FRAMEWORK);
    return $.html();
  }
  const exact = $("h1, h2, h3, p, li, td, th, dt, dd").filter((_, element) => normalizeText($(element).text()) === transformation.originalText).first();
  if (!exact.length) {
    const containing = $("h1, h2, h3, p, li, td, th, dt, dd").filter((_, element) =>
      normalizeText($(element).text()).includes(transformation.originalText)).toArray()
      .sort((left, right) => normalizeText($(left).text()).length - normalizeText($(right).text()).length)[0];
    if (containing) {
      const element = $(containing);
      const normalized = normalizeText(element.text());
      element.text(normalized.replace(transformation.originalText, transformation.canonicalText ?? "").trim());
      return $.html();
    }
    const adjacent = applyAcrossAdjacentTextElements($, transformation);
    if (adjacent !== null) return adjacent;
    return html.includes(transformation.originalText)
      ? html.replace(transformation.originalText, transformation.canonicalText ?? "")
      : null;
  }
  if (transformation.canonicalText === null) {
    if (exact.is("h1,h2,h3") && transformation.claimClasses.includes("MARKET_ADOPTION")) {
      let sibling = exact.next();
      while (sibling.length && !sibling.is("h1,h2,h3")) { const next = sibling.next(); sibling.remove(); sibling = next; }
    }
    exact.remove();
  } else exact.text(transformation.canonicalText);
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

  const transformations: GlwZeroAuthorityTransformation[] = [...uniqueBlockingSpans(input.findings)].map(([text, claimClasses]) =>
    transformationFor(text, claimClasses));
  const blockedClaims = transformations.filter((entry) => !entry.safeToTransform).map((entry) => entry.originalText);
  let contentHtml = rawArtifact.contentHtml;

  if (blockedClaims.length === 0) {
    for (const transformation of transformations) {
      const comparisonReplacement = transformations.find((entry) => entry.disposition === "REPLACE_WITH_EVALUATION_FRAMEWORK");
      if (comparisonReplacement && transformation !== comparisonReplacement && comparisonReplacement.originalText.includes(transformation.originalText)) continue;
      const next = applyTransformation(contentHtml, transformation);
      if (next === null) {
        blockedClaims.push(transformation.originalText);
        break;
      }
      contentHtml = next;
    }
    const $ = cheerio.load(contentHtml, null, false);
    const supplierQuestions = $("p,li").filter((_, element) => /selected supplier|supplier confirm/i.test($(element).text())).length;
    const repetitiveQuestion = "Does the supplier confirm that content can be customized and managed to suit these environmental factors?";
    if (supplierQuestions > 5 && contentHtml.includes(repetitiveQuestion)) {
      const copyQualityTransformation: GlwZeroAuthorityTransformation = {
        claimClasses: [],
        originalText: repetitiveQuestion,
        canonicalText: "What content-management requirements should the project team document for the proposed display?",
        disposition: "CONVERT_TO_BUYER_QUESTION",
        safeToTransform: true,
        ruleId: "REDUCE_SUPPLIER_QUESTION_REPETITION",
      };
      const next = applyTransformation(contentHtml, copyQualityTransformation);
      if (next === null) blockedClaims.push(repetitiveQuestion);
      else {
        transformations.push(copyQualityTransformation);
        contentHtml = next;
      }
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

export function rehabilitateGlwExistingArtifact(input: {
  artifact: GlwGeneratedDraftArtifact;
  authority?: {
    references: readonly { referenceId: string; role: string }[];
    authoritativeFactReferenceIds: readonly string[];
    supportedClaimMappings: readonly GlwProtectedClaimAuthorityMapping[];
  } | null;
}) {
  const authority = input.authority ?? {
    references: [],
    authoritativeFactReferenceIds: [],
    supportedClaimMappings: [],
  };
  const before = evaluateGlwReferenceClaimAuthority({ artifact: input.artifact, authority });
  const canonicalization = canonicalizeGlwZeroAuthorityClaims({
    rawArtifact: input.artifact,
    authoritativeFactReferenceIds: authority.authoritativeFactReferenceIds,
    findings: before.findings,
  });
  const after = canonicalization.canonicalizedArtifact
    ? evaluateGlwReferenceClaimAuthority({ artifact: canonicalization.canonicalizedArtifact, authority })
    : null;
  return {
    ok: canonicalization.ok && Boolean(after?.ok),
    before,
    canonicalization,
    after,
  };
}
