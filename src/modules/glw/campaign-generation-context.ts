import "server-only";

import { getGlwCampaignKnowledgePack } from "./campaign-reference-repository";

export type GlwCampaignGenerationContext = {
  campaignId: string;
  referencePage: true;
};

export type GlwResolvedCampaignGenerationContext = {
  campaignId: string;
  additionalInstructions: string;
  imageDirection: string;
};

export function resolveGlwCampaignGenerationContext(
  input: GlwCampaignGenerationContext | null | undefined,
): GlwResolvedCampaignGenerationContext | null {
  if (!input?.campaignId || input.referencePage !== true) return null;
  const pack = getGlwCampaignKnowledgePack(input.campaignId);
  const instructions = pack?.instructions.trim() ?? "";
  if (!pack || !instructions) return null;

  const visualReferences = pack.references.filter((reference) =>
    reference.role === "product_image" || reference.role === "image_style",
  );
  const visualInventory = visualReferences.length
    ? visualReferences.map((reference) => `${reference.role.replaceAll("_", " ")}: ${reference.fileName}`).join("; ")
    : "No campaign visual references are classified for image direction.";

  return {
    campaignId: input.campaignId,
    additionalInstructions: [
      "CAMPAIGN REFERENCE PAGE — APPROVED INSTRUCTIONS:",
      instructions,
      "This is one editorial reference page only. Keep WordPress status draft and do not imply campaign activation.",
    ].join("\n\n"),
    imageDirection: [
      "Follow the approved campaign instructions when composing the featured image.",
      `Campaign visual reference inventory: ${visualInventory}`,
      "Reference filenames and classifications provide visual direction only; do not infer unsupported product specifications or claims from them.",
    ].join(" "),
  };
}
