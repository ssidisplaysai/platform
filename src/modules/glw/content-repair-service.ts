import "server-only";

import type { GlwGeneratedDraftArtifact } from "./page-execution";
import type { GlwGenerationRequest } from "./page-generation";

export type GlwContentRepairResult =
  | {
      ok: true;
      artifact: GlwGeneratedDraftArtifact;
      repaired: boolean;
    }
  | {
      ok: false;
      state: "not_configured" | "repair_failed" | "invalid_response";
      message: string;
    };

function resolveApiKey(): string | null {
  const value = (process.env.GENESIS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "").trim();
  return value || null;
}

function resolveModel(): string {
  return (process.env.GENESIS_OPENAI_TEXT_MODEL ?? "gpt-5-mini").trim();
}

function stripFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractOutputText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text.trim();
  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];
    for (const entry of content) {
      if (!entry || typeof entry !== "object") continue;
      const text = (entry as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim()) return text.trim();
    }
  }
  return "";
}

export async function repairGlwStateContentToMinimum(input: {
  artifact: GlwGeneratedDraftArtifact;
  request: GlwGenerationRequest;
  minimumWordCount: number;
  currentWordCount: number;
}): Promise<GlwContentRepairResult> {
  if (input.request.pageType !== "state_service") {
    return { ok: true, artifact: input.artifact, repaired: false };
  }
  if (input.currentWordCount >= input.minimumWordCount) {
    return { ok: true, artifact: input.artifact, repaired: false };
  }

  const apiKey = resolveApiKey();
  if (!apiKey) {
    return {
      ok: false,
      state: "not_configured",
      message: "Genesis content repair requires GENESIS_OPENAI_API_KEY or OPENAI_API_KEY.",
    };
  }

  const deficit = Math.max(0, input.minimumWordCount - input.currentWordCount);
  const targetAddedWords = Math.min(Math.max(deficit + 220, 300), 1100);
  const stateName = input.request.stateName?.trim() || input.request.stateCode;
  const productPath = `/${input.request.canonicalPath.split("/").filter(Boolean)[0]}/`;
  const prompt = [
    "Repair an existing commercial state landing page without replacing or shortening the existing material.",
    `Product: ${input.request.productTopic}.`,
    `State: ${stateName}.`,
    `Existing body is approximately ${input.currentWordCount} words and must exceed ${input.minimumWordCount} words after repair.`,
    `Add approximately ${targetAddedWords} useful words, distributed into relevant existing sections or new focused sections.`,
    "Preserve factual restraint. Do not invent pricing, certifications, dimensions, customers, installations, inventory, delivery times, warranties, or state-specific facts that are not already present in the supplied HTML.",
    "Keep the page commercial, useful, and specific to planning, venue fit, installation coordination, content strategy, serviceability, procurement, and buyer evaluation.",
    `The final HTML must contain a contextual anchor whose exact href is ${productPath} and whose anchor text is exactly ${input.request.productTopic}.`,
    "Preserve existing internal and external links. Do not add any new absolute-domain links.",
    "Return only the complete repaired content HTML. No Markdown fences, no commentary, no JSON.",
    "EXISTING HTML:",
    input.artifact.contentHtml,
  ].join("\n\n");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolveModel(),
        input: prompt,
        max_output_tokens: 7000,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    return {
      ok: false,
      state: "repair_failed",
      message: "Genesis could not reach the configured bounded content-repair provider.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      state: "repair_failed",
      message: `Genesis bounded content repair failed with HTTP ${response.status}.`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      state: "invalid_response",
      message: "The bounded content-repair provider returned malformed JSON.",
    };
  }

  const contentHtml = stripFence(extractOutputText(body));
  if (!contentHtml || !/<(?:p|h[1-6]|ul|ol|table)\b/i.test(contentHtml)) {
    return {
      ok: false,
      state: "invalid_response",
      message: "The bounded content-repair provider returned no usable HTML artifact.",
    };
  }

  return {
    ok: true,
    repaired: true,
    artifact: {
      ...input.artifact,
      contentHtml,
    },
  };
}
