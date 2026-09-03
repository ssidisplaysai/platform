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
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];
    for (const entry of content) {
      if (!entry || typeof entry !== "object") continue;
      const text = (entry as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim()) chunks.push(text.trim());
    }
  }
  return chunks.join("\n").trim();
}

function stripTags(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(value: string): number {
  const text = stripTags(value);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function hasExactProductAuthorityLink(html: string, href: string, productTopic: string): boolean {
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedTopic = productTopic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<a\\b[^>]*href\\s*=\\s*[\"']${escapedHref}[\"'][^>]*>\\s*${escapedTopic}\\s*<\\/a>`, "i");
  return pattern.test(html);
}

function containsOriginalCore(repairedHtml: string, originalHtml: string): boolean {
  const originalText = stripTags(originalHtml);
  if (!originalText) return false;
  const sample = originalText.slice(0, Math.min(240, originalText.length)).trim();
  if (!sample) return false;
  return stripTags(repairedHtml).includes(sample);
}

function insertRepairBeforeClosingContainer(html: string, fragment: string): string {
  for (const closingTag of ["</main>", "</article>", "</body>"]) {
    const index = html.toLowerCase().lastIndexOf(closingTag);
    if (index >= 0) return `${html.slice(0, index)}\n${fragment}\n${html.slice(index)}`;
  }
  return `${html.trimEnd()}\n${fragment}`;
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
  const targetAddedWords = Math.min(Math.max(deficit + 260, 320), 1200);
  const stateName = input.request.stateName?.trim() || input.request.stateCode;
  const productPath = `/${input.request.canonicalPath.split("/").filter(Boolean)[0]}/`;
  const prompt = [
    "Write an additive repair section for an existing commercial state landing page.",
    "Do not rewrite, summarize, replace, shorten, or repeat the existing page. Return only NEW HTML that can be appended to the existing page.",
    `Product: ${input.request.productTopic}.`,
    `State: ${stateName}.`,
    `Existing body is approximately ${input.currentWordCount} words and must exceed ${input.minimumWordCount} words after the new section is appended.`,
    `Write approximately ${targetAddedWords} useful new words in two to five focused sections using h2/h3, p, ul, and li as appropriate.`,
    "Preserve factual restraint. Do not invent pricing, certifications, dimensions, customers, installations, inventory, delivery times, warranties, or state-specific facts that are not already supported.",
    "Keep the content commercial and useful, focused on planning, venue fit, installation coordination, content strategy, serviceability, procurement, buyer evaluation, and operational considerations.",
    `The returned HTML must contain one contextual anchor whose exact href is ${productPath} and whose anchor text is exactly ${input.request.productTopic}.`,
    "Do not include any absolute-domain links. Do not include html, head, body, main, or article wrapper tags.",
    "Return only the additive HTML fragment. No Markdown fences, no commentary, no JSON.",
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
        max_output_tokens: 6000,
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

  const repairFragment = stripFence(extractOutputText(body));
  if (!repairFragment || !/<(?:p|h[1-6]|ul|ol|table)\b/i.test(repairFragment)) {
    return {
      ok: false,
      state: "invalid_response",
      message: "The bounded content-repair provider returned no usable HTML fragment.",
    };
  }
  if (/<(?:html|head|body|main|article)\b/i.test(repairFragment)) {
    return {
      ok: false,
      state: "invalid_response",
      message: "The bounded content-repair provider returned a replacement document instead of an additive fragment.",
    };
  }
  if (/href\s*=\s*[\"']https?:\/\//i.test(repairFragment)) {
    return {
      ok: false,
      state: "invalid_response",
      message: "The bounded content-repair provider introduced an unapproved absolute-domain link.",
    };
  }
  if (!hasExactProductAuthorityLink(repairFragment, productPath, input.request.productTopic)) {
    return {
      ok: false,
      state: "invalid_response",
      message: "The bounded content-repair provider did not return the required exact product authority link.",
    };
  }

  const contentHtml = insertRepairBeforeClosingContainer(input.artifact.contentHtml, repairFragment);
  if (!containsOriginalCore(contentHtml, input.artifact.contentHtml)) {
    return {
      ok: false,
      state: "invalid_response",
      message: "The bounded content repair did not preserve the existing page body.",
    };
  }
  const repairedWordCount = countWords(contentHtml);
  if (repairedWordCount < input.minimumWordCount) {
    return {
      ok: false,
      state: "invalid_response",
      message: `The bounded content repair produced ${repairedWordCount} words; minimum is ${input.minimumWordCount}.`,
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
