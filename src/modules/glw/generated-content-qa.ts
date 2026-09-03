import type { GlwGeneratedDraftArtifact } from "./page-execution";
import type { GlwGenerationRequest } from "./page-generation";

type QaCheck = { ok: boolean; message: string };

export type GlwGeneratedContentQaResult = {
  ok: boolean;
  checks: Readonly<Record<string, QaCheck>>;
  failureReasons: Readonly<Record<string, string>>;
  wordCount: number;
};

const GLW_CERTIFIED_EXTERNAL_DOMAINS = new Set([
  "ssidisplays.com",
  "energy.gov",
]);

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

function domainMatches(domain: string, allowedDomain: string): boolean {
  return domain === allowedDomain || domain.endsWith(`.${allowedDomain}`);
}

function isAllowedAbsoluteLinkDomain(
  domain: string,
  siteDomain: string,
  additionalAllowedDomains: readonly string[],
): boolean {
  if (siteDomain && domainMatches(domain, siteDomain)) return true;

  for (const certifiedDomain of GLW_CERTIFIED_EXTERNAL_DOMAINS) {
    if (domainMatches(domain, certifiedDomain)) return true;
  }

  for (const allowedDomain of additionalAllowedDomains) {
    if (domainMatches(domain, normalizeDomain(allowedDomain))) return true;
  }

  return false;
}

function includesExpected(text: string, value: string | null | undefined): boolean {
  const expected = (value ?? "").trim().toLowerCase();
  return !expected || text.toLowerCase().includes(expected);
}

function collectTextIntegrityMarkers(text: string): string[] {
  const markers = new Set<string>();

  for (const match of text.matchAll(/(?:[!?;,][A-Za-z]|\.[A-Z])/g)) {
    const value = match[0];
    const index = match.index ?? 0;

    if (value.startsWith(".")) {
      const precedingCharacter = index > 0 ? text[index - 1] : "";
      const followingCharacter = text[index + value.length] ?? "";

      if (/[A-Za-z]/.test(precedingCharacter) && followingCharacter === ".") {
        continue;
      }
    }

    markers.add(value);
  }

  return [...markers];
}

function collectMojibakeMarkers(text: string): string[] {
  const markers = new Set<string>();
  const suspiciousSequences = [
    /\uFFFD/g,
    /Ã[\u0080-\u00BF]/g,
    /Â[\u0080-\u00BF]/g,
    /â(?:€|€™|€œ|€�|€“|€”|€¦|€¢|„¢|„¬|„¢)/g,
  ];

  for (const pattern of suspiciousSequences) {
    for (const match of text.matchAll(pattern)) {
      markers.add(match[0]);
    }
  }

  return [...markers];
}

function normalizeAnchorText(value: string): string {
  return stripHtml(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function hasRequiredStateProductLink(
  html: string,
  request: GlwGenerationRequest,
): boolean {
  if (request.pageType !== "state_service") return true;

  const firstPathSegment = request.canonicalPath.split("/").filter(Boolean)[0] ?? "";
  if (!firstPathSegment) return false;
  const requiredHref = `/${firstPathSegment}/`;
  const requiredAnchor = normalizeAnchorText(request.productTopic);
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html)) !== null) {
    const href = (match[1] ?? "").trim();
    const anchor = normalizeAnchorText(match[2] ?? "");
    if (href === requiredHref && anchor === requiredAnchor) return true;
  }

  return false;
}

export function evaluateGlwGeneratedContentQa(input: {
  artifact: GlwGeneratedDraftArtifact;
  request: GlwGenerationRequest;
  siteDomain: string | null | undefined;
  minimumWordCount?: number;
  additionalAllowedDomains?: readonly string[];
}): GlwGeneratedContentQaResult {
  const html = input.artifact.contentHtml ?? "";
  const text = stripHtml(html);
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const minimumWordCount = input.minimumWordCount ?? 1500;
  const allowedDomain = normalizeDomain(input.siteDomain);
  const linkedDomains = collectHttpDomains(html);
  const additionalAllowedDomains = input.additionalAllowedDomains ?? [];
  const foreignDomains = linkedDomains.filter(
    (domain) => !isAllowedAbsoluteLinkDomain(domain, allowedDomain, additionalAllowedDomains),
  );

  const mojibakeMarkers = collectMojibakeMarkers(text);
  const mojibakeOk = mojibakeMarkers.length === 0;
  const textIntegrityMarkers = collectTextIntegrityMarkers(text);
  const textIntegrityOk = textIntegrityMarkers.length === 0;

  const expectedProduct = includesExpected(text, input.request.productTopic);
  const expectedState = includesExpected(text, input.request.stateName);
  const expectedCity = includesExpected(text, input.request.cityName);
  const contentPresent = text.length > 0;
  const wordCountOk = wordCount >= minimumWordCount;
  const domainsOk = foreignDomains.length === 0;
  const stateProductLinkOk = hasRequiredStateProductLink(html, input.request);

  const checks: Record<string, QaCheck> = {
    contentPresent: { ok: contentPresent, message: contentPresent ? "Generated content is present." : "Generated content is empty." },
    minimumWordCount: { ok: wordCountOk, message: `${wordCount} words generated; minimum is ${minimumWordCount}.` },
    siteDomainIsolation: { ok: domainsOk, message: domainsOk ? "Absolute links are limited to the site domain and approved SEO authority domains." : `Unapproved absolute link domains found: ${foreignDomains.join(", ")}.` },
    encodingIntegrity: { ok: mojibakeOk, message: mojibakeOk ? "No known mojibake markers detected." : `Detected mojibake marker(s): ${mojibakeMarkers.slice(0, 12).join(", ")}.` },
    textIntegrity: { ok: textIntegrityOk, message: textIntegrityOk ? "No known spacing or word-join corruption detected." : `Detected text-integrity markers: ${textIntegrityMarkers.slice(0, 12).join(", ")}.` },
    expectedProduct: { ok: expectedProduct, message: expectedProduct ? "Expected product/topic is present." : `Expected product/topic is missing: ${input.request.productTopic}.` },
    expectedState: { ok: expectedState, message: expectedState ? "Expected state is present." : `Expected state is missing: ${input.request.stateName ?? ""}.` },
    expectedCity: { ok: expectedCity, message: expectedCity ? "Expected city is present." : `Expected city is missing: ${input.request.cityName ?? ""}.` },
    stateProductAuthorityLink: {
      ok: stateProductLinkOk,
      message: stateProductLinkOk
        ? "Required state-page product authority link is present."
        : `State pages must link ${input.request.productTopic} to /${input.request.canonicalPath.split("/").filter(Boolean)[0] ?? ""}/.`,
    },
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
