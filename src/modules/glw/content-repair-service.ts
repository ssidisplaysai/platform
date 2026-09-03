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

function ensureDeterministicProductAuthorityLink(html: string, href: string, productTopic: string): string {
  if (hasExactProductAuthorityLink(html, href, productTopic)) return html;
  const fragment = `<p>Explore our <a href="${href}">${productTopic}</a> solutions for additional product specifications, turnkey package details, and display options.</p>`;
  return insertRepairBeforeClosingContainer(html, fragment);
}

async function requestRepairFragment(input: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<GlwContentRepairResult | { ok: true; fragment: string }> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        input: input.prompt,
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

  const fragment = stripFence(extractOutputText(body));
  if (!fragment || !/<(?:p|h[1-6]|ul|ol|table)\b/i.test(fragment)) {
    return {
      ok: false,
      state: "invalid_response",
      message: "The bounded content-repair provider returned no usable HTML fragment.",
    };
  }
  if (/<(?:html|head|body|main|article)\b/i.test(fragment)) {
    return {
      ok: false,
      state: "invalid_response",
      message: "The bounded content-repair provider returned a replacement document instead of an additive fragment.",
    };
  }
  if (/href\s*=\s*[\"']https?:\/\//i.test(fragment)) {
    return {
      ok: false,
      state: "invalid_response",
      message: "The bounded content-repair provider introduced an unapproved absolute-domain link.",
    };
  }

  return { ok: true, fragment };
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

  const productPath = `/${input.request.canonicalPath.split("/").filter(Boolean)[0]}/`;
  let contentHtml = ensureDeterministicProductAuthorityLink(
    input.artifact.contentHtml,
    productPath,
    input.request.productTopic,
  );
  let currentWordCount = countWords(contentHtml);

  if (currentWordCount >= input.minimumWordCount) {
    return {
      ok: true,
      repaired: contentHtml !== input.artifact.contentHtml,
      artifact: {
        ...input.artifact,
        contentHtml,
      },
    };
  }

  const apiKey = resolveApiKey();
  if (!apiKey) {
    return {
      ok: false,
      state: "not_configured",
      message: "Genesis content repair requires GENESIS_OPENAI_API_KEY or OPENAI_API_KEY.",
    };
  }

  const stateName = input.request.stateName?.trim() || input.request.stateCode;
  const model = resolveModel();

  for (let pass = 1; pass <= 2 && currentWordCount < input.minimumWordCount; pass += 1) {
    const deficit = Math.max(0, input.minimumWordCount - currentWordCount);
    const targetAddedWords = Math.min(Math.max(deficit + (pass === 1 ? 320 : 180), pass === 1 ? 360 : 220), 1400);
    const prompt = [
      "Write an additive repair section for an existing commercial state landing page.",
      "Do not rewrite, summarize, replace, shorten, or repeat the existing page. Return only NEW HTML that can be appended to the existing page.",
      `Product: ${input.request.productTopic}.`,
      `State: ${stateName}.`,
      `The page currently contains approximately ${currentWordCount} words and must exceed ${input.minimumWordCount} words after this additive section is appended.`,
      `Write approximately ${targetAddedWords} useful new words in two to five focused sections using h2/h3, p, ul, and li as appropriate.`,
      "Preserve factual restraint. Do not invent pricing, certifications, dimensions, customers, installations, inventory, delivery times, warranties, or unsupported state-specific facts.",
      "Keep the content commercial and useful, focused on planning, venue fit, installation coordination, content strategy, serviceability, procurement, buyer evaluation, and operational considerations.",
      "Do not include any absolute-domain links. Do not include html, head, body, main, or article wrapper tags.",
      "Do not include the product authority link; Genesis inserts and validates that link deterministically.",
      "Return only the additive HTML fragment. No Markdown fences, no commentary, no JSON.",
    ].join("\n\n");

    const repair = await requestRepairFragment({ apiKey, model, prompt });
    if (!repair.ok) return repair;

    contentHtml = insertRepairBeforeClosingContainer(contentHtml, repair.fragment);
    if (!containsOriginalCore(contentHtml, input.artifact.contentHtml)) {
      return {
        ok: false,
        state: "invalid_response",
        message: "The bounded content repair did not preserve the existing page body.",
      };
    }

    contentHtml = ensureDeterministicProductAuthorityLink(
      contentHtml,
      productPath,
      input.request.productTopic,
    );
    currentWordCount = countWords(contentHtml);
  }

  if (currentWordCount < input.minimumWordCount) {
    return {
      ok: false,
      state: "invalid_response",
      message: `The bounded content repair produced ${currentWordCount} words; minimum is ${input.minimumWordCount}.`,
    };
  }

  if (!hasExactProductAuthorityLink(contentHtml, productPath, input.request.productTopic)) {
    return {
      ok: false,
      state: "invalid_response",
      message: "Genesis could not establish the required exact product authority link after bounded repair.",
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
