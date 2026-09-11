import "server-only";

import sharp from "sharp";
import type { GlwLocalReferenceDraft } from "./campaign-local-reference-repository";

const SOURCE_ASSET_URL = "https://projectorenclosure.com/wp-content/uploads/2024/03/Integrator-scaled-1.webp";
const SOURCE_ASSET_REFERENCE = "wordpress-media:10757";

export type GeneratedProjectorReferenceVisual = {
  bytes: Buffer;
  mimeType: "image/jpeg";
  generationPrompt: string;
  visualBrief: string;
  sourceAssetReference: string;
  altText: string;
};

export async function generateProjectorEnclosureReferenceVisual(input: {
  reference: GlwLocalReferenceDraft;
  ownerInstructions?: string;
  fetcher?: typeof fetch;
}): Promise<GeneratedProjectorReferenceVisual> {
  if (
    input.reference.organizationId !== "ssi"
    || input.reference.siteId !== "site-ssi-projectorenclosure"
    || input.reference.productId !== "prod-ssi-fan-cooled-projector-enclosures"
    || input.reference.citySlug !== "austin"
  ) throw new Error("PROJECTOR_REFERENCE_IMAGE_SCOPE_INVALID");

  const prompt = [
    "Create a professional editorial product/application visual for a Fan Cooled Projector Enclosures city-service page.",
    "Use the approved ProjectorEnclosure owner asset as the exact product source and preserve its visible enclosure appearance.",
    "Present it as a neutral commercial AV product visual, not documentary evidence of an Austin customer, installation, facility, or completed project.",
    "Do not add logos, readable text, people, projector model claims, dimensions, certifications, ratings, environmental claims, landmarks, or competitor imagery.",
    input.ownerInstructions?.trim() ? `Owner visual direction: ${input.ownerInstructions.trim()}` : "",
  ].filter(Boolean).join("\n\n");
  const visualBrief = "Wide editorial product visual featuring the approved fan-cooled projector enclosure, with a subdued neutral treatment and no location-specific evidence.";
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(SOURCE_ASSET_URL, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`PROJECTOR_REFERENCE_SOURCE_READ_FAILED:${response.status}`);
  const source = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(source).metadata();
  if (metadata.format !== "webp" || metadata.width !== 2560 || metadata.height !== 1152) {
    throw new Error("PROJECTOR_REFERENCE_SOURCE_IDENTITY_MISMATCH");
  }

  const background = await sharp(source)
    .resize(1536, 1024, { fit: "cover", position: "centre" })
    .blur(28)
    .modulate({ brightness: 0.55, saturation: 0.35 })
    .jpeg({ quality: 88 })
    .toBuffer();
  const foreground = await sharp(source)
    .resize(1280, 576, { fit: "cover", position: "centre" })
    .modulate({ brightness: 0.96, saturation: 0.82 })
    .jpeg({ quality: 92 })
    .toBuffer();
  const frame = Buffer.from('<svg width="1536" height="1024"><rect x="104" y="196" width="1328" height="632" rx="12" fill="#111820" fill-opacity="0.92"/><rect x="120" y="212" width="1296" height="600" rx="8" fill="none" stroke="#d9e1e8" stroke-opacity="0.55" stroke-width="2"/></svg>');
  const bytes = await sharp(background)
    .composite([
      { input: frame, top: 0, left: 0 },
      { input: foreground, top: 224, left: 128 },
    ])
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toBuffer();

  return {
    bytes,
    mimeType: "image/jpeg",
    generationPrompt: prompt,
    visualBrief,
    sourceAssetReference: SOURCE_ASSET_REFERENCE,
    altText: "Fan-cooled metal projector enclosure shown as an illustrative commercial AV product visual",
  };
}
