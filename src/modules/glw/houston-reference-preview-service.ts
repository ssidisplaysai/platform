import "server-only";

import { createHash } from "node:crypto";

import {
  APPLICATION_AUTHORITY_CONTRACT,
  deriveLocalThemeProfile,
  LOCAL_CONTEXT_CONTRACT,
  LOCALIZED_COMPOSITION_PLAN_CONTRACT,
  LOCAL_LINK_GRAPH_CONTRACT,
  validateApplicationAuthority,
  validateLocalizedMedia,
  validateLocalContext,
  validateLocalLinkGraph,
  type LocalResearchEvidence,
  type LocalizedMediaPlanItem,
  type SitePageApplicationAuthority,
  type SitePageLocalContext,
  type SitePageLocalLinkGraph,
} from "@/modules/foundation/local-context-page-theming";
import {
  getLocalPageThemingBundle,
  saveLocalPageThemingBundle,
  saveLocalPageThemingMedia,
  type LocalPageThemingBundle,
} from "@/modules/foundation/local-context-page-theming-repository";
import {
  createCampaignDiscoveryRecommendations,
  createCrossSellGraph,
  createMarketProductOpportunity,
  createPageStrategyRecommendation,
  createSiteOpportunityBlueprint,
  mapMarketSignalsToApplications,
  MARKET_INTELLIGENCE_CONTRACT,
  validateMarketIntelligence,
  type CatalogAuthorityItem,
  type MarketEvidence,
  type OpportunityScoreComponent,
  type SiteMarketIntelligence,
} from "@/modules/foundation/local-market-product-match";
import {
  getMarketProductMatchBundle,
  saveMarketProductMatchBundle,
  type MarketProductMatchBundle,
} from "@/modules/foundation/local-market-product-match-repository";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { listAllGlwCampaignTargets } from "./campaign-target-repository";
import { generateGenesisFeaturedImage } from "./generated-image-service";
import { generateGenesisFeaturedImageWithCampaignReferences } from "./reference-aware-image-service";
import {
  HOUSTON_BUNDLE_ID,
  HOUSTON_CANONICAL_PATH,
  HOUSTON_MARKET_BUNDLE_ID,
  HOUSTON_NARRATIVE,
  HOUSTON_PREVIEW_ID,
  HOUSTON_PRODUCT_ID,
  HOUSTON_PRODUCT_MEDIA_HASH,
  HOUSTON_PRODUCT_MEDIA_ID,
  HOUSTON_PRODUCT_MEDIA_URL,
  HOUSTON_TARGET_ID,
  type HoustonReferencePreview,
} from "./houston-reference-preview";

const CAMPAIGN_ID = "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-texas-cities";
const MARKET_ID = "market-houston-southeast-texas";
const CREATED_BY = "HOUSTON_REFERENCE_PAGE_GENERATION_FROM_DALLAS_LEARNINGS_V1";
const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86_400_000).toISOString();
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

const SOURCES = [
  ["product", "https://projectorenclosure.com/fan-cooled-projector-enclosures/", "Fan Cooled Projector Enclosures", "ProjectorEnclosure / Screen Solutions International", "OWNER_AUTHORITY", "The approved Integrator product authority supports indoor, covered outdoor, and mild-environment commercial AV and projection applications."],
  ["climate-controlled", "https://projectorenclosure.com/climate-controlled-projector-enclosures/", "Climate Controlled Projector Enclosures", "ProjectorEnclosure / Screen Solutions International", "OFFICIAL_BRAND", "The approved Defender resource directs outdoor, exposed, humid, hot, and harsh environments to climate-controlled project review."],
  ["outdoor", "https://projectorenclosure.com/ip65-projector-enclosures-for-outdoor-applications/", "IP65 Projector Enclosures for Outdoor Applications", "ProjectorEnclosure / Screen Solutions International", "OFFICIAL_BRAND", "The official outdoor resource distinguishes weather-rated protection from standard indoor or sheltered enclosures."],
  ["contact", "https://projectorenclosure.com/contact-us-projection-enclosure/", "Project Review and Contact", "ProjectorEnclosure / Screen Solutions International", "OFFICIAL_BRAND", "The official conversion path requests projector and installation details for enclosure review."],
  ["houston-climate", "https://www.weather.gov/hgx/climate_iah_normals_summary", "Houston IAH Extremes, Normals, and Annual Summaries", "National Weather Service Houston/Galveston", "GOVERNMENT", "Official 1991-2020 normals report 51.84 inches annual rainfall, summer average highs above 92 F, and a 109 F record high."],
  ["houston-first", "https://www.houstonfirst.com/venues/", "Houston First Venues", "Houston First Corporation", "OFFICIAL_INSTITUTION", "Houston First manages city-owned convention, theater, performing-arts, outdoor, and hospitality facilities used for conventions, trade shows, and performances."],
  ["grb", "https://www.grbhouston.com/about-us/", "George R. Brown Convention Center", "Houston First Corporation", "OFFICIAL_VENUE", "The official venue documents 1.8 million square feet, more than 700,000 square feet of exhibit space, 88 configurable meeting rooms, and outdoor event space."],
  ["public-art", "https://houstonartsalliance.com/public-art", "Houston Civic Art", "Houston Arts Alliance", "OFFICIAL_INSTITUTION", "Houston's local arts agency documents a civic art collection of more than 870 works and public-art planning services."],
  ["museum-district", "https://houmuse.org/about/", "Houston Museum District", "Houston Museum District", "OFFICIAL_INSTITUTION", "The district documents 21 institutions across art, history, science, and other visitor-facing disciplines in a four-square-mile area."],
  ["port-houston", "https://porthouston.com/about/our-port/about-port-houston/", "Port Houston Overview", "Port Houston", "OFFICIAL_INSTITUTION", "Port Houston documents eight public facilities along the 52-mile Houston Ship Channel and a large industrial and commercial operating context."],
] as const;

async function evidence(fetcher: typeof fetch, now: string): Promise<LocalResearchEvidence[]> {
  return Promise.all(SOURCES.map(async ([evidenceId, url, title, publisher, sourceClass, observedClaim]) => {
    const response = await fetcher(url, { method: "GET", redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`HOUSTON_RESEARCH_SOURCE_UNAVAILABLE:${evidenceId}:${response.status}`);
    return { evidenceId, url, title, publisher, sourceClass, retrievedAt: now, verifiedAt: now, httpStatus: response.status, observedClaim };
  }));
}

const score = (values: Partial<Record<OpportunityScoreComponent["dimension"], OpportunityScoreComponent["value"]>>, evidenceIds: readonly string[]): OpportunityScoreComponent[] =>
  (["MARKET_EVIDENCE_STRENGTH", "VERTICAL_FIT", "APPLICATION_FIT", "PRODUCT_FIT", "LOCAL_CONDITION_FIT", "COMMERCIAL_INTENT", "CATALOG_AUTHORITY_CONFIDENCE"] as const).map((dimension) => ({ dimension, value: values[dimension] ?? "HIGH", rationale: `${dimension.replaceAll("_", " ")} is ${values[dimension] ?? "HIGH"} for the cited Houston evidence and approved catalog authority.`, evidenceIds }));

async function buildMarket(local: LocalPageThemingBundle, now: string): Promise<MarketProductMatchBundle> {
  const existing = getMarketProductMatchBundle({ organizationId: "ssi", bundleId: HOUSTON_MARKET_BUNDLE_ID });
  if (existing) return existing;
  const market = { marketId: MARKET_ID, geography: { city: "Houston", state: "Texas", region: "Greater Houston / Southeast Texas", countryCode: "US" }, scope: "Houston commercial, convention, hospitality, institutional, cultural, industrial, and environmentally exposed projection planning" };
  const marketEvidence: MarketEvidence[] = local.context.evidence.map((item) => ({ evidenceId: item.evidenceId, url: item.url, publisher: item.publisher, sourceClass: item.sourceClass === "OFFICIAL_BRAND" ? "OWNER_AUTHORITY" : item.sourceClass, observedClaim: item.observedClaim, retrievedAt: item.retrievedAt, validThrough: addDays(item.verifiedAt, 365), httpStatus: item.httpStatus }));
  const signals: SiteMarketIntelligence["signals"] = [
    { signalId: "convention-hospitality", signalClass: "CONVENTION_TOURISM", statement: "Official Houston First and GRB evidence establishes a large convention, meeting, hospitality, and event environment.", buyerVerticals: ["convention operators", "hospitality AV", "event producers"], evidenceIds: ["houston-first", "grb"], evidenceStrength: "STRONG", freshness: "CURRENT" },
    { signalId: "commercial-av", signalClass: "VENUE_ECOSYSTEM", statement: "City-owned convention, theater, performance, outdoor, and hotel facilities create varied commercial AV planning contexts.", buyerVerticals: ["AV integrators", "facility planners", "venue operators"], evidenceIds: ["houston-first", "grb"], evidenceStrength: "STRONG", freshness: "CURRENT" },
    { signalId: "arts-museums", signalClass: "MUSEUM_ATTRACTION_ECOSYSTEM", statement: "Houston Arts Alliance and the Museum District document substantial civic-art, museum, science, and visitor-facing environments.", buyerVerticals: ["museums", "cultural institutions", "experience designers"], evidenceIds: ["public-art", "museum-district"], evidenceStrength: "STRONG", freshness: "CURRENT" },
    { signalId: "experiential", signalClass: "EVENTS_EXPERIENTIAL", statement: "Convention, performing-arts, civic-art, and museum evidence supports evaluation of experiential visual systems without proving enclosure demand.", buyerVerticals: ["event producers", "experience designers", "AV integrators"], evidenceIds: ["grb", "public-art", "museum-district"], evidenceStrength: "MODERATE", freshness: "CURRENT" },
    { signalId: "industrial-commercial", signalClass: "COMMERCIAL_REAL_ESTATE", statement: "Port Houston documents a large industrial, logistics, and commercial facilities context along the Ship Channel.", buyerVerticals: ["corporate facilities", "industrial facilities", "commercial developers"], evidenceIds: ["port-houston"], evidenceStrength: "MODERATE", freshness: "CURRENT" },
    { signalId: "heat-humidity-rain", signalClass: "CLIMATE_EXPOSURE", statement: "Official Houston normals document high summer temperatures and 51.84 inches of annual rainfall, requiring explicit exposure and humidity review.", buyerVerticals: ["facility planners", "AV integrators"], evidenceIds: ["houston-climate", "climate-controlled", "outdoor"], evidenceStrength: "STRONG", freshness: "CURRENT" },
    { signalId: "outdoor-boundary", signalClass: "OUTDOOR_ENVIRONMENT", statement: "Houston has outdoor event contexts, but approved product authority directs exposed, humid, harsh, or permanent outdoor systems away from standard fan-cooled selection.", buyerVerticals: ["venue operators", "public-space planners"], evidenceIds: ["houston-first", "houston-climate", "climate-controlled", "outdoor"], evidenceStrength: "STRONG", freshness: "CURRENT" },
  ];
  const intelligence = validateMarketIntelligence({ contract: MARKET_INTELLIGENCE_CONTRACT, schemaVersion: 1, intelligenceId: "market-intelligence-houston-southeast-texas-r1", organizationId: "ssi", market, researchRevision: 1, evidence: marketEvidence, signals, competitiveIntensity: "NOT_EVALUATED", createdAt: now, provenance: "Fresh governed synthesis of official Houston, Southeast Texas, and current ProjectorEnclosure product authority; no Dallas local evidence reused." }, now);
  const rules = [
    { applicationId: "COMMERCIAL_AV", requiredSignalClasses: ["VENUE_ECOSYSTEM"], rationale: "Documented commercial venues support commercial AV evaluation." },
    { applicationId: "EVENT_VENUE", requiredSignalClasses: ["VENUE_ECOSYSTEM", "CONVENTION_TOURISM"], rationale: "Venue and convention evidence are both required." },
    { applicationId: "PROJECTION_MAPPING", requiredSignalClasses: ["EVENTS_EXPERIENTIAL", "MUSEUM_ATTRACTION_ECOSYSTEM"], rationale: "Experiential and cultural evidence support bounded projection-mapping evaluation." },
    { applicationId: "OUTDOOR_PROJECTION", requiredSignalClasses: ["OUTDOOR_ENVIRONMENT", "CLIMATE_EXPOSURE"], rationale: "Outdoor context and climate exposure must be considered together." },
    { applicationId: "MUSEUM_ATTRACTION", requiredSignalClasses: ["MUSEUM_ATTRACTION_ECOSYSTEM"], rationale: "Official museum evidence supports evaluation." },
    ...["CONVENTION_TOURISM", "HOSPITALITY", "SPORTS_STADIUM", "EDUCATION_CAMPUS", "IMMERSIVE_MEDIA", "DVLED", "TRANSPARENT_DISPLAY", "INTERACTIVE_TECHNOLOGY"].map((applicationId) => ({ applicationId, requiredSignalClasses: [applicationId === "CONVENTION_TOURISM" ? "CONVENTION_TOURISM" : applicationId === "HOSPITALITY" ? "CONVENTION_TOURISM" : applicationId === "IMMERSIVE_MEDIA" ? "MUSEUM_ATTRACTION_ECOSYSTEM" : "TECHNOLOGY_ADOPTION"], rationale: "Market evidence permits evaluation only when approved application and catalog authority also exist." })),
  ];
  const mappings = mapMarketSignalsToApplications({ intelligence, rules, now });
  const fan: CatalogAuthorityItem = { catalogItemId: HOUSTON_PRODUCT_ID, organizationId: "ssi", siteId: "site-ssi-projectorenclosure", name: "Fan Cooled Projector Enclosures", kind: "PRODUCT", authorityState: "APPROVED", authorityReference: "wordpress-page:10541", supportedApplications: ["COMMERCIAL_AV", "EVENT_VENUE", "PROJECTION_MAPPING"], buyerVerticals: ["AV integrators", "facility planners", "venue operators", "event producers"] };
  const catalog = [fan];
  const opportunity = (applicationId: string, buyer: string, evidenceIds: string[], values: Partial<Record<OpportunityScoreComponent["dimension"], OpportunityScoreComponent["value"]>>, recommendedUsage: ("PAGE_PRIMARY" | "PAGE_SUPPORTING" | "CROSS_SELL" | "CAMPAIGN_CANDIDATE")[]) => {
    const mapping = mappings.find((item) => item.applicationId === applicationId)!;
    return createMarketProductOpportunity({ opportunityId: `houston-${applicationId.toLowerCase().replaceAll("_", "-")}`, organizationId: "ssi", market, buyerVertical: buyer, signalIds: mapping.signalIds, applicationId, catalogItemId: fan.catalogItemId, catalogAuthorityReference: fan.authorityReference, whyMarket: `Houston evidence supports ${applicationId.replaceAll("_", " ").toLowerCase()} evaluation through current official sources.`, whyBuyer: `${buyer} are the bounded buyer group associated with the cited Houston signals.`, whyApplication: mapping.rationale, whyProduct: "Approved fan-cooled authority supports this application only in indoor, covered, or mild environments after project-specific fit review.", scoreComponents: score(values, evidenceIds), recommendedUsage, crossSellAdjacencyIds: [], evidenceIds, risks: ["No Houston customer, office, installation, or venue relationship is established.", "Exposed or harsh conditions require climate-controlled or IP-rated review."], createdAt: now, intelligence, application: mapping, catalogItem: fan, now });
  };
  const opportunities = [
    opportunity("COMMERCIAL_AV", "AV integrators", ["product", "houston-first", "grb"], { LOCAL_CONDITION_FIT: "MEDIUM" }, ["PAGE_PRIMARY", "CAMPAIGN_CANDIDATE"]),
    opportunity("EVENT_VENUE", "venue operators", ["product", "houston-first", "grb"], { LOCAL_CONDITION_FIT: "MEDIUM", COMMERCIAL_INTENT: "MEDIUM" }, ["PAGE_SUPPORTING"]),
    opportunity("PROJECTION_MAPPING", "event producers", ["product", "public-art", "museum-district"], { MARKET_EVIDENCE_STRENGTH: "MEDIUM", LOCAL_CONDITION_FIT: "MEDIUM", COMMERCIAL_INTENT: "LOW" }, ["PAGE_SUPPORTING"]),
    opportunity("OUTDOOR_PROJECTION", "venue operators", ["houston-climate", "climate-controlled", "outdoor"], { PRODUCT_FIT: "INSUFFICIENT", LOCAL_CONDITION_FIT: "LOW" }, ["CROSS_SELL"]),
    ...["MUSEUM_ATTRACTION", "CONVENTION_TOURISM", "HOSPITALITY", "SPORTS_STADIUM", "EDUCATION_CAMPUS", "IMMERSIVE_MEDIA", "DVLED", "TRANSPARENT_DISPLAY", "INTERACTIVE_TECHNOLOGY"].map((applicationId) => opportunity(applicationId, "Houston facility planners", [applicationId === "MUSEUM_ATTRACTION" || applicationId === "IMMERSIVE_MEDIA" ? "museum-district" : applicationId === "CONVENTION_TOURISM" || applicationId === "HOSPITALITY" ? "grb" : "port-houston"], { PRODUCT_FIT: "INSUFFICIENT", CATALOG_AUTHORITY_CONFIDENCE: "INSUFFICIENT" }, ["CROSS_SELL"])),
  ];
  const crossSellGraph = createCrossSellGraph({ contract: "site-market-cross-sell-graph-v1", schemaVersion: 1, graphId: "cross-sell-houston-southeast-texas-r1", organizationId: "ssi", marketId: MARKET_ID, edges: [], createdAt: now }, catalog);
  const pageStrategy = createPageStrategyRecommendation({ pageId: HOUSTON_TARGET_ID, primaryApplication: "COMMERCIAL_AV", supportingApplications: ["EVENT_VENUE", "PROJECTION_MAPPING"], crossSellCatalogItemIds: [], rejectedAdjacencies: opportunities.filter((item) => item.confidence === "INSUFFICIENT_EVIDENCE").map((item) => ({ applicationId: item.applicationId, reason: item.whyConfidence })), internalLinkIds: ["product", "climate-controlled", "outdoor", "support", "quote"], localAuthorityLinkIds: ["houston-climate", "houston-first", "grb", "public-art", "museum-district", "port-houston"], mediaRoles: ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"], ctaIntent: "Request projector, lens, environment, mounting, and exposure review.", compositionAuthorityPreserved: true, mutationAuthorized: false });
  const siteBlueprint = createSiteOpportunityBlueprint({ blueprintId: "site-blueprint-houston-southeast-texas-r1", organizationId: "ssi", market, catalogScope: [HOUSTON_PRODUCT_ID], priorityProducts: [HOUSTON_PRODUCT_ID], priorityVerticals: ["AV integrators", "venue operators", "facility planners"], applications: ["COMMERCIAL_AV", "EVENT_VENUE", "PROJECTION_MAPPING"], pageArchitecture: ["Houston environmental boundary", "approved product", "covered commercial context", "convention and event application", "local planning resources", "project review"], internalLinkRecommendations: [{ from: "environmental boundary", to: "climate-controlled resource", reason: "Route harsh or exposed requirements to the appropriate enclosure class." }], conversionStrategy: ["Request projector, lens, duty cycle, mounting, humidity, rain, and exposure details."], mediaStrategy: ["Keep approved product, product-grounded in-use, commercial AV application, and Gulf Coast atmosphere roles distinct."], themeContextStrategy: ["Use Level 2 Houston commercial and Gulf Coast atmosphere under ProjectorEnclosure brand authority."], evidence: marketEvidence, evidenceIds: ["product", "houston-climate", "houston-first", "grb", "port-houston"], confidence: "HIGH", freshness: "CURRENT", createdAt: now });
  return saveMarketProductMatchBundle({ bundleId: HOUSTON_MARKET_BUNDLE_ID, intelligence, catalog, applicationMappings: mappings, opportunities, crossSellGraph, campaignDiscovery: createCampaignDiscoveryRecommendations(opportunities), pageStrategy, siteBlueprint, proofBlueprints: [], createdAt: now });
}

export async function createHoustonReferencePreview(input: { fetcher?: typeof fetch; now?: string } = {}): Promise<HoustonReferencePreview> {
  const existingBundle = getLocalPageThemingBundle({ organizationId: "ssi", siteId: "site-ssi-projectorenclosure", jobId: null, bundleId: HOUSTON_BUNDLE_ID });
  const existingMarket = getMarketProductMatchBundle({ organizationId: "ssi", bundleId: HOUSTON_MARKET_BUNDLE_ID });
  if (existingBundle && existingMarket) return buildResult(existingBundle, existingMarket);
  const target = listAllGlwCampaignTargets().find((item) => item.targetId === HOUSTON_TARGET_ID);
  const product = getProductById(HOUSTON_PRODUCT_ID);
  const site = getSiteById("site-ssi-projectorenclosure");
  if (!target || target.status !== "queued" || target.jobId || target.wordpressObjectId || target.canonicalPath !== HOUSTON_CANONICAL_PATH || target.productId !== HOUSTON_PRODUCT_ID || target.publicationPolicy !== "draft_only") throw new Error("HOUSTON_TARGET_AUTHORITY_STALE");
  if (!product || !product.enabled || product.catalogStatus !== "ready" || product.media.primaryImageReference !== `wordpress-media:${HOUSTON_PRODUCT_MEDIA_ID}` || product.authorityProvenance?.authorityReference !== "wordpress-page:10541" || !site) throw new Error("HOUSTON_PRODUCT_AUTHORITY_STALE");
  const productResponse = await (input.fetcher ?? fetch)(HOUSTON_PRODUCT_MEDIA_URL, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  const productBytes = new Uint8Array(await productResponse.arrayBuffer());
  if (!productResponse.ok || digest(productBytes) !== HOUSTON_PRODUCT_MEDIA_HASH) throw new Error("HOUSTON_PRODUCT_MEDIA_AUTHORITY_STALE");
  const now = input.now ?? new Date().toISOString();
  const research = await evidence(input.fetcher ?? fetch, now);
  const identity = { organizationId: "ssi", siteId: "site-ssi-projectorenclosure", pageId: HOUSTON_TARGET_ID, jobId: null, pageRevisionIdentity: `target:${HOUSTON_TARGET_ID}:${target.updatedAt}` };
  const context: SitePageLocalContext = validateLocalContext({ contract: LOCAL_CONTEXT_CONTRACT, schemaVersion: 1, contextId: "local-context-houston-southeast-texas-r1", identity, geography: { city: "Houston", state: "Texas", region: "Greater Houston / Southeast Texas", countryCode: "US" }, researchRevision: 1, evidence: research, facts: [
    { factId: "houston-climate-boundary", kind: "CLIMATE_ENVIRONMENT", statement: "Houston planning must account for high summer temperatures, substantial rainfall, humidity, and storm exposure; exposed systems require climate-controlled or IP-rated review rather than default fan-cooled selection.", evidenceIds: ["houston-climate", "product", "climate-controlled", "outdoor"] },
    { factId: "houston-convention-hospitality", kind: "VENUE_ENVIRONMENT", statement: "Houston's city-owned convention, theater, hotel, outdoor, and performing-arts facilities create large and flexible commercial AV environments.", evidenceIds: ["houston-first", "grb"] },
    { factId: "houston-cultural-network", kind: "BUILT_ENVIRONMENT", statement: "Houston's civic-art and museum networks support contemporary cultural, science, exhibition, and visitor-facing environments without establishing any SSI relationship.", evidenceIds: ["public-art", "museum-district"] },
    { factId: "houston-industrial-character", kind: "INDUSTRY", statement: "Port Houston's public facilities and Ship Channel context establish a large-scale industrial and commercial regional character.", evidenceIds: ["port-houston"] },
    { factId: "houston-visual-context", kind: "VISUAL_CONTEXT", statement: "A Level 2 Houston expression may use humid Gulf Coast light, glass-and-steel convention architecture, broad covered concourses, bayou-green accents, and restrained industrial infrastructure without depicting a recognizable property.", evidenceIds: ["houston-first", "grb", "port-houston", "houston-climate"] },
  ], prohibitedInferences: ["SSI has a Houston office", "ProjectorEnclosure is headquartered in Houston", "a depicted Houston venue is a customer", "a generated scene is an actual Houston installation", "SSI performed a depicted Houston project"], createdAt: now }, identity.pageRevisionIdentity);
  const linkSpecs = [
    ["product", SOURCES[0][1], "product", "INTERNAL_PRODUCT", "Review fan-cooled enclosure details", "Confirm approved product scope and fit inputs."],
    ["application", SOURCES[0][1], "product", "INTERNAL_APPLICATION", "Review commercial projection fit", "Connect the selected commercial AV strategy to product authority."],
    ["climate-controlled", SOURCES[1][1], "climate-controlled", "INTERNAL_CAPABILITY", "Compare climate-controlled protection", "Route exposed, humid, harsh, or permanent outdoor conditions to the appropriate authority."],
    ["outdoor", SOURCES[2][1], "outdoor", "INTERNAL_CAPABILITY", "Review outdoor and IP-rated requirements", "Distinguish weather-rated protection from mild-environment fan cooling."],
    ["support", SOURCES[3][1], "contact", "INTERNAL_SUPPORT", "Request project-specific review", "Collect projector, lens, mounting, airflow, humidity, and exposure details."],
    ["quote", SOURCES[3][1], "contact", "INTERNAL_CONVERSION", "Discuss your Houston-area project", "Provide a conversion path without implying local presence."],
    ["nws", SOURCES[4][1], "houston-climate", "REGIONAL_REFERENCE", "Review official Houston climate normals", "Ground heat and rainfall planning in official data."],
    ["houston-first-link", SOURCES[5][1], "houston-first", "LOCAL_AUTHORITY", "Understand Houston's venue network", "Orient buyers to documented convention, performance, hospitality, and outdoor facilities."],
    ["grb-link", SOURCES[6][1], "grb", "LOCAL_INSTITUTION", "Review Houston convention scale", "Document flexible exhibit, meeting, ballroom, and event environments."],
    ["arts-link", SOURCES[7][1], "public-art", "LOCAL_AUTHORITY", "Explore Houston civic-art context", "Provide official public-art and creative-ecosystem context."],
    ["museum-link", SOURCES[8][1], "museum-district", "LOCAL_INSTITUTION", "Review Houston museum environments", "Orient planners to the documented cultural and science institution network."],
    ["port-link", SOURCES[9][1], "port-houston", "REGIONAL_REFERENCE", "Understand Southeast Texas industrial scale", "Provide official industrial and commercial regional context."],
  ] as const;
  const links: SitePageLocalLinkGraph = validateLocalLinkGraph({ contract: LOCAL_LINK_GRAPH_CONTRACT, schemaVersion: 1, graphId: "local-links-houston-southeast-texas-r1", identity, researchRevision: 1, links: linkSpecs.map(([linkId, url, evidenceId, role, anchorIntent, reason]) => ({ linkId, url, destinationIdentity: role.startsWith("INTERNAL") ? `url:${url}` : null, role, anchorIntent, reason, evidenceIds: [evidenceId], validation: { state: "VERIFIED", httpStatus: research.find((item) => item.evidenceId === evidenceId)?.httpStatus ?? 200, checkedAt: now } })), createdAt: now }, context);
  const applications: SitePageApplicationAuthority = validateApplicationAuthority({ contract: APPLICATION_AUTHORITY_CONTRACT, schemaVersion: 1, authorityId: "applications-houston-southeast-texas-r1", identity, productId: HOUSTON_PRODUCT_ID, researchRevision: 1, applications: [
    { applicationId: "COMMERCIAL_AV", label: "Commercial AV", compatibility: "SUPPORTED", relationship: "Approved fan-cooled authority supports indoor, covered, and mild-environment commercial AV; Houston venue evidence establishes relevant planning contexts.", evidenceIds: ["product", "houston-first", "grb"], internalDestinationUrl: SOURCES[0][1] },
    { applicationId: "EVENT_VENUE", label: "Convention and Event Venues", compatibility: "SUPPORTED", relationship: "Houston convention and event environments support fan-cooled evaluation only where exposure remains controlled or covered.", evidenceIds: ["product", "houston-first", "grb"], internalDestinationUrl: SOURCES[0][1] },
    { applicationId: "PROJECTION_MAPPING", label: "Projection Mapping", compatibility: "SUPPORTED", relationship: "Product authority permits projection mapping, while Houston arts and museum evidence supports it as a secondary application subject to site review.", evidenceIds: ["product", "public-art", "museum-district"], internalDestinationUrl: SOURCES[0][1] },
    { applicationId: "OUTDOOR_PROJECTION", label: "Outdoor Projection", compatibility: "UNSUPPORTED", relationship: "Houston heat, rainfall, humidity, and storm exposure require climate-controlled or IP-rated authority for exposed conditions.", evidenceIds: ["houston-climate", "climate-controlled", "outdoor"], internalDestinationUrl: SOURCES[1][1] },
  ], createdAt: now }, context);
  const theme = deriveLocalThemeProfile({ profileId: "local-theme-houston-southeast-texas-r1", context, applications, brandAuthorityReference: product.brandReference ?? "profile-brand-projectorenclosure-default", localizationLevel: 2, expression: { heroAtmosphere: "Contemporary covered Houston convention concourse in humid Gulf Coast evening light, without a recognizable venue or skyline landmark.", environmentalCharacter: ["humid Gulf Coast light", "broad covered public concourses", "glass and steel convention architecture", "restrained industrial scale"], materialCues: ["powder-coated metal", "glass", "architectural concrete", "weathered steel accents"], accentGuidance: "Preserve ProjectorEnclosure red, charcoal, white, and amber; use a restrained bayou-green secondary accent only for Houston planning context.", visualDensity: "Wide commercial bands, strong product scale, environmental caution callout, and disciplined technical copy.", terminology: ["Houston", "Greater Houston", "Southeast Texas", "covered environment", "humidity and exposure review"], compositionEmphasis: ["approved enclosure", "covered convention and hospitality context", "commercial AV application", "Gulf Coast environmental boundary"] }, antiClicheTerms: ["cowboy", "boots", "longhorn", "Texas flag", "western font", "desert", "ranch", "oil derrick", "space city cliché", "red-white-blue theme"], createdAt: now });
  const prompts = {
    inUse: "Create a conceptual photorealistic covered commercial AV installation in a generic modern convention or hospitality concourse with subtle Houston Gulf Coast character: humid daylight, glass, steel, architectural concrete, and a deep sheltered overhang. Use the supplied approved projector-enclosure reference to show one physically plausible fan-cooled enclosure with realistic service clearance and lens alignment. The enclosure is the visible subject. No recognizable Houston venue, skyline landmark, customer, office, signage, people, rain exposure, logos, text, flags, oil imagery, or claim of an actual installation.",
    application: "Create a photorealistic commercial AV application visualization in a generic flexible convention hall prepared for a branded event presentation, using large-scale projected visual content on an interior architectural surface. The setting should suggest Houston through broad convention scale, glass-and-steel detailing, and humid Gulf Coast light beyond covered glazing, without depicting a recognizable venue. No customer identity, logos, signage, readable text, crowds, outdoor exposure, or documentary framing.",
    atmosphere: "Create a restrained atmospheric commercial architecture image for a Houston AV planning page: a generic covered convention district concourse at humid blue hour, glass and steel, architectural concrete, subtle bayou-green planting, broad sky after rain, and generous negative space. No recognizable Houston landmark, skyline icon, people, projector, enclosure, logos, signs, flags, cowboy, ranch, oil derrick, NASA imagery, readable text, or implication of an actual project.",
  };
  const [inUseResult, applicationResult, atmosphereResult] = await Promise.all([
    generateGenesisFeaturedImageWithCampaignReferences({ prompt: prompts.inUse, siteName: site.displayName, productTopic: product.displayName, campaignId: CAMPAIGN_ID }),
    generateGenesisFeaturedImage({ prompt: prompts.application, siteName: site.displayName, productTopic: "commercial AV in covered convention and event environments" }),
    generateGenesisFeaturedImage({ prompt: prompts.atmosphere, siteName: site.displayName, productTopic: "Houston and Southeast Texas commercial AV planning atmosphere" }),
  ]);
  if (!inUseResult.ok || !applicationResult.ok || !atmosphereResult.ok) throw new Error(`HOUSTON_MEDIA_GENERATION_FAILED:${[inUseResult, applicationResult, atmosphereResult].filter((item) => !item.ok).map((item) => item.ok ? "" : item.state).join(",")}`);
  const generated = [
    { mediaId: "houston-contextual-in-use-v1", role: "CONTEXTUAL_IN_USE", claimClass: "CONCEPTUAL_CONTEXTUAL", applicationId: "COMMERCIAL_AV", prompt: prompts.inUse, altText: "Concept visualization of a fan-cooled projector enclosure in a covered Houston-relevant commercial AV concourse", image: inUseResult.image },
    { mediaId: "houston-commercial-av-experience-v1", role: "APPLICATION_EXPERIENCE", claimClass: "APPLICATION_VISUALIZATION", applicationId: "COMMERCIAL_AV", prompt: prompts.application, altText: "Application visualization of commercial projection in a Houston-inspired covered convention environment", image: applicationResult.image },
    { mediaId: "houston-gulf-coast-atmosphere-v1", role: "LOCAL_CONTEXTUAL_ATMOSPHERE", claimClass: "ATMOSPHERIC", applicationId: null, prompt: prompts.atmosphere, altText: "Atmospheric visualization of a covered Houston convention district concourse after rain", image: atmosphereResult.image },
  ] as const;
  const generatedMedia = generated.map((item): LocalizedMediaPlanItem => { const stored = saveLocalPageThemingMedia({ bundleId: HOUSTON_BUNDLE_ID, mediaId: item.mediaId, mimeType: item.image.mimeType, bytes: item.image.bytes }); return validateLocalizedMedia({ mediaId: item.mediaId, role: item.role, claimClass: item.claimClass, source: "GENERATED_CANDIDATE", productTruthReference: item.role === "LOCAL_CONTEXTUAL_ATMOSPHERE" ? null : `wordpress-media:${HOUSTON_PRODUCT_MEDIA_ID}`, applicationId: item.applicationId, localContextId: context.contextId, generationPrompt: item.prompt, sha256: stored.sha256, url: `/api/glw/houston-reference-preview/media/${item.mediaId}?organizationId=ssi&siteId=site-ssi-projectorenclosure`, mimeType: item.image.mimeType, altText: item.altText, ownerReviewState: "PENDING" }, { context, applications }); });
  const productMedia = validateLocalizedMedia({ mediaId: "houston-product-authority-v1", role: "PRODUCT_AUTHORITY", claimClass: "DOCUMENTARY", source: "APPROVED_EXISTING", productTruthReference: `wordpress-media:${HOUSTON_PRODUCT_MEDIA_ID}`, applicationId: null, localContextId: null, generationPrompt: null, sha256: HOUSTON_PRODUCT_MEDIA_HASH, url: HOUSTON_PRODUCT_MEDIA_URL, mimeType: "image/webp", altText: "Approved fan-cooled projector enclosure", ownerReviewState: "APPROVED" }, { context, applications });
  const media = [productMedia, ...generatedMedia];
  const composition = { contract: LOCALIZED_COMPOSITION_PLAN_CONTRACT, schemaVersion: 2 as const, planId: "composition-plan-houston-market-informed-v1", identity, priorPlanId: "none-preview-only-target", profile: "LOCATION_SERVICE" as const, localContextId: context.contextId, localLinkGraphId: links.graphId, applicationAuthorityId: applications.authorityId, localThemeProfileId: theme.profileId, mediaIds: media.map((item) => item.mediaId), validationState: "READY_FOR_OWNER_REVIEW" as const, blockers: [], wordpressMutationAuthorized: false as const, createdAt: now };
  const bundle = saveLocalPageThemingBundle({ bundleId: HOUSTON_BUNDLE_ID, context, links, applications, theme, media, composition, createdAt: now });
  const market = await buildMarket(bundle, now);
  return buildResult(bundle, market);
}

function buildResult(bundle: LocalPageThemingBundle, market: MarketProductMatchBundle): HoustonReferencePreview {
  return { bundle, market, narrative: HOUSTON_NARRATIVE, comparison: { dallasPrimaryApplication: "PROJECTION_MAPPING", houstonPrimaryApplication: market.pageStrategy.primaryApplication ?? "NONE", primaryApplicationDifferent: market.pageStrategy.primaryApplication !== "PROJECTION_MAPPING", themeDifferent: !bundle.theme.profileId.includes("dallas"), marketEvidenceDifferent: market.intelligence.evidence.every((item) => !/dallas|north-texas|dfw/i.test(`${item.evidenceId} ${item.url} ${item.observedClaim}`)), mediaDifferent: bundle.media.filter((item) => item.source === "GENERATED_CANDIDATE").every((item) => item.mediaId.startsWith("houston-")), linkGraphDifferent: bundle.links.links.filter((item) => !item.role.startsWith("INTERNAL")).every((item) => !/dallas|dfw/i.test(item.url)) } };
}

export function getHoustonReferencePreview(): HoustonReferencePreview | null {
  const bundle = getLocalPageThemingBundle({ organizationId: "ssi", siteId: "site-ssi-projectorenclosure", jobId: null, bundleId: HOUSTON_BUNDLE_ID });
  const market = getMarketProductMatchBundle({ organizationId: "ssi", bundleId: HOUSTON_MARKET_BUNDLE_ID });
  return bundle && market ? buildResult(bundle, market) : null;
}

export const HOUSTON_PREVIEW_CREATED_BY = CREATED_BY;
export const HOUSTON_PREVIEW_ROUTE = `/glw/houston-reference-preview?organizationId=ssi&siteId=site-ssi-projectorenclosure`;
export const HOUSTON_PREVIEW_CAPTURE_IDENTITY = HOUSTON_PREVIEW_ID;
