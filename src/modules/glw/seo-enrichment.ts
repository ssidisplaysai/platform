import type { GlwGeneratedDraftArtifact } from "./page-execution";
import type { GlwGenerationRequest } from "./page-generation";

export type GlwSeoMetadata = {
  focusKeyphrase: string;
  seoTitle: string;
  metaDescription: string;
};

type GlwAuthorityLink = {
  href: string;
  label: string;
  sentence: string;
};

export type GlwSeoEnrichmentResult = {
  artifact: GlwGeneratedDraftArtifact;
  metadata: GlwSeoMetadata;
  inserted: {
    productAuthorityLink: boolean;
    corporateLink: boolean;
    outboundAuthorityLink: boolean;
    localAuthorityLink: boolean;
    weatherAuthorityLink: boolean;
  };
  approvedExternalDomains: readonly string[];
};

const STATE_AUTHORITY_LINKS: Readonly<Record<string, GlwAuthorityLink>> = {
  CT: {
    href: "https://portal.ct.gov/decd",
    label: "Connecticut Department of Economic and Community Development",
    sentence: "For organizations planning facilities, events, and commercial investments in Connecticut, the Connecticut Department of Economic and Community Development provides statewide business and development resources.",
  },
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

function ensureStateAuthorityLink(html: string, request: GlwGenerationRequest): { html: string; inserted: boolean; domain: string | null } {
  if (request.pageType !== "state_service") return { html, inserted: false, domain: null };

  const authority = STATE_AUTHORITY_LINKS[request.stateCode];
  if (!authority) return { html, inserted: false, domain: null };

  const normalized = normalizeHtmlForSearch(html);
  if (normalized.includes(authority.href.toLowerCase())) {
    return { html, inserted: false, domain: new URL(authority.href).hostname };
  }

  const fragment = `<p>${escapeHtml(authority.sentence)} <a href="${authority.href}" target="_blank" rel="noopener noreferrer">${escapeHtml(authority.label)}</a>.</p>`;
  return {
    html: appendBeforeClosingContainer(html, fragment),
    inserted: true,
    domain: new URL(authority.href).hostname,
  };
}

function ensureWeatherAuthorityLink(html: string, request: GlwGenerationRequest): { html: string; inserted: boolean; domain: string | null } {
  if (request.pageType !== "state_service") return { html, inserted: false, domain: null };

  const normalized = normalizeHtmlForSearch(html);
  const weatherContextPresent = /weather|climate|humidity|temperature|outdoor|environmental/i.test(html);
  if (!weatherContextPresent) return { html, inserted: false, domain: null };

  if (normalized.includes("href=\"https://www.weather.gov/") || normalized.includes("href='https://www.weather.gov/")) {
    return { html, inserted: false, domain: "weather.gov" };
  }

  const stateName = request.stateName?.trim() || "the project area";
  const fragment = `<p>When installation planning depends on local environmental conditions in ${escapeHtml(stateName)}, consult the <a href="https://www.weather.gov/" target="_blank" rel="noopener noreferrer">National Weather Service</a> for official weather and climate information.</p>`;
  return { html: appendBeforeClosingContainer(html, fragment), inserted: true, domain: "weather.gov" };
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

  const localAuthority = ensureStateAuthorityLink(html, input.request);
  html = localAuthority.html;

  const weatherAuthority = ensureWeatherAuthorityLink(html, input.request);
  html = weatherAuthority.html;

  const approvedExternalDomains = [
    "ssidisplays.com",
    "energy.gov",
    localAuthority.domain,
    weatherAuthority.domain,
  ].filter((value): value is string => Boolean(value));

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
      localAuthorityLink: localAuthority.inserted,
      weatherAuthorityLink: weatherAuthority.inserted,
    },
    approvedExternalDomains,
  };
}
