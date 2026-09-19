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
  "GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_V2_8" as const;

export type GlwZeroAuthorityFallbackPolicy =
  | "STRICT"
  | "OUTDOOR_SPHERE_STATE_SERVICE";

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
  fallbackPolicy: GlwZeroAuthorityFallbackPolicy;
};

export type GlwZeroAuthorityCanonicalizationReceipt = {
  receiptId: string;
  policyVersion: typeof GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_VERSION;
  policyFingerprint: string;
  rawArtifactSha256: string;
  canonicalizedArtifactSha256: string | null;
  authoritativeFactReferenceCount: 0;
  fallbackPolicy: GlwZeroAuthorityFallbackPolicy;
  transformations: readonly GlwZeroAuthorityTransformation[];
  passes?: readonly {
    pass: number;
    inputHash: string;
    unsupportedBefore: readonly string[];
    transformations: readonly GlwZeroAuthorityTransformation[];
    outputHash: string;
    unsupportedAfter: readonly string[];
  }[];
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
    "Replace structurally identifiable unsupported product comparison tables with an authority-neutral buyer evaluation framework.",
    "Convert unsupported environmental, specification, training, and installation-responsibility assertions to authority-neutral buyer questions.",
    "Convert labeled project-schedule planning directives to authority-neutral supplier-verification questions.",
    "Convert labeled content-planning buyer questions misclassified as unsupported capability assertions to a canonical authority-neutral buyer evaluation question.",
    "Convert narrow spherical content-planning assertions that combine 360-degree or custom-content requirements into an authority-neutral buyer planning question.",
    "Convert narrow documentation-directive planning assertions into an authority-neutral buyer documentation request question.",
    "Preserve spherical geometry while removing unsupported engagement, impact, accessibility, or performance meaning.",
    "Apply cross-element transformations only when the corresponding DOM text-node span is unique.",
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

function resolveConservativeFallbackClass(claimClasses: readonly GlwReferenceClaimClass[]): GlwReferenceClaimClass | null {
  const priority: readonly GlwReferenceClaimClass[] = [
    "LOCATION_FACT",
    "MARKET_ADOPTION",
    "PRODUCT_SPECIFICATION",
    "BRIGHTNESS",
    "PERFORMANCE",
    "DURABILITY",
    "INGRESS_PROTECTION",
    "CLIMATE",
    "INTERACTIVITY",
    "REMOTE_MANAGEMENT",
    "INSTALLATION_SERVICE",
    "INSTALLATION_CAPABILITY",
    "TRAINING",
    "SERVICE_AVAILABILITY",
    "SERVICE_CAPABILITY",
    "WARRANTY",
    "PRICING",
    "INVENTORY",
    "PRODUCT_CAPABILITY",
  ];
  for (const candidate of priority) {
    if (claimClasses.includes(candidate)) return candidate;
  }
  return null;
}

function outdoorSphereFallbackTransformation(input: {
  text: string;
  claimClasses: readonly GlwReferenceClaimClass[];
}): GlwZeroAuthorityTransformation {
  if (isCanonicalConceptualApplication(input.text)) {
    return {
      claimClasses: input.claimClasses,
      originalText: input.text,
      canonicalText: "What visual or experience concept should the project team evaluate for the proposed installation?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "TERMINAL_CONCEPTUAL_APPLICATION_TO_BUYER_QUESTION",
      fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
    };
  }

  const conservativeClass = resolveConservativeFallbackClass(input.claimClasses);

  if (conservativeClass === "LOCATION_FACT" || conservativeClass === "MARKET_ADOPTION") {
    return {
      claimClasses: input.claimClasses,
      originalText: input.text,
      canonicalText: null,
      disposition: "REMOVE",
      safeToTransform: true,
      ruleId: "OUTDOOR_SPHERE_CLASS_FALLBACK_REMOVE_LOCAL_ASSERTION",
      fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
    };
  }

  if (conservativeClass && ["PRODUCT_SPECIFICATION", "BRIGHTNESS", "PERFORMANCE"].includes(conservativeClass)) {
    return {
      claimClasses: input.claimClasses,
      originalText: input.text,
      canonicalText: "Which technical and performance specifications should the selected supplier confirm in writing for the proposed configuration?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "OUTDOOR_SPHERE_CLASS_FALLBACK_SPECIFICATION",
      fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
    };
  }

  if (conservativeClass && ["DURABILITY", "INGRESS_PROTECTION", "CLIMATE"].includes(conservativeClass)) {
    return {
      claimClasses: input.claimClasses,
      originalText: input.text,
      canonicalText: "What environmental exposure, protection, and durability requirements should the selected supplier and qualified professionals confirm for the proposed installation?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "OUTDOOR_SPHERE_CLASS_FALLBACK_ENVIRONMENT",
      fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
    };
  }

  if (conservativeClass && ["INTERACTIVITY", "REMOTE_MANAGEMENT"].includes(conservativeClass)) {
    return {
      claimClasses: input.claimClasses,
      originalText: input.text,
      canonicalText: "What control, connectivity, or interaction requirements should the project team confirm with the selected supplier for the proposed concept?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "OUTDOOR_SPHERE_CLASS_FALLBACK_INTERACTION",
      fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
    };
  }

  if (conservativeClass && ["INSTALLATION_SERVICE", "INSTALLATION_CAPABILITY"].includes(conservativeClass)) {
    return {
      claimClasses: input.claimClasses,
      originalText: input.text,
      canonicalText: "What installation responsibilities and site requirements should the project team confirm with the selected supplier and qualified professionals?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "OUTDOOR_SPHERE_CLASS_FALLBACK_INSTALLATION",
      fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
    };
  }

  if (conservativeClass && ["TRAINING", "SERVICE_AVAILABILITY", "SERVICE_CAPABILITY"].includes(conservativeClass)) {
    return {
      claimClasses: input.claimClasses,
      originalText: input.text,
      canonicalText: "What operational, training, maintenance, and support responsibilities should the selected supplier confirm for the proposed project?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "OUTDOOR_SPHERE_CLASS_FALLBACK_SERVICE",
      fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
    };
  }

  if (conservativeClass === "WARRANTY") {
    return {
      claimClasses: input.claimClasses,
      originalText: input.text,
      canonicalText: "Which warranty terms can the selected supplier confirm in writing for the proposed configuration?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "OUTDOOR_SPHERE_CLASS_FALLBACK_WARRANTY",
      fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
    };
  }

  if (conservativeClass === "PRICING") {
    return {
      claimClasses: input.claimClasses,
      originalText: input.text,
      canonicalText: "What pricing and project-cost information can the selected supplier confirm for the proposed configuration?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "OUTDOOR_SPHERE_CLASS_FALLBACK_PRICING",
      fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
    };
  }

  if (conservativeClass === "INVENTORY") {
    return {
      claimClasses: input.claimClasses,
      originalText: input.text,
      canonicalText: "What current availability and lead-time information can the selected supplier confirm for the proposed configuration?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "OUTDOOR_SPHERE_CLASS_FALLBACK_INVENTORY",
      fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
    };
  }

  return {
    claimClasses: input.claimClasses,
    originalText: input.text,
    canonicalText: "What capabilities should the project team confirm with the selected supplier for the proposed configuration?",
    disposition: "CONVERT_TO_BUYER_QUESTION",
    safeToTransform: true,
    ruleId: "OUTDOOR_SPHERE_CLASS_FALLBACK_CAPABILITY",
    fallbackPolicy: "OUTDOOR_SPHERE_STATE_SERVICE",
  };
}

function isCanonicalConceptualApplication(text: string): boolean {
  const normalized = normalizeText(text).toLowerCase();
  return normalized.startsWith("one possible concept a project team could consider is")
    || normalized.includes(" one possible concept a project team could consider is")
    || normalized.startsWith("organizations may evaluate spherical displays as a potential way to create:")
    || normalized.includes("organizations may evaluate spherical displays as a potential way to create:");
}

function transformationFor(text: string, claimClasses: readonly GlwReferenceClaimClass[], fallbackPolicy: GlwZeroAuthorityFallbackPolicy): GlwZeroAuthorityTransformation {
  if (claimClasses.includes("LOCATION_FACT") && /^[A-Z][A-Za-z .'-]+ is home to\b/.test(text)) {
    return { claimClasses, originalText: text, canonicalText: null, disposition: "REMOVE", safeToTransform: true, ruleId: "REMOVE_UNSUPPORTED_LOCAL_MARKET_ASSERTION", fallbackPolicy };
  }

  if (claimClasses.includes("INTERACTIVITY") && /^This allows for\b/i.test(text) && /\binteractive\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "Does the selected system support the interactive concept being considered, and what additional hardware or connectivity would be required, if any?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "CAPABILITY_ASSERTION_TO_SUPPLIER_QUESTION",
      fallbackPolicy,
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
      fallbackPolicy,
    };
  }

  if (claimClasses.includes("PRODUCT_CAPABILITY")
    && /^(?:Timeline|Schedule) (?:Mapping|Planning):\s*(?:Create|Develop|Build|Prepare) (?:a|the) project schedule\b/i.test(text)
    && /\b(?:deadlines?|milestones?)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "What project schedule and milestones should the project team confirm with the selected supplier for approvals, delivery, setup, content preparation, and any required rehearsals?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "PROJECT_SCHEDULE_GUIDANCE_TO_SUPPLIER_QUESTION",
      fallbackPolicy,
    };
  }

  if (claimClasses.includes("CLIMATE") && (
    /\badd unique planning challenges and opportunities\b/i.test(text)
    || /^Audience Comfort:\s*In winter months\b/i.test(text)
  )) {
    return { claimClasses, originalText: text, canonicalText: null, disposition: "REMOVE", safeToTransform: true, ruleId: "REMOVE_NONESSENTIAL_CLIMATE_ASSERTION", fallbackPolicy };
  }

  if (claimClasses.includes("CLIMATE")) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "What environmental conditions should the project team ask the selected supplier and qualified professionals to evaluate for the proposed installation?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "CLIMATE_ASSERTION_TO_BUYER_QUESTION",
      fallbackPolicy,
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
      fallbackPolicy,
    };
  }

  if (claimClasses.includes("PRICING") && /^Engage Early:\s*Begin supplier conversations\b/i.test(text)) {
    return { claimClasses, originalText: text, canonicalText: null, disposition: "REMOVE", safeToTransform: true, ruleId: "REMOVE_NONESSENTIAL_COST_PLANNING_ASSERTION", fallbackPolicy };
  }

  if (claimClasses.includes("PRICING") && /\b(?:pricing|price|costs?)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "What pricing and project-cost information can the selected supplier confirm for the proposed configuration?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "PRICING_ASSERTION_TO_BUYER_QUESTION",
      fallbackPolicy,
    };
  }

  if (claimClasses.includes("MARKET_ADOPTION") && /\b(?:trends?|adoption|growth|increasing use|popularity|market movement|industry direction|regional demand)\b/i.test(text)) {
    return { claimClasses, originalText: text, canonicalText: null, disposition: "REMOVE", safeToTransform: true, ruleId: "REMOVE_UNSUPPORTED_MARKET_ASSERTION", fallbackPolicy };
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
      fallbackPolicy,
    };
  }

  if (claimClasses.includes("PRODUCT_SPECIFICATION")
    && text.length > 120
    && /\b(?:Feature|Consideration|Criteria|Attribute|Factor|Aspect|Category)\b/i.test(text)
    && /\b(?:Form Factor|Viewing Directions?|Viewing Angles?|Visibility|Space Requirement|Content Creation|Audience Experience|Brand Impact|Installation Complexity)\b/i.test(text)
    && /\b(?:sphere|spherical|curved)\b/i.test(text)
    && /\b(?:flat|traditional|conventional)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: null,
      disposition: "REPLACE_WITH_EVALUATION_FRAMEWORK",
      safeToTransform: true,
      ruleId: "UNSUPPORTED_STRUCTURED_COMPARISON_TO_BUYER_EVALUATION_FRAMEWORK",
      fallbackPolicy,
    };
  }

  if (claimClasses.includes("PRODUCT_SPECIFICATION") && (
    /^Which content production approaches work best for\b/i.test(text)
    || /^Underestimating the importance of content planning\b/i.test(text)
    || /^Spherical, multidirectional$/i.test(text)
  )) {
    return { claimClasses, originalText: text, canonicalText: null, disposition: "REMOVE", safeToTransform: true, ruleId: "REMOVE_NONESSENTIAL_PRODUCT_ASSUMPTION", fallbackPolicy };
  }

  if (claimClasses.includes("PRODUCT_SPECIFICATION") && /^Explore our .+ solutions for additional product specifications, turnkey package details, and display options\.?$/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "Review the product page and ask the selected supplier which display options and project-planning information apply to the proposed configuration.",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "GENERIC_SPECIFICATION_CTA_TO_SUPPLIER_QUESTION",
      fallbackPolicy,
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
      fallbackPolicy,
    };
  }

  if (claimClasses.includes("PRODUCT_SPECIFICATION")
    && /\b360(?:°|-degree)\b/i.test(text)
    && /\b(?:engagement|viewing|visible|audiences?|presence|immersive|impacts?|accessibility)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "Spherical display geometry; confirm project-specific viewing directions and content requirements.",
      disposition: "CONVERT_TO_CONCEPTUAL_APPLICATION",
      safeToTransform: true,
      ruleId: "SPHERICAL_GEOMETRY_WITHOUT_ENGAGEMENT_CLAIM",
      fallbackPolicy,
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
      fallbackPolicy,
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
      fallbackPolicy,
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
      fallbackPolicy,
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
      fallbackPolicy,
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
      fallbackPolicy,
    };
  }

  if (claimClasses.includes("PRODUCT_CAPABILITY")
    && /^Content (?:Programming|Planning|Strategy):\s*(?:Which|What|How)\b[\s\S]*\?$/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "Content planning: What content approach should the project team review for the proposed display?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "CONTENT_PLANNING_BUYER_QUESTION_TO_NEUTRAL_EVALUATION",
      fallbackPolicy,
    };
  }

  if (claimClasses.includes("PRODUCT_SPECIFICATION")
    && /\b(?:digital sphere|spherical display|spherical|sphere)\b/i.test(text)
    && /\b(?:content|visuals?|content planning|content strategy|programming)\b/i.test(text)
    && (
      /\b360(?:°|-degree)\b/i.test(text)
      || /\b(?:custom\s+animated\s+loops?|coordinated\s+color\s+sequences?)\b/i.test(text)
    )
    && /\b(?:designed|leverage|requiring|requires?)\b/i.test(text)) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "Content planning: What content approach should the project team review for the spherical display, including project-specific viewing directions and any custom content requirements?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "SPHERICAL_CONTENT_PLANNING_ASSERTION_TO_BUYER_QUESTION",
      fallbackPolicy,
    };
  }

  if (claimClasses.includes("PRODUCT_SPECIFICATION")
    && /\b(?:clarify|confirm|request|determine|what)\b/i.test(text)
    && /\bdocumentation\b/i.test(text)
    && /\btechnical\s+specifications?\b/i.test(text)
    && /\binstallation\s+plans?\b/i.test(text)
    && /\bcode\s*compliance\b/i.test(text)
  ) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "What technical specifications, installation documentation, and code-compliance information should the project team request from the selected supplier and qualified professionals for the proposed installation?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "PROJECT_DOCUMENTATION_DIRECTIVE_TO_BUYER_QUESTION",
      fallbackPolicy,
    };
  }

  if (fallbackPolicy === "OUTDOOR_SPHERE_STATE_SERVICE"
    && isCanonicalConceptualApplication(text)
    && claimClasses.some((claimClass) => ["INTERACTIVITY", "PRODUCT_CAPABILITY", "PRODUCT_SPECIFICATION", "REMOTE_MANAGEMENT"].includes(claimClass))) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "What visual or experience concept should the project team evaluate for the proposed installation?",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "TERMINAL_CONCEPTUAL_APPLICATION_TO_BUYER_QUESTION",
      fallbackPolicy,
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
      fallbackPolicy,
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
      fallbackPolicy,
    };
  }

  const interactionActor = /\b(?:visitors?|users?|audiences?|participants?|attendees?|customers?|people)\b/i;
  const interactionAction = /\b(?:influence|control|drive|trigger|activate|interact(?:ing)?|provide input)\b/i;
  const assertedInteractiveCapability = (
    /^(?:Hosting|Offering|Providing|Enabling|Supporting|Creating)\b/i.test(text)
      && interactionActor.test(text)
      && interactionAction.test(text)
  ) || (
    interactionActor.test(text)
      && /\b(?:can|could|may|will|would)\b/i.test(text)
      && interactionAction.test(text)
  ) || (
    /^(?:Interactive\b|[A-Z][A-Za-z -]{1,80}\b)/i.test(text)
      && /\b(?:can|could|may|will|would|allow|enable|support|provide|drive|trigger|control|influence)\b/i.test(text)
      && interactionAction.test(text)
  );
  if (claimClasses.includes("INTERACTIVITY") && assertedInteractiveCapability) {
    return {
      claimClasses,
      originalText: text,
      canonicalText: "If an interactive experience is being considered, confirm with the selected supplier whether the selected system supports the proposed interaction and what hardware, software, connectivity, and integration requirements apply.",
      disposition: "CONVERT_TO_BUYER_QUESTION",
      safeToTransform: true,
      ruleId: "INTERACTIVITY_ASSERTION_TO_CONDITIONAL_VERIFICATION",
      fallbackPolicy,
    };
  }

  if (fallbackPolicy === "OUTDOOR_SPHERE_STATE_SERVICE") {
    return outdoorSphereFallbackTransformation({ text, claimClasses });
  }

  return { claimClasses, originalText: text, canonicalText: null, disposition: "BLOCK", safeToTransform: false, ruleId: "AMBIGUOUS_PROTECTED_ASSERTION", fallbackPolicy };
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

function applyAcrossTextNodes(
  $: ReturnType<typeof cheerio.load>,
  transformation: GlwZeroAuthorityTransformation,
): string | null {
  type TraversableNode = { type?: string; data?: string; children?: TraversableNode[] };
  const nodes: TraversableNode[] = [];
  const collect = (node: TraversableNode): void => {
    if (node.type === "text") nodes.push(node);
    for (const child of node.children ?? []) collect(child);
  };
  collect($.root()[0] as unknown as TraversableNode);
  const matches: Array<{ first: typeof nodes[number]; last: typeof nodes[number]; before: string; after: string }> = [];
  for (let start = 0; start < nodes.length - 1; start += 1) {
    const firstText = normalizeText((nodes[start] as typeof nodes[number] & { data?: string }).data ?? "");
    if (!firstText) continue;
    let combined = firstText;
    for (let end = start + 1; end < nodes.length; end += 1) {
      const lastText = normalizeText((nodes[end] as typeof nodes[number] & { data?: string }).data ?? "");
      if (!lastText) continue;
      combined = `${combined} ${lastText}`;
      const offset = combined.indexOf(transformation.originalText);
      const matchEnd = offset + transformation.originalText.length;
      if (offset >= 0 && offset <= firstText.length && matchEnd > combined.length - lastText.length - 1) {
        matches.push({
          first: nodes[start],
          last: nodes[end],
          before: firstText.slice(0, offset).trim(),
          after: lastText.slice(matchEnd - (combined.length - lastText.length)).trim(),
        });
        break;
      }
      if (combined.length > transformation.originalText.length + firstText.length + 500) break;
    }
  }
  if (matches.length !== 1) return null;
  const match = matches[0];
  const firstNode = match.first as typeof match.first & { data?: string };
  const lastNode = match.last as typeof match.last & { data?: string };
  firstNode.data = [match.before, transformation.canonicalText].filter(Boolean).join(" ");
  let between = false;
  for (const node of nodes) {
    if (node === match.first) { between = true; continue; }
    if (!between) continue;
    if (node === match.last) { lastNode.data = match.after; break; }
    (node as typeof node & { data?: string }).data = "";
  }
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
    const textNodes = applyAcrossTextNodes($, transformation);
    if (textNodes !== null) return textNodes;
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
  fallbackPolicy?: GlwZeroAuthorityFallbackPolicy;
  authority?: {
    references: readonly { referenceId: string; role: string }[];
    authoritativeFactReferenceIds: readonly string[];
    supportedClaimMappings: readonly GlwProtectedClaimAuthorityMapping[];
  } | null;
}): {
  ok: boolean;
  rawArtifact: GlwGeneratedDraftArtifact;
  canonicalizedArtifact: GlwGeneratedDraftArtifact | null;
  receipt: GlwZeroAuthorityCanonicalizationReceipt;
} {
  const rawArtifact = structuredClone(input.rawArtifact);
  const fallbackPolicy = input.fallbackPolicy ?? "STRICT";
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
        fallbackPolicy,
        transformations: [],
        blockedClaims: ["ZERO_AUTHORITY_POLICY_NOT_APPLICABLE"],
        consumesN8nExecution: false,
        modelInvoked: false,
      },
    };
  }

  const transformations: GlwZeroAuthorityTransformation[] = [];
  const blockedClaims: string[] = [];
  const passes: Array<{
    pass: number;
    inputHash: string;
    unsupportedBefore: readonly string[];
    transformations: readonly GlwZeroAuthorityTransformation[];
    outputHash: string;
    unsupportedAfter: readonly string[];
  }> = [];

  let contentHtml = rawArtifact.contentHtml;
  const authority = input.authority ?? null;
  const maxPasses = fallbackPolicy === "OUTDOOR_SPHERE_STATE_SERVICE" && authority ? 3 : 1;
  const seenOutputHashes = new Set<string>();
  let currentFindings = input.findings;

  const applyCanonicalizationPass = (inputPass: {
    html: string;
    passTransformations: GlwZeroAuthorityTransformation[];
  }): { html: string; failed: boolean } => {
    let nextHtml = inputPass.html;
    const applicationOrder = [...inputPass.passTransformations].sort((left, right) => {
      const leftComparison = left.disposition === "REPLACE_WITH_EVALUATION_FRAMEWORK" ? 0 : 1;
      const rightComparison = right.disposition === "REPLACE_WITH_EVALUATION_FRAMEWORK" ? 0 : 1;
      const leftRemoval = left.disposition === "REMOVE" ? 1 : 0;
      const rightRemoval = right.disposition === "REMOVE" ? 1 : 0;
      return leftComparison - rightComparison || leftRemoval - rightRemoval || left.originalText.length - right.originalText.length;
    });
    for (const transformation of applicationOrder) {
      const comparisonReplacement = inputPass.passTransformations.find((entry) => entry.disposition === "REPLACE_WITH_EVALUATION_FRAMEWORK");
      if (comparisonReplacement && transformation !== comparisonReplacement && comparisonReplacement.originalText.includes(transformation.originalText)) continue;
      const next = applyTransformation(nextHtml, transformation);
      if (next === null) {
        blockedClaims.push(transformation.originalText);
        return { html: nextHtml, failed: true };
      }
      nextHtml = next;
    }

    const $ = cheerio.load(nextHtml, null, false);
    const supplierQuestions = $("p,li").filter((_, element) => /selected supplier|supplier confirm/i.test($(element).text())).length;
    const repetitiveQuestion = "Does the supplier confirm that content can be customized and managed to suit these environmental factors?";
    if (supplierQuestions > 5 && nextHtml.includes(repetitiveQuestion)) {
      const copyQualityTransformation: GlwZeroAuthorityTransformation = {
        claimClasses: [],
        originalText: repetitiveQuestion,
        canonicalText: "What content-management requirements should the project team document for the proposed display?",
        disposition: "CONVERT_TO_BUYER_QUESTION",
        safeToTransform: true,
        ruleId: "REDUCE_SUPPLIER_QUESTION_REPETITION",
        fallbackPolicy,
      };
      const next = applyTransformation(nextHtml, copyQualityTransformation);
      if (next === null) {
        blockedClaims.push(repetitiveQuestion);
        return { html: nextHtml, failed: true };
      }
      transformations.push(copyQualityTransformation);
      inputPass.passTransformations.push(copyQualityTransformation);
      nextHtml = next;
    }

    return { html: nextHtml, failed: false };
  };

  for (let pass = 1; pass <= maxPasses; pass += 1) {
    const unsupportedMap = uniqueBlockingSpans(currentFindings);
    const unsupportedBefore = [...unsupportedMap.keys()];
    if (unsupportedBefore.length === 0) break;

    const passTransformations = [...unsupportedMap.entries()].map(([text, claimClasses]) =>
      transformationFor(text, claimClasses, fallbackPolicy));
    transformations.push(...passTransformations);

    for (const candidate of passTransformations) {
      if (!candidate.safeToTransform) {
        blockedClaims.push(candidate.originalText);
      }
    }
    if (blockedClaims.length > 0) {
      const inputHash = sha256(contentHtml);
      passes.push({
        pass,
        inputHash,
        unsupportedBefore,
        transformations: passTransformations,
        outputHash: inputHash,
        unsupportedAfter: unsupportedBefore,
      });
      break;
    }

    const inputHash = sha256(contentHtml);
    const applied = applyCanonicalizationPass({ html: contentHtml, passTransformations });
    contentHtml = applied.html;
    const outputHash = sha256(contentHtml);
    const post = authority
      ? evaluateGlwReferenceClaimAuthority({
          artifact: { ...rawArtifact, contentHtml },
          authority,
        })
      : { findings: [] as GlwClaimAuthorityFinding[] };
    const unsupportedAfter = authority
      ? post.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED").map((finding) => finding.claimText)
      : [];

    passes.push({
      pass,
      inputHash,
      unsupportedBefore,
      transformations: passTransformations,
      outputHash,
      unsupportedAfter,
    });

    if (applied.failed) break;

    if (unsupportedAfter.length === 0) {
      break;
    }

    if (outputHash === inputHash || seenOutputHashes.has(outputHash)) {
      for (const claim of unsupportedAfter) {
        if (!blockedClaims.includes(claim)) blockedClaims.push(claim);
      }
      break;
    }

    seenOutputHashes.add(outputHash);

    if (pass === maxPasses) {
      for (const claim of unsupportedAfter) {
        if (!blockedClaims.includes(claim)) blockedClaims.push(claim);
      }
      break;
    }

    currentFindings = authority ? post.findings : currentFindings;
  }

  if (blockedClaims.length === 0) {
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
        fallbackPolicy,
      };
      const next = applyTransformation(contentHtml, copyQualityTransformation);
      if (next === null) blockedClaims.push(repetitiveQuestion);
      else {
        transformations.push(copyQualityTransformation);
        contentHtml = next;
      }
    }
  }

  const canonicalizedArtifact = { ...rawArtifact, contentHtml };
  const finalizedArtifact = blockedClaims.length === 0 ? canonicalizedArtifact : null;
  const canonicalizedArtifactSha256 = finalizedArtifact ? sha256(finalizedArtifact.contentHtml) : null;

  return {
    ok: Boolean(finalizedArtifact),
    rawArtifact,
    canonicalizedArtifact: finalizedArtifact,
    receipt: {
      receiptId: `glw-zero-authority-${rawArtifactSha256.slice(0, 12)}-${canonicalizedArtifactSha256?.slice(0, 12) ?? "blocked"}`,
      policyVersion: GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_VERSION,
      policyFingerprint: GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_FINGERPRINT,
      rawArtifactSha256,
      canonicalizedArtifactSha256,
      authoritativeFactReferenceCount: 0,
      fallbackPolicy,
      transformations,
      ...(passes.length > 0 ? { passes } : {}),
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
