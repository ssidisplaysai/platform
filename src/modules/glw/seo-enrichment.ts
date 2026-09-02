import type { GlwGeneratedDraftArtifact } from "./page-execution";
import type { GlwGenerationRequest } from "./page-generation";

export type GlwSeoMetadata = {
  focusKeyphrase: string;
  seoTitle: string;
  metaDescription: string;
};

export type GlwSeoEnrichmentResult = {
  artifact: GlwGeneratedDraftArtifact;
  metadata: GlwSeoMetadata;
  inserted: {
    productAuthorityLink: boolean;
    corporateLink: boolean;
    outboundAuthorityLink: boolean;
  };
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeHtmlForSearch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ");
}

function appendBeforeClosingContainer(html: string, fragment: string): string {
  for (const closingTag of ["</main>", "</article>", "</body>"]) {
    const index = html.toLowerCase().lastIndexOf(closingTag);
    if (index >= 0) {
      return `${html.slice(0, index)}${fragment}\n${html.slice(index)}`;
    }
  }

  return `${html.trimEnd()}\n${fragment}`;
}

function buildFocusKeyphrase(request: GlwGenerationRequest): string {
  const location = request.cityName?.trim() || request.stateName?.trim() || "";
  return [request.productTopic.trim(), location].filter(Boolean).join(" ");
}

function buildSeoTitle(request: GlwGenerationRequest): string {
  const configured = request.seoTitle?.trim();
  if (configured) return configured;

  const location = request.cityName?.trim() || request.stateName?.trim() || "";
  return `${request.productTopic}${location ? ` in ${location}` : ""} | ${request.siteName}`;
}

function buildMetaDescription(request: GlwGenerationRequest): string {
  const configured = request.metaDescription?.trim();
  if (configured) return configured;

  const location = request.cityName?.trim() || request.stateName?.trim() || "your market";
  return `Explore turnkey ${request.productTopic.toLowerCase()} solutions in ${location} from ${request.siteName}, including display options, controls, installation planning, and support.`;
}

function ensureProductAuthorityLink(html: string, request: GlwGenerationRequest): { html: string; inserted: boolean } {
  if (request.pageType !== "state_service") return { html, inserted: false };

  const firstPathSegment = request.canonicalPath.split("/").filter(Boolean)[0] ?? "";
  if (!firstPathSegment) return { html, inserted: false };

  const href = `/${firstPathSegment}/`;
  const normalized = normalizeHtmlForSearch(html);
  const exactHref = `href="${href.toLowerCase()}"`;
  const singleHref = `href='${href.toLowerCase()}'`;

  if (normalized.includes(exactHref) || normalized.includes(singleHref)) {
    return { html, inserted: false };
  }

  const fragment = `<p>Explore our <a href="${href}">${escapeHtml(request.productTopic)}</a> solutions for additional product specifications, turnkey package details, and display options.</p>`;
  return { html: appendBeforeClosingContainer(html, fragment), inserted: true };
}

function ensureCorporateLink(html: string): { html: string; inserted: boolean } {
  const normalized = normalizeHtmlForSearch(html);
  if (normalized.includes("href=\"https://ssidisplays.com") || normalized.includes("href='https://ssidisplays.com")) {
    return { html, inserted: false };
  }

  const fragment = `<p>For custom engineering, integration, and broader display-system support, visit <a href="https://ssidisplays.com/" target="_blank" rel="noopener noreferrer">Screen Solutions International</a>.</p>`;
  return { html: appendBeforeClosingContainer(html, fragment), inserted: true };
}

function ensureOutboundAuthorityLink(html: string): { html: string; inserted: boolean } {
  const normalized = normalizeHtmlForSearch(html);
  if (normalized.includes("href=\"https://www.energy.gov/") || normalized.includes("href='https://www.energy.gov/")) {
    return { html, inserted: false };
  }

  const fragment = `<p>For facility teams evaluating electrical planning and energy use, the <a href="https://www.energy.gov/energysaver" target="_blank" rel="noopener noreferrer">U.S. Department of Energy Energy Saver</a> provides additional efficiency guidance.</p>`;
  return { html: appendBeforeClosingContainer(html, fragment), inserted: true };
}

export function enrichGlwGeneratedContentForSeo(input: {
  artifact: GlwGeneratedDraftArtifact;
  request: GlwGenerationRequest;
}): GlwSeoEnrichmentResult {
  let html = input.artifact.contentHtml ?? "";

  const product = ensureProductAuthorityLink(html, input.request);
  html = product.html;

  const corporate = ensureCorporateLink(html);
  html = corporate.html;

  const outbound = ensureOutboundAuthorityLink(html);
  html = outbound.html;

  return {
    artifact: {
      ...input.artifact,
      contentHtml: html,
    },
    metadata: {
      focusKeyphrase: buildFocusKeyphrase(input.request),
      seoTitle: buildSeoTitle(input.request),
      metaDescription: buildMetaDescription(input.request),
    },
    inserted: {
      productAuthorityLink: product.inserted,
      corporateLink: corporate.inserted,
      outboundAuthorityLink: outbound.inserted,
    },
  };
}
