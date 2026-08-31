import "server-only";

export type GenesisGeneratedImage = {
  bytes: Buffer;
  mimeType: "image/png";
  fileExtension: "png";
};

export type GenesisGeneratedImageResult =
  | { ok: true; image: GenesisGeneratedImage }
  | {
      ok: false;
      state: "not_configured" | "generation_failed" | "invalid_response";
      message: string;
    };

type OpenAiImageGenerationResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
};

function resolveApiKey(): string | null {
  const value = (
    process.env.GENESIS_OPENAI_API_KEY
    ?? process.env.OPENAI_API_KEY
    ?? ""
  ).trim();

  return value || null;
}

function resolveModel(): string {
  return (
    process.env.GENESIS_OPENAI_IMAGE_MODEL
    ?? "gpt-image-1-mini"
  ).trim();
}

function buildProductionPrompt(input: {
  prompt: string;
  siteName: string;
  productTopic: string;
}): string {
  return [
    input.prompt.trim(),
    "Create a photorealistic premium commercial website hero image in a wide landscape composition.",
    `The image is for ${input.siteName} and must depict ${input.productTopic} accurately and realistically.`,
    "Do not include readable words, letters, logos, captions, watermarks, signage, UI text, or typography anywhere in the image.",
    "Use professional architectural/product photography, realistic materials, believable scale, and clean website-ready composition.",
  ].filter(Boolean).join("\n\n");
}

export async function generateGenesisFeaturedImage(input: {
  prompt: string;
  siteName: string;
  productTopic: string;
}): Promise<GenesisGeneratedImageResult> {
  const apiKey = resolveApiKey();
  const prompt = input.prompt.trim();

  if (!apiKey) {
    return {
      ok: false,
      state: "not_configured",
      message: "Genesis image generation requires GENESIS_OPENAI_API_KEY or OPENAI_API_KEY.",
    };
  }

  if (!prompt) {
    return {
      ok: false,
      state: "invalid_response",
      message: "Genesis image generation requires a non-empty image prompt.",
    };
  }

  let response: Response;

  try {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolveModel(),
        prompt: buildProductionPrompt(input),
        size: "1536x1024",
        quality: "medium",
        n: 1,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    return {
      ok: false,
      state: "generation_failed",
      message: "Genesis could not reach the configured image-generation provider.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      state: "generation_failed",
      message: `Genesis image generation failed with HTTP ${response.status}.`,
    };
  }

  let body: OpenAiImageGenerationResponse;

  try {
    body = await response.json() as OpenAiImageGenerationResponse;
  } catch {
    return {
      ok: false,
      state: "invalid_response",
      message: "The image-generation provider returned malformed JSON.",
    };
  }

  const first = body.data?.[0];
  const base64 = first?.b64_json?.trim();

  if (base64) {
    try {
      const bytes = Buffer.from(base64, "base64");
      if (bytes.length === 0) throw new Error("empty image");
      return {
        ok: true,
        image: {
          bytes,
          mimeType: "image/png",
          fileExtension: "png",
        },
      };
    } catch {
      return {
        ok: false,
        state: "invalid_response",
        message: "The image-generation provider returned invalid base64 image data.",
      };
    }
  }

  const remoteUrl = first?.url?.trim();
  if (!remoteUrl) {
    return {
      ok: false,
      state: "invalid_response",
      message: "The image-generation provider returned no usable image payload.",
    };
  }

  try {
    const imageResponse = await fetch(remoteUrl, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!imageResponse.ok) {
      return {
        ok: false,
        state: "invalid_response",
        message: `Generated image download failed with HTTP ${imageResponse.status}.`,
      };
    }
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    if (bytes.length === 0) {
      return {
        ok: false,
        state: "invalid_response",
        message: "Generated image download returned an empty payload.",
      };
    }
    return {
      ok: true,
      image: {
        bytes,
        mimeType: "image/png",
        fileExtension: "png",
      },
    };
  } catch {
    return {
      ok: false,
      state: "invalid_response",
      message: "Genesis could not download the generated image payload.",
    };
  }
}
