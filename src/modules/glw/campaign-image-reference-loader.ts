import "server-only";

import { readFileSync } from "node:fs";
import { getGlwCampaignKnowledgePack } from "./campaign-reference-repository";

export type GlwCampaignImageReference = {
  fileName: string;
  mediaType: string;
  bytes: Buffer;
  role: "product_image" | "image_style";
};

export function loadGlwCampaignImageReferences(campaignId: string): readonly GlwCampaignImageReference[] {
  const pack = getGlwCampaignKnowledgePack(campaignId);
  if (!pack) return [];

  return pack.references
    .filter((reference): reference is typeof reference & { role: "product_image" | "image_style" } =>
      reference.kind === "image"
      && (reference.role === "product_image" || reference.role === "image_style"),
    )
    .slice(0, 4)
    .map((reference) => ({
      fileName: reference.fileName,
      mediaType: reference.mediaType || "image/jpeg",
      bytes: readFileSync(reference.storagePath),
      role: reference.role,
    }));
}
