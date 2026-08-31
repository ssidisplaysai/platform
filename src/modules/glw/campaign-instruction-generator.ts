import "server-only";

import { readFileSync } from "node:fs";
import type { GlwCampaign } from "./campaign-types";
import type { GlwCampaignKnowledgePack, GlwCampaignReference } from "./campaign-reference-types";

export type GlwGeneratedCampaignInstructions = {
  instructions: string;
  provenance: string;
  usedReferenceIds: readonly string[];
};

function resolveApiKey(): string | null {
  const value = (process.env.GENESIS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "").trim();
  return value || null;
}

function resolveModel(): string {
  return (process.env.GENESIS_OPENAI_TEXT_MODEL ?? "gpt-5.6-luna").trim();
}

function referenceInventory(references: readonly GlwCampaignReference[]): string {
  if (references.length === 0) return "No uploaded references are available.";
  return references.map((reference, index) =>
    `${index + 1}. ${reference.fileName} | role=${reference.role} | scope=${reference.scope} | mediaType=${reference.mediaType}`,
  ).join("\n");
}

function buildReferenceInputs(references: readonly GlwCampaignReference[]): {
  inputs: Array<Record<string, unknown>>;
  usedReferenceIds: string[];
} {
  const inputs: Array<Record<string, unknown>> = [];
  const usedReferenceIds: string[] = [];

  for (const reference of references) {
    try {
      const bytes = readFileSync(reference.storagePath);
      if (reference.mediaType.startsWith("image/")) {
        inputs.push({
          type: "input_image",
          image_url: `data:${reference.mediaType};base64,${bytes.toString("base64")}`,
        });
        usedReferenceIds.push(reference.referenceId);
        continue;
      }

      if (reference.mediaType === "application/pdf") {
        inputs.push({
          type: "input_file",
          filename: reference.fileName,
          file_data: `data:application/pdf;base64,${bytes.toString("base64")}`,
        });
        usedReferenceIds.push(reference.referenceId);
        continue;
      }

      if (
        reference.mediaType.startsWith("text/") ||
        reference.fileName.toLowerCase().endsWith(".md") ||
        reference.fileName.toLowerCase().endsWith(".txt")
      ) {
        const text = bytes.toString("utf8").slice(0, 120_000);
        inputs.push({
          type: "input_text",
          text: `REFERENCE FILE: ${reference.fileName}\nROLE: ${reference.role}\nSCOPE: ${reference.scope}\n\n${text}`,
        });
        usedReferenceIds.push(reference.referenceId);
      }
    } catch {
      // Keep the reference in the inventory even when its bytes cannot be attached.
    }
  }

  return { inputs, usedReferenceIds };
}

function extractOutputText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.output_text === "string" && record.output_text.trim()) return record.output_text.trim();
  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim()) return text.trim();
    }
  }
  return null;
}

export async function generateGlwCampaignInstructions(input: {
  campaign: GlwCampaign;
  knowledgePack: GlwCampaignKnowledgePack;
  siteName: string;
  productName: string;
}): Promise<{ ok: true; result: GlwGeneratedCampaignInstructions } | { ok: false; message: string }> {
  const apiKey = resolveApiKey();
  if (!apiKey) return { ok: false, message: "Genesis OpenAI API key is not configured." };

  const attached = buildReferenceInputs(input.knowledgePack.references);
  const prompt = [
    "Create the editable master instructions for a GLW production content campaign.",
    `Site: ${input.siteName}`,
    `Product/service: ${input.productName}`,
    `Campaign: ${input.campaign.name}`,
    `Page type: ${input.campaign.pageType}`,
    `Geography: ${input.campaign.stateCodes.length} U.S. state targets`,
    `Publication policy: ${input.campaign.publicationPolicy}`,
    `Image required: ${input.campaign.imageRequired ? "yes" : "no"}`,
    "Uploaded reference inventory:",
    referenceInventory(input.knowledgePack.references),
    "Write practical campaign instructions for the content generator and image generator. Separate factual grounding from visual inspiration. Treat authoritative_fact sources as the factual source of truth. Treat product_image and image_style sources as visual references, not proof of specifications. Never invent offices, local inventory, installations, customers, certifications, dimensions, pricing, lead times, or capabilities not supported by authoritative sources. State-specific pages must add useful market/application context and must not become thin doorway pages. Include explicit requirements for page purpose, factual boundaries, state localization, applications, buyer guidance, SEO quality, internal linking, image direction, claims to avoid, and CTA behavior. Return only the instruction text, ready for the operator to edit and approve.",
  ].join("\n\n");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolveModel(),
        input: [{
          role: "user",
          content: [{ type: "input_text", text: prompt }, ...attached.inputs],
        }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    return { ok: false, message: "Genesis could not reach the AI instruction provider." };
  }

  if (!response.ok) {
    return { ok: false, message: `AI instruction generation failed with HTTP ${response.status}.` };
  }

  let body: unknown;
  try { body = await response.json(); } catch { return { ok: false, message: "AI instruction provider returned malformed JSON." }; }
  const instructions = extractOutputText(body);
  if (!instructions) return { ok: false, message: "AI instruction provider returned no usable instruction text." };

  const used = input.knowledgePack.references.filter((reference) => attached.usedReferenceIds.includes(reference.referenceId));
  const provenance = used.length > 0
    ? `Generated from ${used.length} attached reference${used.length === 1 ? "" : "s"}: ${used.map((reference) => reference.fileName).join(", ")}. Campaign/site/product configuration was also supplied.`
    : `Generated from campaign, site, product, and reference metadata. No uploaded binary reference could be attached to the AI request.`;

  return {
    ok: true,
    result: { instructions, provenance, usedReferenceIds: attached.usedReferenceIds },
  };
}
