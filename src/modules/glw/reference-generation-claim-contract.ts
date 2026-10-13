import { fingerprintGlwAuthority, GLW_REFERENCE_CLAIM_CLASSES, GLW_REFERENCE_QA_POLICY_VERSION } from "./reference-claim-authority";
import { GLW_REFERENCE_CLAIM_DISPOSITION_VERSION } from "./reference-claim-disposition";
import { GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_VERSION } from "./reference-generation-claim-contract-version";
import { GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_VERSION } from "./state-localization-contamination";

export { GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_VERSION } from "./reference-generation-claim-contract-version";

export type GlwReferenceGenerationRequiredProductLink = {
  anchorText: string;
  href: string;
};

export type GlwReferenceGenerationClaimContract = {
  version: string;
  qaPolicyVersion: string;
  rules: {
    supportedFact: string;
    conceptualApplication: string;
    unsupportedFact: string;
    unknownFact: string;
    visualReference: string;
    sourceToClaimMapping: string;
    navigationAuthority: string;
    buyerQuestionFallback: string;
    trendAuthority: string;
    genericProductKnowledge: string;
    headingSeparation: string;
  };
  sourceToClaimMapping: {
    requiredForProtectedFacts: true;
    requiredFields: ["authoritativeFactReferenceId", "supportedAssertion"];
    noAuthorityMappingNoProtectedFact: true;
  };
  productAuthority: {
    scope: "NAVIGATION_AND_PRODUCT_IDENTITY_ONLY";
    establishes: string[];
    doesNotEstablish: string[];
  };
  buyerQuestionFallback: {
    requiredPrefixes: string[];
  };
  prohibitedWithoutExplicitAuthority: readonly string[];
  unsupportedExamples: string[];
  requiredProductLink: GlwReferenceGenerationRequiredProductLink | null;
  localizationPolicy: {
    version: string;
    expectedStateRequired: true;
    unauthorizedNonTargetStateContextProhibited: true;
    navigationAndMetadataExcluded: true;
    authorizedComparisonRequiresExplicitStateCode: true;
  };
};

export const GLW_REFERENCE_GENERATION_CLAIM_CONTRACT: GlwReferenceGenerationClaimContract = {
  version: GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_VERSION,
  qaPolicyVersion: GLW_REFERENCE_QA_POLICY_VERSION,
  rules: {
    supportedFact: "State a fact only when the supplied authoritative sources explicitly support it. Do not extend a source beyond what it says.",
    conceptualApplication: "Describe plausible applications only as concepts using phrases such as can be considered, may be suitable, potential application, organizations may evaluate, or possible use case. Never present a concept as an existing installation, adoption, customer, deployment, capability, or result.",
    unsupportedFact: "Do not generate an unsupported factual claim. Omit it rather than infer it from general knowledge, a photograph, a filename, or marketing context.",
    unknownFact: "When a fact is unknown, omit it or express it only as a buyer question or planning consideration that requires confirmation.",
    visualReference: "A visual or content reference supplies editorial or visual direction only. It does not prove ownership, supplier identity, product specifications, customer relationships, installation responsibility, technical capability, or results unless separately classified as authoritative_fact.",
    sourceToClaimMapping: "Every protected factual sentence must map to an authoritativeFactReferenceId and an assertion explicitly supported by that source. Without both values, omit the factual sentence.",
    navigationAuthority: "Canonical product authority establishes product identity, canonical internal link, and canonical anchor only. It does not establish any product specification, capability, performance, installation, service, warranty, pricing, or availability fact.",
    buyerQuestionFallback: "When authority is unavailable, express useful planning guidance only as an explicit buyer question beginning with What, Which, Does the selected supplier confirm, or Can the selected supplier confirm.",
    trendAuthority: "Omit trends, adoption, growth, increasing use, popularity, market movement, industry direction, and regional demand unless each factual assertion maps to explicit market authority. A conceptual application section may replace the omitted section.",
    genericProductKnowledge: "General product knowledge is not authority. Do not infer capabilities, requirements, components, controls, connectivity, services, or performance from the product category.",
    headingSeparation: "Keep headings structurally separate from sentences. A heading must not be prefixed to the first sentence or list item in generated text.",
  },
  sourceToClaimMapping: {
    requiredForProtectedFacts: true,
    requiredFields: ["authoritativeFactReferenceId", "supportedAssertion"],
    noAuthorityMappingNoProtectedFact: true,
  },
  productAuthority: {
    scope: "NAVIGATION_AND_PRODUCT_IDENTITY_ONLY",
    establishes: ["product identity", "canonical internal link", "canonical anchor"],
    doesNotEstablish: [
      "weather resistance", "durability", "sensors", "interactivity", "networking",
      "controls", "brightness", "specifications", "service", "installation", "warranty",
      "pricing", "performance", "remote management",
    ],
  },
  buyerQuestionFallback: {
    requiredPrefixes: ["What", "Which", "Does the selected supplier confirm", "Can the selected supplier confirm"],
  },
  prohibitedWithoutExplicitAuthority: GLW_REFERENCE_CLAIM_CLASSES,
  unsupportedExamples: [
    "existing deployments, installations, customers, or local adoption",
    "weather resistance, ingress protection, brightness, durability, or performance",
    "certifications, warranties, service coverage, inventory, pricing, or availability",
    "monitoring, diagnostics, sensors, software, interactivity, or installation services",
  ],
  requiredProductLink: null,
  localizationPolicy: {
    version: GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_VERSION,
    expectedStateRequired: true,
    unauthorizedNonTargetStateContextProhibited: true,
    navigationAndMetadataExcluded: true,
    authorizedComparisonRequiresExplicitStateCode: true,
  },
};

export function buildGlwReferenceGenerationClaimContract(input?: {
  requiredProductLink?: GlwReferenceGenerationRequiredProductLink | null;
}): GlwReferenceGenerationClaimContract {
  const requiredProductLink = input?.requiredProductLink ?? null;
  return {
    ...GLW_REFERENCE_GENERATION_CLAIM_CONTRACT,
    rules: {
      ...GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.rules,
    },
    sourceToClaimMapping: {
      ...GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.sourceToClaimMapping,
      requiredFields: [...GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.sourceToClaimMapping.requiredFields] as ["authoritativeFactReferenceId", "supportedAssertion"],
    },
    productAuthority: {
      ...GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.productAuthority,
      establishes: [...GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.productAuthority.establishes],
      doesNotEstablish: [...GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.productAuthority.doesNotEstablish],
    },
    buyerQuestionFallback: {
      ...GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.buyerQuestionFallback,
      requiredPrefixes: [...GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.buyerQuestionFallback.requiredPrefixes],
    },
    prohibitedWithoutExplicitAuthority: [...GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.prohibitedWithoutExplicitAuthority],
    unsupportedExamples: [...GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.unsupportedExamples],
    requiredProductLink: requiredProductLink
      ? {
          anchorText: requiredProductLink.anchorText,
          href: requiredProductLink.href,
        }
      : null,
    localizationPolicy: {
      ...GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.localizationPolicy,
    },
  };
}

export const GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT = fingerprintGlwAuthority(GLW_REFERENCE_GENERATION_CLAIM_CONTRACT);
export const GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT = fingerprintGlwAuthority({
  policyVersion: GLW_REFERENCE_QA_POLICY_VERSION,
  dispositionVersion: GLW_REFERENCE_CLAIM_DISPOSITION_VERSION,
  claimClasses: GLW_REFERENCE_CLAIM_CLASSES,
});
export const GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_FINGERPRINT = fingerprintGlwAuthority({
  version: GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_VERSION,
  expectedStateRequired: true,
  nonTargetTargetContextBlocked: true,
  navigationAndLinksExcluded: true,
  authorizedComparisonSupported: true,
});

export function serializeGlwReferenceGenerationClaimContract(
  contract: GlwReferenceGenerationClaimContract = GLW_REFERENCE_GENERATION_CLAIM_CONTRACT,
): string {
  return [
    `GENERATION CLAIM CONTRACT (${GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_VERSION})`,
    `SUPPORTED FACT: ${contract.rules.supportedFact}`,
    `CONCEPTUAL APPLICATION: ${contract.rules.conceptualApplication}`,
    `UNSUPPORTED FACT: ${contract.rules.unsupportedFact}`,
    `UNKNOWN: ${contract.rules.unknownFact}`,
    `VISUAL/CONTENT REFERENCE: ${contract.rules.visualReference}`,
    `SOURCE-TO-CLAIM MAPPING: ${contract.rules.sourceToClaimMapping}`,
    `PRODUCT AUTHORITY: ${contract.rules.navigationAuthority}`,
    `BUYER QUESTION FALLBACK: ${contract.rules.buyerQuestionFallback}`,
    `TREND AUTHORITY: ${contract.rules.trendAuthority}`,
    `GENERIC PRODUCT KNOWLEDGE: ${contract.rules.genericProductKnowledge}`,
    `HEADING SEPARATION: ${contract.rules.headingSeparation}`,
    `PROHIBITED WITHOUT EXPLICIT AUTHORITY: ${contract.prohibitedWithoutExplicitAuthority.join(", ")}`,
    `UNSUPPORTED EXAMPLES: ${contract.unsupportedExamples.join("; ")}`,
    `REQUIRED PRODUCT LINK: ${contract.requiredProductLink ? `${contract.requiredProductLink.anchorText} -> ${contract.requiredProductLink.href}` : "NONE"}`,
  ].join("\n");
}
