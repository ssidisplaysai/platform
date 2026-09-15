import { fingerprintGlwAuthority, GLW_REFERENCE_CLAIM_CLASSES, GLW_REFERENCE_QA_POLICY_VERSION } from "./reference-claim-authority";
import { GLW_REFERENCE_CLAIM_DISPOSITION_VERSION } from "./reference-claim-disposition";
import { GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_VERSION } from "./reference-generation-claim-contract-version";

export { GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_VERSION } from "./reference-generation-claim-contract-version";

export const GLW_REFERENCE_GENERATION_CLAIM_CONTRACT = {
  version: GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_VERSION,
  qaPolicyVersion: GLW_REFERENCE_QA_POLICY_VERSION,
  rules: {
    supportedFact: "State a fact only when the supplied authoritative sources explicitly support it. Do not extend a source beyond what it says.",
    conceptualApplication: "Describe plausible applications only as concepts using phrases such as can be considered, may be suitable, potential application, organizations may evaluate, or possible use case. Never present a concept as an existing installation, adoption, customer, deployment, capability, or result.",
    unsupportedFact: "Do not generate an unsupported factual claim. Omit it rather than infer it from general knowledge, a photograph, a filename, or marketing context.",
    unknownFact: "When a fact is unknown, omit it or express it only as a buyer question or planning consideration that requires confirmation.",
    visualReference: "A visual or content reference supplies editorial or visual direction only. It does not prove ownership, supplier identity, product specifications, customer relationships, installation responsibility, technical capability, or results unless separately classified as authoritative_fact.",
  },
  prohibitedWithoutExplicitAuthority: GLW_REFERENCE_CLAIM_CLASSES,
  unsupportedExamples: [
    "existing deployments, installations, customers, or local adoption",
    "weather resistance, ingress protection, brightness, durability, or performance",
    "certifications, warranties, service coverage, inventory, pricing, or availability",
    "monitoring, diagnostics, sensors, software, interactivity, or installation services",
  ],
  requiredProductLink: {
    anchorText: "Outdoor Digital Sphere",
    href: "/outdoor-digital-sphere/",
  },
} as const;

export const GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_FINGERPRINT = fingerprintGlwAuthority(GLW_REFERENCE_GENERATION_CLAIM_CONTRACT);
export const GLW_REFERENCE_CLAIM_AUTHORITY_FINGERPRINT = fingerprintGlwAuthority({
  policyVersion: GLW_REFERENCE_QA_POLICY_VERSION,
  dispositionVersion: GLW_REFERENCE_CLAIM_DISPOSITION_VERSION,
  claimClasses: GLW_REFERENCE_CLAIM_CLASSES,
});

export function serializeGlwReferenceGenerationClaimContract(): string {
  return [
    `GENERATION CLAIM CONTRACT (${GLW_REFERENCE_GENERATION_CLAIM_CONTRACT_VERSION})`,
    `SUPPORTED FACT: ${GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.rules.supportedFact}`,
    `CONCEPTUAL APPLICATION: ${GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.rules.conceptualApplication}`,
    `UNSUPPORTED FACT: ${GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.rules.unsupportedFact}`,
    `UNKNOWN: ${GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.rules.unknownFact}`,
    `VISUAL/CONTENT REFERENCE: ${GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.rules.visualReference}`,
    `PROHIBITED WITHOUT EXPLICIT AUTHORITY: ${GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.prohibitedWithoutExplicitAuthority.join(", ")}`,
    `UNSUPPORTED EXAMPLES: ${GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.unsupportedExamples.join("; ")}`,
    `REQUIRED PRODUCT LINK: ${GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.requiredProductLink.anchorText} -> ${GLW_REFERENCE_GENERATION_CLAIM_CONTRACT.requiredProductLink.href}`,
  ].join("\n");
}
