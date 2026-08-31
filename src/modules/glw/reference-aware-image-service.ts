import "server-only";

import { generateGenesisFeaturedImage, type GenesisGeneratedImageResult } from "./generated-image-service";
import { loadGlwCampaignImageReferences } from "./campaign-image-reference-loader";

function resolveApiKey(): string | null {
  const value = (process.env.GENESIS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "").trim();
  return value || null;
}

function resolveModel(): string {
  return (process.env.GENESIS_OPENAI_IMAGE_MODEL ?? "gpt-image-2").trim();
}

type OpenAiImageEditResponse = {
  data?: Array<{ b64_json?: string }>;
};

export async function generateGenesisFeaturedImageWithCampaignReferences(input: {
  prompt: string;
  siteName: string;
  productTopic: string;
  campaignId?: string | null;
}): Promise<GenesisGeneratedImageResult> {
  const campaignId = input.campaignId?.trim() ?? "";
  if (!campaignId) {
    return generateGenesisFeaturedImage(input);
  }

  const references = loadGlwCampaignImageReferences(campaignId);
  if (references.length === 0) {
    return generateGenesisFeaturedImage(input);
  }

  const apiKey = resolveApiKey();
  if (!apiKey) {
    return {
      ok: false,
      state: "not_configured",
      message: "Genesis image generation requires GENESIS_OPENAI_API_KEY or OPENAI_API_KEY.",
    };
  }

  const primaryReference = references.find((reference) => reference.role === "product_image") ?? references[0];
  const form = new FormData();
  form.append("model", resolveModel());
  form.append("prompt", [
    input.prompt.trim(),
    `Use the supplied ${primaryReference.role === "product_image" ? "product" : "style"} reference image as visual guidance.`,
    "Preserve the recognizable product form and proportions when a product reference is supplied, while creating a new website-ready commercial scene rather than reproducing the source image literally.",
    "Do not infer factual product specifications, dimensions, certifications, pricing, or capabilities from the image alone.",
    "Do not include readable words, letters, logos, captions, watermarks, signage, UI text, or typography anywhere in the image.",
  ].join("\n\n"));
  form.append("size", "1536x1024");
  form.append("quality", "medium");
  form.append("output_format", "jpeg");
  form.append("output_compression", "82");
  form.append(
    "image",
    new Blob([primaryReference.bytes], { type: primaryReference.mediaType }),
    primaryReference.fileName,
  );

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    return {
      ok: false,
      state: "generation_failed",
      message: "Genesis could not reach the configured reference-aware image-generation provider.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      state: "generation_failed",
      message: `Genesis reference-aware image generation failed with HTTP ${response.status}.`,
    };
  }

  let body: OpenAiImageEditResponse;
  try {
    body = await response.json() as OpenAiImageEditResponse;
  } catch {
    return {
      ok: false,
      state: "invalid_response",
      message: "The reference-aware image-generation provider returned malformed JSON.",
    };
  }

  const base64 = body.data?.[0]?.b64_json?.trim();
  if (!base64) {
    return {
      ok: false,
      state: "invalid_response",
      message: "The reference-aware image-generation provider returned no usable base64 image payload.",
    };
  }

  try {
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length === 0) throw new Error("empty image");
    return {
      ok: true,
      image: {
        bytes,
        mimeType: "image/jpeg",
        fileExtension: "jpg",
      },
    };
  } catch {
    return {
      ok: false,
      state: "invalid_response",
      message: "The reference-aware image-generation provider returned invalid base64 image data.",
    };
  }
}
