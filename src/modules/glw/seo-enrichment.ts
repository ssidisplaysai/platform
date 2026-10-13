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

type GlwManagedLink = {
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
  AK: { href: "https://www.commerce.alaska.gov/web/", label: "Alaska Department of Commerce, Community, and Economic Development", sentence: "For statewide business, licensing, and development resources in Alaska, consult the Alaska Department of Commerce, Community, and Economic Development" },
  AL: { href: "https://www.madeinalabama.com/", label: "Alabama Department of Commerce", sentence: "For statewide economic-development and business-location resources in Alabama, consult the Alabama Department of Commerce" },
  AR: { href: "https://www.arkansasedc.com/", label: "Arkansas Economic Development Commission", sentence: "For commercial development and business resources in Arkansas, consult the Arkansas Economic Development Commission" },
  AZ: { href: "https://www.azcommerce.com/", label: "Arizona Commerce Authority", sentence: "For statewide business, expansion, and economic-development resources in Arizona, consult the Arizona Commerce Authority" },
  CA: { href: "https://business.ca.gov/", label: "California Governor's Office of Business and Economic Development", sentence: "For statewide business, permitting, and economic-development resources in California, consult the Governor's Office of Business and Economic Development" },
  CO: { href: "https://oedit.colorado.gov/", label: "Colorado Office of Economic Development and International Trade", sentence: "For statewide business and development resources in Colorado, consult the Colorado Office of Economic Development and International Trade" },
  CT: { href: "https://portal.ct.gov/decd", label: "Connecticut Department of Economic and Community Development", sentence: "For organizations planning facilities, events, and commercial investments in Connecticut, the Connecticut Department of Economic and Community Development provides statewide business and development resources" },
  DE: { href: "https://business.delaware.gov/", label: "Delaware Division of Small Business", sentence: "For statewide business resources and development guidance in Delaware, consult the Delaware Division of Small Business" },
  FL: { href: "https://www.floridajobs.org/", label: "Florida Department of Commerce", sentence: "For statewide economic-development and workforce resources in Florida, consult the Florida Department of Commerce" },
  GA: { href: "https://georgia.org/", label: "Georgia Department of Economic Development", sentence: "For statewide business and development resources in Georgia, consult the Georgia Department of Economic Development" },
  HI: { href: "https://dbedt.hawaii.gov/", label: "Hawaii Department of Business, Economic Development and Tourism", sentence: "For statewide business, economic, and tourism-development resources in Hawaii, consult the Hawaii Department of Business, Economic Development and Tourism" },
  IA: { href: "https://www.iowaeda.com/", label: "Iowa Economic Development Authority", sentence: "For statewide business and development resources in Iowa, consult the Iowa Economic Development Authority" },
  ID: { href: "https://commerce.idaho.gov/", label: "Idaho Department of Commerce", sentence: "For statewide business and economic-development resources in Idaho, consult the Idaho Department of Commerce" },
  IL: { href: "https://dceo.illinois.gov/", label: "Illinois Department of Commerce and Economic Opportunity", sentence: "For statewide business and development resources in Illinois, consult the Illinois Department of Commerce and Economic Opportunity" },
  IN: { href: "https://www.iedc.in.gov/", label: "Indiana Economic Development Corporation", sentence: "For statewide business and development resources in Indiana, consult the Indiana Economic Development Corporation" },
  KS: { href: "https://www.kansascommerce.gov/", label: "Kansas Department of Commerce", sentence: "For statewide business and development resources in Kansas, consult the Kansas Department of Commerce" },
  KY: { href: "https://ced.ky.gov/", label: "Kentucky Cabinet for Economic Development", sentence: "For statewide business and development resources in Kentucky, consult the Kentucky Cabinet for Economic Development" },
  LA: { href: "https://www.opportunitylouisiana.gov/", label: "Louisiana Economic Development", sentence: "For statewide business and development resources in Louisiana, consult Louisiana Economic Development" },
  MA: { href: "https://www.mass.gov/orgs/executive-office-of-economic-development", label: "Massachusetts Executive Office of Economic Development", sentence: "For statewide business and development resources in Massachusetts, consult the Executive Office of Economic Development" },
  MD: { href: "https://commerce.maryland.gov/", label: "Maryland Department of Commerce", sentence: "For statewide business and development resources in Maryland, consult the Maryland Department of Commerce" },
  ME: { href: "https://www.maine.gov/decd/", label: "Maine Department of Economic and Community Development", sentence: "For statewide business and development resources in Maine, consult the Maine Department of Economic and Community Development" },
  MI: { href: "https://www.michiganbusiness.org/", label: "Michigan Economic Development Corporation", sentence: "For statewide business and development resources in Michigan, consult the Michigan Economic Development Corporation" },
  MN: { href: "https://mn.gov/deed/", label: "Minnesota Department of Employment and Economic Development", sentence: "For statewide business and development resources in Minnesota, consult the Minnesota Department of Employment and Economic Development" },
  MO: { href: "https://ded.mo.gov/", label: "Missouri Department of Economic Development", sentence: "For statewide business and development resources in Missouri, consult the Missouri Department of Economic Development" },
  MS: { href: "https://mississippi.org/", label: "Mississippi Development Authority", sentence: "For statewide business and development resources in Mississippi, consult the Mississippi Development Authority" },
  MT: { href: "https://commerce.mt.gov/", label: "Montana Department of Commerce", sentence: "For statewide business and development resources in Montana, consult the Montana Department of Commerce" },
  NC: { href: "https://www.commerce.nc.gov/", label: "North Carolina Department of Commerce", sentence: "For statewide business and development resources in North Carolina, consult the North Carolina Department of Commerce" },
  ND: { href: "https://www.commerce.nd.gov/", label: "North Dakota Department of Commerce", sentence: "For statewide business and development resources in North Dakota, consult the North Dakota Department of Commerce" },
  NE: { href: "https://opportunity.nebraska.gov/", label: "Nebraska Department of Economic Development", sentence: "For statewide business and development resources in Nebraska, consult the Nebraska Department of Economic Development" },
  NH: { href: "https://www.nheconomy.com/", label: "New Hampshire Division of Economic Development", sentence: "For statewide business and development resources in New Hampshire, consult the New Hampshire Division of Economic Development" },
  NJ: { href: "https://www.njeda.gov/", label: "New Jersey Economic Development Authority", sentence: "For statewide business and development resources in New Jersey, consult the New Jersey Economic Development Authority" },
  NM: { href: "https://edd.newmexico.gov/", label: "New Mexico Economic Development Department", sentence: "For statewide business and development resources in New Mexico, consult the New Mexico Economic Development Department" },
  NV: { href: "https://goed.nv.gov/", label: "Nevada Governor's Office of Economic Development", sentence: "For statewide business and development resources in Nevada, consult the Governor's Office of Economic Development" },
  NY: { href: "https://esd.ny.gov/", label: "Empire State Development", sentence: "For statewide business and development resources in New York, consult Empire State Development" },
  OH: { href: "https://development.ohio.gov/", label: "Ohio Department of Development", sentence: "For statewide business and development resources in Ohio, consult the Ohio Department of Development" },
  OK: { href: "https://www.okcommerce.gov/", label: "Oklahoma Department of Commerce", sentence: "For statewide business and development resources in Oklahoma, consult the Oklahoma Department of Commerce" },
  OR: { href: "https://www.oregon.gov/biz/", label: "Business Oregon", sentence: "For statewide business and development resources in Oregon, consult Business Oregon" },
  PA: { href: "https://dced.pa.gov/", label: "Pennsylvania Department of Community and Economic Development", sentence: "For statewide business and development resources in Pennsylvania, consult the Pennsylvania Department of Community and Economic Development" },
  RI: { href: "https://commerceri.com/", label: "Rhode Island Commerce", sentence: "For statewide business and development resources in Rhode Island, consult Rhode Island Commerce" },
  SC: { href: "https://www.sccommerce.com/", label: "South Carolina Department of Commerce", sentence: "For statewide business and development resources in South Carolina, consult the South Carolina Department of Commerce" },
  SD: { href: "https://sdgoed.com/", label: "South Dakota Governor's Office of Economic Development", sentence: "For statewide business and development resources in South Dakota, consult the Governor's Office of Economic Development" },
  TN: { href: "https://tnecd.com/", label: "Tennessee Department of Economic and Community Development", sentence: "For statewide business and development resources in Tennessee, consult the Tennessee Department of Economic and Community Development" },
  TX: { href: "https://gov.texas.gov/business", label: "Texas Economic Development and Tourism Office", sentence: "For statewide business and development resources in Texas, consult the Texas Economic Development and Tourism Office" },
  UT: { href: "https://business.utah.gov/", label: "Utah Governor's Office of Economic Opportunity", sentence: "For statewide business and development resources in Utah, consult the Governor's Office of Economic Opportunity" },
  VA: { href: "https://www.vedp.org/", label: "Virginia Economic Development Partnership", sentence: "For statewide business and development resources in Virginia, consult the Virginia Economic Development Partnership" },
  VT: { href: "https://accd.vermont.gov/economic-development", label: "Vermont Department of Economic Development", sentence: "For statewide business and development resources in Vermont, consult the Vermont Department of Economic Development" },
  WA: { href: "https://www.commerce.wa.gov/", label: "Washington State Department of Commerce", sentence: "For statewide business and development resources in Washington, consult the Washington State Department of Commerce" },
  WI: { href: "https://wedc.org/", label: "Wisconsin Economic Development Corporation", sentence: "For statewide business and development resources in Wisconsin, consult the Wisconsin Economic Development Corporation" },
  WV: { href: "https://westvirginia.gov/", label: "West Virginia Department of Economic Development", sentence: "For statewide business and development resources in West Virginia, consult the West Virginia Department of Economic Development" },
  WY: { href: "https://wyomingbusiness.org/", label: "Wyoming Business Council", sentence: "For statewide business and development resources in Wyoming, consult the Wyoming Business Council" },
};

const RELATED_PRODUCT_LINKS: readonly GlwRelatedProductLink[] = [
  { href: "/outdoor-digital-sphere/", label: "Outdoor Digital Sphere", sentence: "For exterior venues or projects that need weather-rated spherical LED, compare our outdoor digital sphere solutions.", sectionPatterns: [/lighting and environmental/i, /material and performance/i, /use cases/i], paragraphPatterns: [/outdoor/i, /weather/i, /environmental/i, /exterior/i] },
  { href: "/indoor-led-video-wall/", label: "Indoor LED Video Wall", sentence: "For applications better suited to a traditional large-format surface, explore our indoor LED video wall options.", sectionPatterns: [/comparison table/i, /choosing the right/i, /buying criteria/i], paragraphPatterns: [/flat display/i, /video wall/i, /traditional display/i, /large-format/i] },
  { href: "/transparent-oled-display/", label: "Transparent OLED Display", sentence: "For retail and architectural applications where transparency is part of the experience, see our transparent OLED display solutions.", sectionPatterns: [/popular local applications/i, /use cases/i, /future trends/i], paragraphPatterns: [/retail/i, /transparent/i, /architectural/i, /window/i] },
  { href: "/outdoor-digital-kiosk/", label: "Outdoor Digital Kiosk", sentence: "For interactive wayfinding, self-service, or public-facing information, our outdoor digital kiosk options can complement a broader display deployment.", sectionPatterns: [/use cases/i, /popular local applications/i, /interactive/i], paragraphPatterns: [/wayfinding/i, /interactive/i, /self-service/i, /kiosk/i] },
];

function escapeHtml(value: string): string { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"); }
function normalizeHtmlForSearch(value: string): string { return value.toLowerCase().replace(/\s+/g, " "); }
function appendBeforeClosingContainer(html: string, fragment: string): string { for (const closingTag of ["</main>", "</article>", "</body>"]) { const index = html.toLowerCase().lastIndexOf(closingTag); if (index >= 0) return `${html.slice(0, index)}${fragment}\n${html.slice(index)}`; } return `${html.trimEnd()}\n${fragment}`; }
function insertAfterMatchingParagraph(html: string, fragment: string, patterns: readonly RegExp[]): { html: string; insertedContextually: boolean } { for (const pattern of patterns) { const paragraphPattern = new RegExp(`<p\\b[^>]*>[\\s\\S]*?${pattern.source}[\\s\\S]*?<\\/p>`, "i"); const match = html.match(paragraphPattern); if (match && typeof match.index === "number") { const end = match.index + match[0].length; return { html: `${html.slice(0, end)}\n${fragment}${html.slice(end)}`, insertedContextually: true }; } } return { html, insertedContextually: false }; }
function insertAfterMatchingSection(html: string, fragment: string, patterns: readonly RegExp[]): { html: string; insertedContextually: boolean } { for (const pattern of patterns) { const headingPattern = new RegExp(`<h[2-4]\\b[^>]*>[\\s\\S]*?${pattern.source}[\\s\\S]*?<\\/h[2-4]>`, "i"); const headingMatch = html.match(headingPattern); if (!headingMatch || typeof headingMatch.index !== "number") continue; const start = headingMatch.index + headingMatch[0].length; const tail = html.slice(start); const nextHeading = tail.search(/<h[2-4]\b/i); const sectionEnd = nextHeading >= 0 ? start + nextHeading : html.length; const sectionHtml = html.slice(start, sectionEnd); const paragraphMatches = [...sectionHtml.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)]; if (paragraphMatches.length > 0) { const lastParagraph = paragraphMatches[paragraphMatches.length - 1]; const end = start + (lastParagraph.index ?? 0) + lastParagraph[0].length; return { html: `${html.slice(0, end)}\n${fragment}${html.slice(end)}`, insertedContextually: true }; } return { html: `${html.slice(0, start)}\n${fragment}${html.slice(start)}`, insertedContextually: true }; } return { html, insertedContextually: false }; }
function insertContextually(html: string, fragment: string, options: { sectionPatterns?: readonly RegExp[]; paragraphPatterns?: readonly RegExp[] }): string { const bySection = insertAfterMatchingSection(html, fragment, options.sectionPatterns ?? []); if (bySection.insertedContextually) return bySection.html; const byParagraph = insertAfterMatchingParagraph(html, fragment, options.paragraphPatterns ?? []); if (byParagraph.insertedContextually) return byParagraph.html; return appendBeforeClosingContainer(html, fragment); }
function removeManagedParagraphs(html: string, hrefs: readonly string[]): string { let nextHtml = html; for (const href of hrefs) { const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const paragraphPattern = new RegExp(`<p\\b[^>]*>[\\s\\S]*?href\\s*=\\s*[\"']${escapedHref}[\"'][\\s\\S]*?<\\/p>\\s*`, "gi"); nextHtml = nextHtml.replace(paragraphPattern, ""); } return nextHtml; }
function buildFocusKeyphrase(request: GlwGenerationRequest): string { const location = request.cityName?.trim() || request.stateName?.trim() || ""; return [request.productTopic.trim(), location].filter(Boolean).join(" "); }
function buildSeoTitle(request: GlwGenerationRequest): string { const configured = request.seoTitle?.trim(); if (configured) return configured; const location = request.cityName?.trim() || request.stateName?.trim() || ""; return `${request.productTopic}${location ? ` in ${location}` : ""} | ${request.siteName}`; }
function buildMetaDescription(request: GlwGenerationRequest): string { const configured = request.metaDescription?.trim(); if (configured) return configured; const location = request.cityName?.trim() || request.stateName?.trim() || "your market"; return `Explore turnkey ${request.productTopic.toLowerCase()} solutions in ${location} from ${request.siteName}, including display options, controls, installation planning, and support.`; }
function ensureProductAuthorityLink(html: string, request: GlwGenerationRequest): { html: string; inserted: boolean } {
  if (request.pageType !== "state_service") return { html, inserted: false };
  const firstPathSegment = request.canonicalPath.split("/").filter(Boolean)[0] ?? "";
  if (!firstPathSegment) return { html, inserted: false };
  const href = `/${firstPathSegment}/`;
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedTopic = request.productTopic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exactAnchorPattern = new RegExp(`<a\\b[^>]*href\\s*=\\s*["']${escapedHref}["'][^>]*>\\s*${escapedTopic}\\s*<\\/a>`, "i");
  if (exactAnchorPattern.test(html)) return { html, inserted: false };

  const mismatchedAnchorPattern = new RegExp(`<a\\b([^>]*?)href\\s*=\\s*["']${escapedHref}["']([^>]*)>[\\s\\S]*?<\\/a>`, "gi");
  const correctedAnchor = `<a href="${href}">${escapeHtml(request.productTopic)}</a>`;
  let replaced = false;
  const healedHtml = html.replace(mismatchedAnchorPattern, () => {
    replaced = true;
    return correctedAnchor;
  });
  if (replaced && exactAnchorPattern.test(healedHtml)) return { html: healedHtml, inserted: true };

  const fragment = `<p>Explore our ${correctedAnchor} solutions for additional product specifications, turnkey package details, and display options.</p>`;
  return { html: insertContextually(healedHtml, fragment, { sectionPatterns: [/choosing the right/i, /what is an indoor digital sphere/i, /benefits of indoor digital spheres/i], paragraphPatterns: [/product specifications/i, /display options/i, /pixel pitch/i] }), inserted: true };
}
function ensureRelatedProductLinks(html: string, request: GlwGenerationRequest): { html: string; inserted: number } { if (request.pageType !== "state_service") return { html, inserted: 0 }; let nextHtml = html; let inserted = 0; for (const related of RELATED_PRODUCT_LINKS) { if (inserted >= 2) break; const normalized = normalizeHtmlForSearch(nextHtml); if (normalized.includes(`href=\"${related.href.toLowerCase()}\"`) || normalized.includes(`href='${related.href.toLowerCase()}'`)) continue; const contextPresent = [...related.sectionPatterns, ...related.paragraphPatterns].some((pattern) => pattern.test(nextHtml)); if (!contextPresent) continue; const fragment = `<p>${escapeHtml(related.sentence)} <a href="${related.href}">${escapeHtml(related.label)}</a>.</p>`; nextHtml = insertContextually(nextHtml, fragment, { sectionPatterns: related.sectionPatterns, paragraphPatterns: related.paragraphPatterns }); inserted += 1; } return { html: nextHtml, inserted }; }
function ensureManagedLink(html: string, managed: GlwManagedLink): { html: string; inserted: boolean } { const fragment = `<p>${escapeHtml(managed.sentence)} <a href="${managed.href}" target="_blank" rel="noopener noreferrer">${escapeHtml(managed.label)}</a>.</p>`; return { html: insertContextually(html, fragment, { sectionPatterns: managed.sectionPatterns, paragraphPatterns: managed.paragraphPatterns }), inserted: true }; }

export function enrichGlwGeneratedContentForSeo(input: { artifact: GlwGeneratedDraftArtifact; request: GlwGenerationRequest }): GlwSeoEnrichmentResult {
  let html = input.artifact.contentHtml ?? "";
  const product = ensureProductAuthorityLink(html, input.request); html = product.html;
  const relatedProducts = ensureRelatedProductLinks(html, input.request); html = relatedProducts.html;
  const stateAuthority = input.request.pageType === "state_service" ? STATE_AUTHORITY_LINKS[input.request.stateCode] : undefined;
  const weatherContextPresent = input.request.pageType === "state_service" && /weather|climate|humidity|temperature|outdoor|environmental/i.test(html);
  const managedLinks: GlwManagedLink[] = [
    { href: "https://ssidisplays.com/", label: "Screen Solutions International", sentence: "For custom engineering, integration, and broader display-system support, visit Screen Solutions International", sectionPatterns: [/integration/i, /installation and implementation/i, /plan your/i, /ready to transform/i], paragraphPatterns: [/engineering/i, /integration/i, /implementation/i, /support/i] },
    { href: "https://www.energy.gov/energysaver", label: "U.S. Department of Energy Energy Saver", sentence: "For facility teams evaluating electrical planning and energy use, the U.S. Department of Energy Energy Saver provides additional efficiency guidance", sectionPatterns: [/installation and implementation/i, /pre-installation planning/i, /material and performance/i], paragraphPatterns: [/electrical/i, /power supply/i, /energy use/i, /power and cabling/i] },
  ];
  if (stateAuthority) managedLinks.push({ href: stateAuthority.href, label: stateAuthority.label, sentence: stateAuthority.sentence, sectionPatterns: [/popular local applications/i, /use cases/i, /plan your/i, /buying criteria/i], paragraphPatterns: [/businesses/i, /commercial/i, /facilities/i, /events/i] });
  if (weatherContextPresent) { const stateName = input.request.stateName?.trim() || "the project area"; managedLinks.push({ href: "https://www.weather.gov/", label: "National Weather Service", sentence: `When installation planning depends on local environmental conditions in ${stateName}, consult the National Weather Service for official weather and climate information`, sectionPatterns: [/lighting and environmental/i, /material and performance/i, /maintenance and longevity/i], paragraphPatterns: [/environmental conditions/i, /humidity/i, /temperature/i, /climate/i] }); }
  html = removeManagedParagraphs(html, managedLinks.map((link) => link.href));
  let corporateInserted = false; let outboundInserted = false; let localAuthorityInserted = false; let weatherAuthorityInserted = false;
  for (const managed of managedLinks) { const result = ensureManagedLink(html, managed); html = result.html; if (managed.href === "https://ssidisplays.com/") corporateInserted = result.inserted; else if (managed.href === "https://www.energy.gov/energysaver") outboundInserted = result.inserted; else if (managed.href === "https://www.weather.gov/") weatherAuthorityInserted = result.inserted; else localAuthorityInserted = result.inserted; }
  const approvedExternalDomains = ["ssidisplays.com", "energy.gov", stateAuthority ? new URL(stateAuthority.href).hostname : null, weatherContextPresent ? "weather.gov" : null].filter((value): value is string => Boolean(value));
  return { artifact: { ...input.artifact, contentHtml: html }, metadata: { focusKeyphrase: buildFocusKeyphrase(input.request), seoTitle: buildSeoTitle(input.request), metaDescription: buildMetaDescription(input.request) }, inserted: { productAuthorityLink: product.inserted, relatedProductLinks: relatedProducts.inserted, corporateLink: corporateInserted, outboundAuthorityLink: outboundInserted, localAuthorityLink: localAuthorityInserted, weatherAuthorityLink: weatherAuthorityInserted }, approvedExternalDomains };
}