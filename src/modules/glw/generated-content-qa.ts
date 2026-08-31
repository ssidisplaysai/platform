import type { GlwGeneratedDraftArtifact } from "./page-execution";
import type { GlwGenerationRequest } from "./page-generation";

type QaCheck = { ok: boolean; message: string };

export type GlwGeneratedContentQaResult = {
  ok: boolean;
  checks: Readonly<Record<string, QaCheck>>;
  failureReasons: Readonly<Record<string, string>>;
  wordCount: number;
};

function stripHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDomain(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0] ?? "";
}

function collectHttpDomains(html: string): string[] {
  const domains = new Set<string>();
  const pattern = /href\s*=\s*["']https?:\/\/([^\/'"?#]+)[^"']*["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const domain = normalizeDomain(match[1]);
    if (domain) domains.add(domain);
  }
  return [...domains];
}

function includesExpected(text: string, value: string | null | undefined): boolean {
  const expected = (value ?? "").trim().toLowerCase();
  return !expected || text.toLowerCase().includes(expected);
}

function collectTextIntegrityMarkers(text: string): string[] {
  const markers = new Set<string>();

  // A comma, semicolon, exclamation point, or question mark followed directly
  // by a letter is malformed prose. Periods are restricted to uppercase starts
  // so ordinary hostnames such as ssidisplays.com remain valid.
  for (const value of text.match(/(?:[!?;,][A-Za-z]|\.[A-Z])/g) ?? []) markers.add(value);

  // Detect common word-boundary loss generically. These patterns target a
  // closed set of high-confidence function words whose accidental attachment
  // to the neighboring token is not normal English prose. They catch defects
  // such as forsuperior, glasswalls, windowsinto, inreduced, and stepof without
  // maintaining a page- or city-specific list of generated bad strings.
  const joinedFunctionWordPatterns = [
    /\b(?:a|an|and|as|at|by|for|from|in|into|of|on|or|the|to|with)[a-z]{3,}\b/gi,
    /\b[a-z]{4,}(?:and|for|from|into|of|the|to|with)\b/gi,
  ];
  for (const pattern of joinedFunctionWordPatterns) {
    for (const value of text.match(pattern) ?? []) markers.add(value);
  }

  return [...markers];
}

export function evaluateGlwGeneratedContentQa(input: {
  artifact: GlwGeneratedDraftArtifact;
  request: GlwGenerationRequest;
  siteDomain: string | null | undefined;
  minimumWordCount?: number;
}): GlwGeneratedContentQaResult {
  const html = input.artifact.contentHtml ?? "";
  const text = stripHtml(html);
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const minimumWordCount = input.minimumWordCount ?? 1500;
  const allowedDomain = normalizeDomain(input.siteDomain);
  const linkedDomains = collectHttpDomains(html);
  const foreignDomains = allowedDomain
    ? linkedDomains.filter((domain) => domain !== allowedDomain && !domain.endsWith(`.${allowedDomain}`))
    : linkedDomains;

  const mojibakePattern = /[âÃÂ\uFFFD]/g;
  const mojibakeMatches = text.match(mojibakePattern) ?? [];
  const mojibakeOk = mojibakeMatches.length === 0;
  const textIntegrityMarkers = collectTextIntegrityMarkers(text);
  const textIntegrityOk = textIntegrityMarkers.length === 0;

  const expectedProduct = includesExpected(text, input.request.productTopic);
  const expectedState = includesExpected(text, input.request.stateName);
  const expectedCity = includesExpected(text, input.request.cityName);
  const contentPresent = text.length > 0;
  const wordCountOk = wordCount >= minimumWordCount;
  const domainsOk = foreignDomains.length === 0;

  const checks: Record<string, QaCheck> = {
    contentPresent: { ok: contentPresent, message: contentPresent ? "Generated content is present." : "Generated content is empty." },
    minimumWordCount: { ok: wordCountOk, message: `${wordCount} words generated; minimum is ${minimumWordCount}.` },
    siteDomainIsolation: { ok: domainsOk, message: domainsOk ? "All absolute links remain on the configured site domain." : `Foreign absolute link domains found: ${foreignDomains.join(", ")}.` },
    encodingIntegrity: { ok: mojibakeOk, message: mojibakeOk ? "No known mojibake markers detected." : `Detected ${mojibakeMatches.length} mojibake marker(s).` },
    textIntegrity: { ok: textIntegrityOk, message: textIntegrityOk ? "No known spacing or word-join corruption detected." : `Detected text-integrity markers: ${textIntegrityMarkers.slice(0, 12).join(", ")}.` },
    expectedProduct: { ok: expectedProduct, message: expectedProduct ? "Expected product/topic is present." : `Expected product/topic is missing: ${input.request.productTopic}.` },
    expectedState: { ok: expectedState, message: expectedState ? "Expected state is present." : `Expected state is missing: ${input.request.stateName ?? ""}.` },
    expectedCity: { ok: expectedCity, message: expectedCity ? "Expected city is present." : `Expected city is missing: ${input.request.cityName ?? ""}.` },
  };

  const failureReasons = Object.fromEntries(
    Object.entries(checks).filter(([, check]) => !check.ok).map(([key, check]) => [key, check.message]),
  );

  return {
    ok: Object.keys(failureReasons).length === 0,
    checks,
    failureReasons,
    wordCount,
  };
}
