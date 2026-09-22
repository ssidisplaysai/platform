import "server-only";

import { getGlwCampaignKnowledgePack } from "./campaign-reference-repository";
import { listGlwCampaigns } from "./campaign-repository";
import {
  buildGlwReferenceGenerationClaimContract,
  serializeGlwReferenceGenerationClaimContract,
  type GlwReferenceGenerationClaimContract,
} from "./reference-generation-claim-contract";
import type { GlwReferenceClaimClass } from "./reference-claim-authority";
import { resolveGlwProductAuthority } from "./site-internal-link-authority";

export type GlwCampaignGenerationContext = {
  campaignId: string;
  referencePage: boolean;
};

export type GlwResolvedCampaignGenerationContext = {
  campaignId: string;
  additionalInstructions: string;
  imageDirection: string;
  claimContract: GlwReferenceGenerationClaimContract;
  referenceAuthority: {
    references: ReadonlyArray<{ referenceId: string; fileName: string; role: string; scope: string }>;
    authoritativeFactReferenceIds: readonly string[];
    visualOrContentReferenceIds: readonly string[];
    supportedClaimMappings: ReadonlyArray<{
      authoritativeFactReferenceId: string;
      claimClass: GlwReferenceClaimClass;
      supportedAssertion: string;
    }>;
  };
};

export const GLW_REFERENCE_V1_1_INSTRUCTION_GUARDRAILS = [
  "V1.1 FACTUAL AUTHORITY OVERRIDE — these rules control if earlier campaign guidance conflicts:",
  "A required topic or section never requires a factual answer. Every protected factual sentence must identify an authoritativeFactReferenceId and reproduce only a supported assertion mapped to that source. If no mapping exists, omit the factual assertion.",
  "Canonical product authority is navigation and product-identity authority only. A product link never proves specifications, weather resistance, durability, sensors, interactivity, networking, controls, brightness, performance, installation, service, warranty, pricing, or remote management.",
  "When useful guidance lacks factual authority, write a direct buyer question beginning with What, Which, Does the selected supplier confirm, or Can the selected supplier confirm.",
  "Conceptual applications must use explicit framing such as could be considered, a project team may explore, one possible concept, or ask whether the selected system supports. Never use the sphere supports, the system includes, the ability to, requires sensors, or provides remote management without a valid source mapping.",
  "Omit Trends, Adoption, Growth, Increasing Use, Popularity, Market Movement, Industry Direction, and Regional Demand headings or assertions unless mapped market authority exists. Replace them only with a clearly conceptual planning or application section.",
  "Treat generic product knowledge as unsupported. Keep every heading in its own semantic HTML heading element and begin body sentences separately.",
].join("\n");

export function buildGlwEffectiveCampaignInstructions(instructions: string): string {
  return [instructions.trim(), GLW_REFERENCE_V1_1_INSTRUCTION_GUARDRAILS].filter(Boolean).join("\n\n");
}

export function resolveGlwCampaignGenerationContext(
  input: GlwCampaignGenerationContext | null | undefined,
): GlwResolvedCampaignGenerationContext | null {
  if (!input?.campaignId) return null;
  const pack = getGlwCampaignKnowledgePack(input.campaignId);
  const instructions = pack?.instructions.trim() ?? "";
  if (!pack || !instructions) return null;

  const visualReferences = pack.references.filter((reference) =>
    reference.role === "product_image" || reference.role === "image_style",
  );
  const visualInventory = visualReferences.length
    ? visualReferences.map((reference) => `${reference.role.replaceAll("_", " ")}: ${reference.fileName}`).join("; ")
    : "No campaign visual references are classified for image direction.";
  const effectiveInstructions = buildGlwEffectiveCampaignInstructions(instructions);
  const campaign = listGlwCampaigns().find((candidate) => candidate.campaignId === input.campaignId) ?? null;
  const requiredProductLink = campaign
    ? resolveGlwProductAuthority({
        organizationId: campaign.organizationId,
        siteId: campaign.siteId,
        productId: campaign.productId,
      })
    : null;
  const claimContract = buildGlwReferenceGenerationClaimContract({
    requiredProductLink: requiredProductLink
      ? {
          anchorText: requiredProductLink.anchorText,
          href: requiredProductLink.path,
        }
      : null,
  });

  return {
    campaignId: input.campaignId,
    additionalInstructions: [
      input.referencePage
        ? "CAMPAIGN REFERENCE PAGE — APPROVED INSTRUCTIONS:"
        : "CAMPAIGN PRODUCTION PAGE — APPROVED INSTRUCTIONS:",
      effectiveInstructions,
      input.referencePage
        ? "This is one editorial reference page only. Keep WordPress status draft and do not imply campaign activation."
        : "This page is part of the approved production campaign. Follow the approved reference, preserve factual accuracy and campaign consistency, and do not acquire publication authority from these instructions.",
      serializeGlwReferenceGenerationClaimContract(claimContract),
    ].join("\n\n"),
    imageDirection: [
      "Follow the approved campaign instructions when composing the featured image.",
      `Campaign visual reference inventory: ${visualInventory}`,
      "Reference filenames and classifications provide visual direction only; do not infer unsupported product specifications or claims from them.",
    ].join(" "),
    claimContract,
    referenceAuthority: {
      references: pack.references.map((reference) => ({
        referenceId: reference.referenceId,
        fileName: reference.fileName,
        role: reference.role,
        scope: reference.scope,
      })),
      authoritativeFactReferenceIds: pack.references.filter((reference) => reference.role === "authoritative_fact").map((reference) => reference.referenceId),
      visualOrContentReferenceIds: pack.references.filter((reference) => reference.role !== "authoritative_fact").map((reference) => reference.referenceId),
      supportedClaimMappings: pack.references.flatMap((reference) =>
        reference.role === "authoritative_fact"
          ? (reference.supportedAssertions ?? []).map((supported) => ({
              authoritativeFactReferenceId: reference.referenceId,
              claimClass: supported.claimClass,
              supportedAssertion: supported.assertion,
            }))
          : []),
    },
  };
}
