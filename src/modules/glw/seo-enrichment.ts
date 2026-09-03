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

type GlwRelatedProductLink = {
  href: string;
  label: string;
  sentence: string;
  sectionPatterns: readonly RegExp[];
  paragraphPatterns: readonly RegExp[];
};

export type GlwSeoEnrichmentResult = {
  artifact: GlwGeneratedDraftArtifact;
  metadata: GlwSeoMetadata;
  inserted: {
    productAuthorityLink: boolean;
    relatedProductLinks: number;
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

const RELATED_PRODUCT_LINKS: readonly GlwRelatedProductLink[] = [
  {
    href: "/outdoor-digital-sphere/",
    label: "Outdoor Digital Sphere",
    sentence: "For exterior venues or projects that need weather-rated spherical LED, compare our outdoor digital sphere solutions.",
    sectionPatterns: [/lighting and environmental/i, /material and performance/i, /use cases/i],
    paragraphPatterns: [/outdoor/i, /weather/i, /environmental/i, /exterior/i],
  },
  {
    href: "/indoor-led-video-wall/",
    label: "Indoor LED Video Wall",
    sentence: "For applications better suited to a traditional large-format surface, explore our indoor LED video wall options.",
    sectionPatterns: [/comparison table/i, /choosing the right/i, /buying criteria/i],
    paragraphPatterns: [/flat display/i, /video wall/i, /traditional display/i, /large-format/i],
  },
  {
    href: "/transparent-oled-display/",
    label: "Transparent OLED Display",
    sentence: "For retail and architectural applications where transparency is part of the experience, see our transparent OLED display solutions.",
    sectionPatterns: [/popular local applications/i, /use cases/i, /future trends/i],
    paragraphPatterns: [/retail/i, /transparent/i, /architectural/i, /window/i],
  },
  {
    href: "/outdoor-digital-kiosk/",
    label: "Outdoor Digital Kiosk",
    sentence: "For interactive wayfinding, self-service, or public-facing information, our outdoor digital kiosk options can complement a broader display deployment.",
    sectionPatterns: [/use cases/i, /popular local applications/i, /interactive/i],
    paragraphPatterns: [/wayfinding/i, /interactive/i, /self-service/i, /kiosk/i],
  },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
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

function insertAfterMatchingParagraph(html: string, fragment: string, patterns: readonly RegExp[]): { html: string; insertedContextually: boolean } {
  for (const pattern of patterns) {
    const paragraphPattern = new RegExp(`<p\\b[^>]*>[\\s\\S]*?${pattern.source}[\\s\\S]*?<\\/p>`, "i");
    const match = html.match(paragraphPattern);
    if (match && typeof match.index === "number") {
      const end = match.index + match[0].length;
      return {
        html: `${html.slice(0, end)}\n${fragment}${html.slice(end)}`,
        insertedContextually: true,
      };
    }
  }
  return { html, insertedContextually: false };
}

function insertAfterMatchingSection(html: string, fragment: string, patterns: readonly RegExp[]): { html: string; insertedContextually: boolean } {
  for (const pattern of patterns) {
    const headingPattern = new RegExp(`<h[2-4]\\b[^>]*>[\\s\\S]*?${pattern.source}[\\s\\S]*?<\\/h[2-4]>`, "i");
    const headingMatch = html.match(headingPattern);
    if (!headingMatch || typeof headingMatch.index !== "number") continue;

    const start = headingMatch.index + headingMatch[0].length;
    const tail = html.slice(start);
    const nextHeading = tail.search(/<h[2-4]\b/i);
    const sectionEnd = nextHeading >= 0 ? start + nextHeading : html.length;
    const sectionHtml = html.slice(start, sectionEnd);
    const paragraphMatches = [...sectionHtml.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)];

    if (paragraphMatches.length > 0) {
      const lastParagraph = paragraphMatches[paragraphMatches.length - 1];
      const end = start + (lastParagraph.index ?? 0) + lastParagraph[0].length;
      return {
        html: `${html.slice(0, end)}\n${fragment}${html.slice(end)}`,
        insertedContextually: true,
      };
    }

    return {
      html: `${html.slice(0, start)}\n${fragment}${html.slice(start)}`,
      insertedContextually: true,
    };
  }

  return { html, insertedContextually: false };
}

function insertContextually(
  html: string,
  fragment: string,
  options: {
    sectionPatterns?: readonly RegExp[];
    paragraphPatterns?: readonly RegExp[];
  },
): string {
  const bySection = insertAfterMatchingSection(html, fragment, options.sectionPatterns ?? []);
  if (bySection.insertedContextually) return bySection.html;

  const byParagraph = insertAfterMatchingParagraph(html, fragment, options.paragraphPatterns ?? []);
  if (byParagraph.insertedContextually) return byParagraph.html;

  return appendBeforeClosingContainer(html, fragment);
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
  if (normalized.includes(`href=\"${href.toLowerCase()}\"`) || normalized.includes(`href='${href.toLowerCase()}'`)) {
    return { html, inserted: false };
  }

  const fragment = `<p>Explore our <a href="${href}">${escapeHtml(request.productTopic)}</a> solutions for additional product specifications, turnkey package details, and display options.</p>`;
  return {
    html: insertContextually(html, fragment, {
      sectionPatterns: [/choosing the right/i, /what is an indoor digital sphere/i, /benefits of indoor digital spheres/i],
      paragraphPatterns: [/product specifications/i, /display options/i, /pixel pitch/i],
    }),
    inserted: true,
  };
}

function ensureRelatedProductLinks(html: string, request: GlwGenerationRequest): { html: string; inserted: number } {
  if (request.pageType !== "state_service") return { html, inserted: 0 };

  let nextHtml = html;
  let inserted = 0;

  for (const related of RELATED_PRODUCT_LINKS) {
    if (inserted >= 2) break;

    const normalized = normalizeHtmlForSearch(nextHtml);
    if (normalized.includes(`href=\"${related.href.toLowerCase()}\"`) || normalized.includes(`href='${related.href.toLowerCase()}'`)) {
      continue;
    }

    const contextPresent = [...related.sectionPatterns, ...related.paragraphPatterns].some((pattern) => pattern.test(nextHtml));
    if (!contextPresent) continue;

    const fragment = `<p>${escapeHtml(related.sentence)} <a href="${related.href}">${escapeHtml(related.label)}</a>.</p>`;
    nextHtml = insertContextually(nextHtml, fragment, {
      sectionPatterns: related.sectionPatterns,
      paragraphPatterns: related.paragraphPatterns,
    });
    inserted += 1;
  }

  return { html: nextHtml, inserted };
}

function ensureCorporateLink(html: string): { html: string; inserted: boolean } {
  const normalized = normalizeHtmlForSearch(html);
  if (normalized.includes("href=\"https://ssidisplays.com") || normalized.includes("href='https://ssidisplays.com")) {
    return { html, inserted: false };
  }

  const fragment = `<p>For custom engineering, integration, and broader display-system support, visit <a href="https://ssidisplays.com/" target="_blank" rel="noopener noreferrer">Screen Solutions International</a>.</p>`;
  return {
    html: insertContextually(html, fragment, {
      sectionPatterns: [/integration/i, /installation and implementation/i, /plan your/i, /ready to transform/i],
      paragraphPatterns: [/engineering/i, /integration/i, /implementation/i, /support/i],
    }),
    inserted: true,
  };
}

function ensureOutboundAuthorityLink(html: string): { html: string; inserted: boolean } {
  const normalized = normalizeHtmlForSearch(html);
  if (normalized.includes("href=\"https://www.energy.gov/") || normalized.includes("href='https://www.energy.gov/")) {
    return { html, inserted: false };
  }

  const fragment = `<p>For facility teams evaluating electrical planning and energy use, the <a href="https://www.energy.gov/energysaver" target="_blank" rel="noopener noreferrer">U.S. Department of Energy Energy Saver</a> provides additional efficiency guidance.</p>`;
  return {
    html: insertContextually(html, fragment, {
      sectionPatterns: [/installation and implementation/i, /pre-installation planning/i, /material and performance/i],
      paragraphPatterns: [/electrical/i, /power supply/i, /energy use/i, /power and cabling/i],
    }),
    inserted: true,
  };
}

function ensureStateAuthorityLink(html: string, request: GlwGenerationRequest): { html: string; inserted: boolean; domain: string | null } {
  if (request.pageType !== "state_service") return { html, inserted: false, domain: null };
  const authority = STATE_AUTHORITY_LINKS[request.stateCode];
  if (!authority) return { html, inserted: false, domain: null };

  const normalized = normalizeHtmlForSearch(html);
  const domain = new URL(authority.href).hostname;
  if (normalized.includes(authority.href.toLowerCase())) {
    return { html, inserted: false, domain };
  }

  const fragment = `<p>${escapeHtml(authority.sentence)} <a href="${authority.href}" target="_blank" rel="noopener noreferrer">${escapeHtml(authority.label)}</a>.</p>`;
  return {
    html: insertContextually(html, fragment, {
      sectionPatterns: [/popular local applications/i, /use cases/i, /plan your/i, /buying criteria/i],
      paragraphPatterns: [/businesses/i, /commercial/i, /facilities/i, /events/i],
    }),
    inserted: true,
    domain,
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
  return {
    html: insertContextually(html, fragment, {
      sectionPatterns: [/lighting and environmental/i, /material and performance/i, /maintenance and longevity/i],
      paragraphPatterns: [/environmental conditions/i, /humidity/i, /temperature/i, /climate/i],
    }),
    inserted: true,
    domain: "weather.gov",
  };
}

export function enrichGlwGeneratedContentForSeo(input: {
  artifact: GlwGeneratedDraftArtifact;
  request: GlwGenerationRequest;
}): GlwSeoEnrichmentResult {
  let html = input.artifact.contentHtml ?? "";

  const product = ensureProductAuthorityLink(html, input.request);
  html = product.html;

  const relatedProducts = ensureRelatedProductLinks(html, input.request);
  html = relatedProducts.html;

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
      relatedProductLinks: relatedProducts.inserted,
      corporateLink: corporate.inserted,
      outboundAuthorityLink: outbound.inserted,
      localAuthorityLink: localAuthority.inserted,
      weatherAuthorityLink: weatherAuthority.inserted,
    },
    approvedExternalDomains,
  };
}
