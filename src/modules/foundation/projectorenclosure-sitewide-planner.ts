import { createHash } from "node:crypto";

export const PROJECTORENCLOSURE_INVENTORY_VERSION = "projectorenclosure-sitewide-v1";

export type InventoryDisposition = "KEEP" | "ENHANCE" | "MERGE" | "REDIRECT" | "RETIRE" | "RESEARCH_REQUIRED" | "PRODUCT_AUTHORITY_MISSING";
export type BatchSafetyClass = "A" | "B" | "C" | "D" | "E";
export type OwnershipConfidence = "CERTIFIED" | "HIGH" | "MEDIUM" | "LOW" | "CONFLICTED";
export type WordPressCollection = "pages" | "posts" | "portfolio" | "product";

export type SitewideInventoryAsset = {
  inventoryId: string;
  sourceId: number;
  collection: WordPressCollection;
  status: string;
  title: string;
  slug: string;
  url: string;
  canonical: string;
  robots: Readonly<Record<string, string>>;
  yoastFocus: string;
  yoastTitle: string;
  yoastMeta: string;
  featuredMediaId: number;
  contentHash: string;
  wordCount: number;
  headings: readonly { level: number; text: string }[];
  internalLinks: readonly string[];
  externalLinks: readonly string[];
  mediaUrls: readonly string[];
  publishedAt: string | null;
  modifiedAt: string | null;
  parentId: number;
  publicHttpStatus: number | null;
  redirect: { exists: boolean; destination: string | null };
  apparentIntent: string;
  ownershipConfidence: OwnershipConfidence;
  competingAssetIds: readonly number[];
  productIds: readonly string[];
  productAuthorityState: "VERIFIED" | "PARTIAL" | "PRODUCT_AUTHORITY_MISSING" | "NOT_APPLICABLE";
  claimFlags: readonly string[];
  brokenLinks: readonly string[];
  trackedLinks: readonly string[];
  mediaQuality: "STRONG" | "WEAK" | "MISSING";
  disposition: InventoryDisposition;
  safetyClass: BatchSafetyClass;
  recommendedActions: readonly string[];
  risk: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  dependencies: readonly string[];
  authorityTimestamp: string;
};

export type NicheOpportunity = {
  opportunityId: string;
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: readonly string[];
  workbookLineage: string | null;
  audience: string;
  currentOwnerId: number | null;
  cannibalizationResult: "CLEAR" | "ADJACENT_OWNER" | "CONFLICTED";
  pageRole: string;
  productIds: readonly string[];
  productAuthorityState: SitewideInventoryAsset["productAuthorityState"];
  parentTopics: readonly string[];
  childTopics: readonly string[];
  ecosystemAdjacency: readonly string[];
  downstreamProjectValue: string;
  score: number;
  scoreDimensions: Readonly<Record<string, number>>;
  rationale: string;
  disposition: "NEW_PAGE_OPPORTUNITY";
  safetyClass: BatchSafetyClass;
  dependencies: readonly string[];
};

export type SitewideInventorySnapshot = {
  snapshotId: string;
  siteId: "site-ssi-projectorenclosure";
  domain: "projectorenclosure.com";
  classificationVersion: typeof PROJECTORENCLOSURE_INVENTORY_VERSION;
  authorityTimestamp: string;
  mutationCounters: { wordpress: 0; media: 0; redirects: 0; yoast: 0; products: 0 };
  workbook: { status: "AVAILABLE" | "NOT_FOUND" | "UNREADABLE"; path: string | null; rowCount: number };
  assets: SitewideInventoryAsset[];
  opportunities: NicheOpportunity[];
  redirects: readonly { id: string; source: string; destination: string }[];
  consolidationGraph: readonly { sourceId: number; sourceUrl: string; disposition: "MERGE" | "REDIRECT" | "RETIRE"; destinationId: number | null; destinationUrl: string | null; reason: string; preserve: string; discard: string; seoDisposition: string; mediaDisposition: string; redirectRequired: boolean; risk: string; rollbackPrerequisites: readonly string[] }[];
  otherObjects: readonly { collection: string; count: number; publicCount: number; note: string }[];
  executionWaves: readonly { wave: number; name: string; candidateIds: readonly string[]; mutationTypes: readonly string[]; qa: readonly string[]; rollback: string; risk: string; maximumBatchSize: number; stopConditions: readonly string[] }[];
};

const certifiedOwners = new Map<number, string>([
  [12809, "broad commercial architectural projection mapping"],
  [12812, "commercial holiday projection mapping"],
  [11828, "residential holiday and seasonal projection mapping"],
  [12932, "broad residential house projection mapping"],
  [11852, "Homeline product"],
]);

export function deterministicInventoryId(collection: string, sourceId: number): string {
  return `pe-${collection}-${sourceId}`;
}

export function contentSha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function decodeEntities(value: string): string {
  return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

export function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

export function parseContentSignals(html: string, origin = "https://projectorenclosure.com") {
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match) => ({ level: Number(match[1]), text: stripHtml(match[2]) }));
  const links = [...new Set([...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map((match) => decodeEntities(match[1].trim())).filter(Boolean))];
  const mediaUrls = [...new Set([...html.matchAll(/<(?:img|source)\b[^>]*(?:src|srcset)=["']([^"']+)["']/gi)].flatMap((match) => match[1].split(",").map((entry) => entry.trim().split(/\s+/)[0])).filter(Boolean))];
  const text = stripHtml(html);
  return {
    headings,
    internalLinks: links.filter((url) => url.startsWith(origin) || url.startsWith("/")),
    externalLinks: links.filter((url) => /^https?:\/\//i.test(url) && !url.startsWith(origin)),
    mediaUrls,
    wordCount: text ? text.split(/\s+/).length : 0,
    text,
  };
}

export function detectClaimFlags(text: string): string[] {
  const rules: readonly [string, RegExp][] = [
    ["ENVIRONMENTAL_ABSOLUTE", /weatherproof|waterproof|IP[- ]rat|sealed from elements|all-weather|rain-proof|snow-proof|direct-sun rated|coastal rated/i],
    ["SECURITY_CLAIM", /lockable|tamper[- ]resistant|anti-theft|deter(?:s|red)? theft|deter(?:s|red)? vandalism|reinforced housing/i],
    ["PERFORMANCE_CLAIM", /guaranteed|maintain(?:s)? (?:safe|optimal)|prevents? overheating|extend(?:s)? projector life|uninterrupted|outstanding performance|perfect match/i],
    ["COMPATIBILITY_CLAIM", /universal compatibility|fits? (?:all|every) projectors?|any projector model/i],
    ["PRODUCT_FEATURE_CLAIM", /service panels?|mounting hardware|built-in heater|specific materials?|custom-built/i],
  ];
  return rules.filter(([, pattern]) => pattern.test(text)).map(([flag]) => flag);
}

export function inferIntent(input: { sourceId: number; title: string; slug: string; yoastFocus: string; text: string }): { intent: string; confidence: OwnershipConfidence } {
  const certified = certifiedOwners.get(input.sourceId);
  if (certified) return { intent: certified, confidence: "CERTIFIED" };
  const source = `${input.yoastFocus} ${input.title} ${input.slug}`.toLowerCase();
  const families: readonly [RegExp, string][] = [
    [/hush|noise|acoustic/, "projector noise and Hush enclosure guidance"],
    [/climate|air.condition/, "climate-controlled projector enclosures"],
    [/fan.cool/, "fan-cooled projector enclosures"],
    [/cage|security/, "projector cages and physical security"],
    [/ultra.short|\bust\b/, "ultra-short-throw projector enclosure"],
    [/outdoor.movie|backyard.theater|patio/, "residential outdoor projection"],
    [/projection.mapping|architectural/, "projection mapping"],
    [/projector.enclosure/, "projector enclosure guidance"],
  ];
  const match = families.find(([pattern]) => pattern.test(source));
  return { intent: match?.[1] ?? stripHtml(input.title).toLowerCase(), confidence: match ? "HIGH" : "LOW" };
}

export function mapProductAuthority(input: { title: string; slug: string; text: string }): { productIds: string[]; state: SitewideInventoryAsset["productAuthorityState"] } {
  const source = `${input.title} ${input.slug} ${input.text}`.toLowerCase();
  const productIds: string[] = [];
  if (/homeline/.test(source)) productIds.push("prod-ssi-homeline-projector-enclosure");
  if (/fan.cool/.test(source)) productIds.push("prod-ssi-fan-cooled-projector-enclosures");
  if (productIds.length > 0) return { productIds: [...new Set(productIds)], state: "VERIFIED" };
  if (/integrator|defender|hush|climate.control|projector cage|\bust\b/.test(source)) return { productIds: [], state: "PRODUCT_AUTHORITY_MISSING" };
  if (/projector enclosure|projection mapping/.test(source)) return { productIds: [], state: "PARTIAL" };
  return { productIds: [], state: "NOT_APPLICABLE" };
}

export function classifyDisposition(input: { status: string; robots: Readonly<Record<string, string>>; wordCount: number; claimFlags: readonly string[]; brokenLinks: readonly string[]; trackedLinks: readonly string[]; mediaQuality: SitewideInventoryAsset["mediaQuality"]; ownershipConfidence: OwnershipConfidence; productAuthorityState: SitewideInventoryAsset["productAuthorityState"]; duplicate: boolean; redirect: boolean; unrelated?: boolean }): { disposition: InventoryDisposition; safetyClass: BatchSafetyClass; risk: SitewideInventoryAsset["risk"]; actions: string[] } {
  if (input.status !== "publish") return { disposition: "RESEARCH_REQUIRED", safetyClass: "C", risk: "MEDIUM", actions: ["review draft intent and publication readiness"] };
  if (input.unrelated) return { disposition: "RETIRE", safetyClass: "C", risk: "HIGH", actions: ["confirm no legitimate site purpose", "remove from index and public navigation"] };
  if (input.redirect) return { disposition: "REDIRECT", safetyClass: "C", risk: "HIGH", actions: ["verify canonical destination and redirect ownership"] };
  if (input.duplicate) return { disposition: "MERGE", safetyClass: "C", risk: "HIGH", actions: ["preserve unique content", "merge into canonical owner", "create exact redirect"] };
  if (input.productAuthorityState === "PRODUCT_AUTHORITY_MISSING") return { disposition: "PRODUCT_AUTHORITY_MISSING", safetyClass: "D", risk: "BLOCKED", actions: ["establish product identity and verified facts"] };
  const actions: string[] = [];
  if (input.claimFlags.length) actions.push("unsupported-claim cleanup");
  if (input.brokenLinks.length) actions.push("broken-link cleanup");
  if (input.trackedLinks.length) actions.push("tracked-link cleanup");
  if (input.mediaQuality !== "STRONG") actions.push("contextual hero or media improvement");
  if (input.wordCount < 300) actions.push("bounded content enhancement");
  if (input.robots.index === "noindex") actions.push("review indexability");
  if (actions.length) return { disposition: "ENHANCE", safetyClass: input.mediaQuality === "STRONG" ? "A" : "B", risk: "MEDIUM", actions };
  return { disposition: "KEEP", safetyClass: "A", risk: input.ownershipConfidence === "LOW" ? "MEDIUM" : "LOW", actions: [] };
}

export function scoreOpportunity(input: { searchRelevance: number; audienceSize: number; productFit: number; commercialIntent: number; escalationValue: number; internalLinkLeverage: number; ecosystemAdjacency: number; competitionGap: number; authorityReadiness: number }): number {
  const values = Object.values(input);
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 10)) throw new Error("Opportunity dimensions must be between 0 and 10.");
  return values.reduce((sum, value) => sum + value, 0);
}

export function findOwnershipConflicts(assets: readonly SitewideInventoryAsset[]): { intent: string; assetIds: number[] }[] {
  const owners = new Map<string, number[]>();
  for (const asset of assets.filter((candidate) => candidate.status === "publish" && candidate.robots.index !== "noindex")) {
    const key = asset.apparentIntent.trim().toLowerCase();
    owners.set(key, [...(owners.get(key) ?? []), asset.sourceId]);
  }
  return [...owners.entries()].filter(([, ids]) => ids.length > 1).map(([intent, assetIds]) => ({ intent, assetIds }));
}

export function createSnapshotId(timestamp: string, assets: readonly Pick<SitewideInventoryAsset, "inventoryId" | "contentHash">[]): string {
  const digest = createHash("sha256").update(JSON.stringify([...assets].sort((a, b) => a.inventoryId.localeCompare(b.inventoryId)))).digest("hex").slice(0, 20);
  return `pe-inventory-${timestamp.slice(0, 10)}-${digest}`;
}

export function contentTokenOverlap(left: string, right: string): number {
  const tokens = (value: string) => new Set(stripHtml(value).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 5));
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / Math.min(leftTokens.size, rightTokens.size);
}

type OpportunitySeed = {
  topic: string;
  keyword: string;
  secondary: string[];
  audience: string;
  role: string;
  products: string[];
  productState: NicheOpportunity["productAuthorityState"];
  ecosystem: string[];
  downstream: string;
  dimensions: [number, number, number, number, number, number, number, number, number];
  safety: BatchSafetyClass;
};

const opportunitySeeds: OpportunitySeed[] = [
  { topic: "Backyard movie projector protection", keyword: "outdoor projector enclosure for backyard movies", secondary: ["backyard theater projector enclosure", "outdoor movie projector protection"], audience: "homeowners and backyard-cinema builders", role: "residential outdoor movie planning guide", products: ["prod-ssi-homeline-projector-enclosure", "prod-ssi-fan-cooled-projector-enclosures"], productState: "VERIFIED", ecosystem: ["home theater installers", "outdoor cinema communities"], downstream: "residential fitment review and larger outdoor AV projects", dimensions: [8, 9, 9, 7, 7, 8, 8, 7, 9], safety: "B" },
  { topic: "Covered patio projection", keyword: "projector enclosure for covered patio", secondary: ["patio projector protection", "covered outdoor projector setup"], audience: "homeowners, patio designers, and home AV installers", role: "covered-patio application guide", products: ["prod-ssi-homeline-projector-enclosure"], productState: "VERIFIED", ecosystem: ["home AV", "outdoor living"], downstream: "fitment and environment review", dimensions: [7, 8, 9, 7, 6, 8, 7, 7, 9], safety: "B" },
  { topic: "Garage theater projection", keyword: "garage projector enclosure", secondary: ["garage theater projector protection"], audience: "garage-theater and simulator builders", role: "mild-environment residential application guide", products: ["prod-ssi-homeline-projector-enclosure"], productState: "VERIFIED", ecosystem: ["DIY theater", "gaming and simulators"], downstream: "Homeline fitment and airflow review", dimensions: [6, 7, 9, 6, 5, 7, 7, 8, 9], safety: "B" },
  { topic: "Home golf simulator projector protection", keyword: "golf simulator projector enclosure", secondary: ["garage golf simulator projector protection", "projector protection for golf simulator"], audience: "home golf simulator owners and installers", role: "projector fitment and protection guide", products: ["prod-ssi-homeline-projector-enclosure"], productState: "VERIFIED", ecosystem: ["golf simulator installers", "launch monitor communities"], downstream: "residential sale and commercial simulator projects", dimensions: [8, 8, 8, 8, 8, 7, 9, 8, 8], safety: "C" },
  { topic: "Poolside projection planning", keyword: "poolside projector enclosure", secondary: ["projector protection near pool", "outdoor pool projection"], audience: "hospitality, homeowners, and outdoor AV installers", role: "environmental planning guide", products: [], productState: "PRODUCT_AUTHORITY_MISSING", ecosystem: ["pool designers", "hospitality AV"], downstream: "environment review and commercial escalation", dimensions: [6, 7, 7, 8, 8, 6, 7, 8, 4], safety: "D" },
  { topic: "Church projection systems", keyword: "projector enclosure for church", secondary: ["church projector protection", "worship projection enclosure"], audience: "church AV teams and integrators", role: "institutional projector enclosure planning", products: ["prod-ssi-fan-cooled-projector-enclosures"], productState: "VERIFIED", ecosystem: ["church AV", "worship technology integrators"], downstream: "multi-projector and noise-sensitive reviews", dimensions: [7, 8, 8, 8, 8, 7, 8, 8, 8], safety: "B" },
  { topic: "Museum projection and exhibits", keyword: "projector enclosure for museum exhibits", secondary: ["museum projection mapping enclosure", "exhibit projector protection"], audience: "museums, exhibit designers, and AV integrators", role: "museum and exhibit application hub", products: [], productState: "PARTIAL", ecosystem: ["museum technologists", "exhibit fabricators", "TouchDesigner", "Isadora"], downstream: "multi-projector, Hush, and project review", dimensions: [8, 7, 8, 9, 9, 8, 9, 8, 6], safety: "C" },
  { topic: "Visitor center projection", keyword: "visitor center projector enclosure", secondary: ["interpretive exhibit projector protection"], audience: "visitor centers and interpretive exhibit teams", role: "public-exhibit projector planning", products: [], productState: "PARTIAL", ecosystem: ["interpretive designers", "museum AV"], downstream: "long-duration and service-access review", dimensions: [6, 6, 8, 8, 8, 7, 8, 9, 6], safety: "C" },
  { topic: "Hotel facade projection mapping", keyword: "hotel projection mapping enclosure", secondary: ["hospitality facade projection mapping"], audience: "hotels, hospitality designers, and experiential agencies", role: "hospitality architectural mapping guide", products: [], productState: "PARTIAL", ecosystem: ["hospitality AV", "MadMapper", "Resolume"], downstream: "architectural hub and project review", dimensions: [8, 8, 8, 9, 9, 9, 9, 7, 6], safety: "B" },
  { topic: "Retail facade projection mapping", keyword: "retail facade projection mapping", secondary: ["storefront projection mapping enclosure"], audience: "retail brands, centers, and experiential agencies", role: "retail architectural mapping guide", products: [], productState: "PARTIAL", ecosystem: ["retail design", "experiential agencies", "HeavyM", "MadMapper"], downstream: "campaigns, recurring shows, and project review", dimensions: [9, 9, 8, 9, 9, 9, 9, 7, 6], safety: "B" },
  { topic: "Campus projection mapping", keyword: "campus projection mapping enclosure", secondary: ["university facade projection mapping"], audience: "universities, campuses, and event teams", role: "campus architectural mapping guide", products: [], productState: "PARTIAL", ecosystem: ["university AV", "event production"], downstream: "multi-projector and recurring event review", dimensions: [7, 8, 8, 8, 9, 8, 8, 8, 6], safety: "B" },
  { topic: "Stadium and fan experience projection", keyword: "stadium projection mapping enclosure", secondary: ["fan experience projection mapping", "sports venue projector protection"], audience: "sports venues and fan-experience agencies", role: "sports venue projection planning", products: [], productState: "PARTIAL", ecosystem: ["sports AV", "experiential agencies", "Resolume"], downstream: "large multi-projector commercial review", dimensions: [8, 9, 8, 10, 10, 8, 9, 8, 5], safety: "C" },
  { topic: "Projection-mapped scenic elements", keyword: "scenic projection mapping enclosure", secondary: ["theater scenic projection protection"], audience: "theaters, scenic designers, and event producers", role: "scenic projection application guide", products: [], productState: "PARTIAL", ecosystem: ["scenic designers", "Isadora", "Millumin"], downstream: "Hush and event-production projects", dimensions: [7, 7, 7, 8, 8, 7, 9, 8, 5], safety: "C" },
  { topic: "Trade show projection", keyword: "trade show projector enclosure", secondary: ["exhibit projector protection", "event booth projection mapping"], audience: "exhibit houses and trade-show producers", role: "temporary commercial projection guide", products: ["prod-ssi-fan-cooled-projector-enclosures"], productState: "VERIFIED", ecosystem: ["exhibit agencies", "rental and staging"], downstream: "repeat events and larger exhibit systems", dimensions: [7, 8, 8, 9, 8, 8, 8, 8, 8], safety: "B" },
  { topic: "Rental and staging projector protection", keyword: "projector enclosure for rental staging", secondary: ["temporary event projector protection"], audience: "rental, staging, and live-event companies", role: "temporary deployment planning", products: [], productState: "PARTIAL", ecosystem: ["rental staging", "live events", "Resolume"], downstream: "fleet and multi-projector reviews", dimensions: [7, 7, 8, 9, 9, 7, 8, 8, 6], safety: "C" },
  { topic: "Public art projection mapping", keyword: "public art projection mapping enclosure", secondary: ["outdoor projection art projector protection"], audience: "artists, municipalities, and public-art producers", role: "public art application guide", products: [], productState: "PARTIAL", ecosystem: ["projection artists", "public art programs", "TouchDesigner"], downstream: "municipal and architectural project review", dimensions: [8, 8, 8, 8, 9, 8, 9, 8, 6], safety: "C" },
  { topic: "Restaurant outdoor projection", keyword: "restaurant projector enclosure", secondary: ["bar projector protection", "hospitality outdoor projector"], audience: "restaurants, bars, and hospitality AV installers", role: "hospitality projector planning", products: ["prod-ssi-fan-cooled-projector-enclosures"], productState: "VERIFIED", ecosystem: ["hospitality AV", "digital experiences"], downstream: "multi-location and outdoor AV review", dimensions: [7, 8, 8, 9, 8, 8, 7, 8, 8], safety: "B" },
  { topic: "Amusement and attraction projection", keyword: "projector enclosure for attractions", secondary: ["theme park projection enclosure", "immersive attraction projector protection"], audience: "attractions, themed entertainment, and integrators", role: "immersive attraction planning guide", products: [], productState: "PARTIAL", ecosystem: ["themed entertainment", "TouchDesigner", "Isadora"], downstream: "permanent multi-projector systems", dimensions: [9, 8, 8, 10, 10, 8, 10, 8, 5], safety: "C" },
  { topic: "Corporate campus projection", keyword: "corporate campus projection mapping", secondary: ["corporate event projector enclosure"], audience: "corporate campuses and experience teams", role: "corporate architectural/experiential guide", products: [], productState: "PARTIAL", ecosystem: ["corporate AV", "experiential agencies"], downstream: "recurring and multi-projector systems", dimensions: [7, 8, 8, 9, 9, 8, 8, 8, 6], safety: "C" },
  { topic: "School and university outdoor projection", keyword: "school outdoor projector enclosure", secondary: ["university projector protection"], audience: "schools, universities, and campus AV", role: "education outdoor AV planning", products: ["prod-ssi-fan-cooled-projector-enclosures"], productState: "VERIFIED", ecosystem: ["education AV", "campus events"], downstream: "campus standards and multi-unit projects", dimensions: [7, 9, 8, 8, 9, 8, 7, 8, 8], safety: "B" },
  { topic: "Projector enclosure fitment", keyword: "projector enclosure fitment guide", secondary: ["projector dimensions enclosure", "projector lens position enclosure"], audience: "buyers, AV designers, and installers", role: "technical fitment authority", products: ["prod-ssi-homeline-projector-enclosure", "prod-ssi-fan-cooled-projector-enclosures"], productState: "VERIFIED", ecosystem: ["projector manufacturers", "AV design tools"], downstream: "product qualification and project review", dimensions: [9, 10, 10, 9, 9, 10, 8, 7, 9], safety: "B" },
  { topic: "Projector enclosure airflow planning", keyword: "projector enclosure airflow", secondary: ["projector intake exhaust clearance", "projector enclosure thermal planning"], audience: "AV engineers, installers, and buyers", role: "technical airflow planning authority", products: ["prod-ssi-fan-cooled-projector-enclosures"], productState: "VERIFIED", ecosystem: ["AV engineering", "projector manufacturers"], downstream: "technical review and category selection", dimensions: [9, 9, 10, 9, 10, 10, 8, 7, 9], safety: "B" },
  { topic: "Projector enclosure service access", keyword: "projector enclosure service clearance", secondary: ["projector maintenance access planning"], audience: "installers, facilities teams, and AV engineers", role: "technical service-access guide", products: [], productState: "PARTIAL", ecosystem: ["facilities", "AV operations"], downstream: "installation review", dimensions: [6, 7, 8, 8, 8, 9, 6, 9, 7], safety: "B" },
  { topic: "Multi-projector geometry planning", keyword: "multi projector projection mapping planning", secondary: ["multi-projector enclosure placement"], audience: "projection designers and AV integrators", role: "technical multi-projector planning guide", products: [], productState: "PARTIAL", ecosystem: ["MadMapper", "Resolume", "TouchDesigner", "projection artists"], downstream: "large commercial project escalation", dimensions: [9, 8, 8, 10, 10, 9, 10, 7, 6], safety: "C" },
  { topic: "UST projector enclosure planning", keyword: "ultra short throw projector enclosure", secondary: ["UST projector protection", "ultra short throw enclosure fitment"], audience: "UST buyers, integrators, and exhibit designers", role: "UST fitment authority", products: [], productState: "PRODUCT_AUTHORITY_MISSING", ecosystem: ["projector manufacturers", "interactive displays"], downstream: "product qualification", dimensions: [8, 8, 7, 8, 7, 8, 8, 8, 3], safety: "D" },
  { topic: "Projector cage selection", keyword: "projector security cage", secondary: ["projector cage enclosure", "anti-theft projector cage"], audience: "schools, venues, and facilities teams", role: "projector cage category guide", products: [], productState: "PRODUCT_AUTHORITY_MISSING", ecosystem: ["facilities security", "education AV"], downstream: "security-product authority and procurement", dimensions: [8, 8, 7, 9, 7, 8, 7, 8, 2], safety: "D" },
  { topic: "Sound-sensitive projection rooms", keyword: "quiet projector enclosure", secondary: ["projector hush enclosure", "projector noise enclosure"], audience: "theaters, museums, studios, and meeting spaces", role: "Hush application and sound-planning guide", products: [], productState: "PRODUCT_AUTHORITY_MISSING", ecosystem: ["acoustic consultants", "museum AV"], downstream: "Hush authority and project review", dimensions: [8, 8, 8, 8, 8, 8, 8, 8, 4], safety: "D" },
  { topic: "Environmental exposure planning", keyword: "outdoor projector enclosure environmental planning", secondary: ["projector enclosure exposure assessment"], audience: "AV designers, facilities teams, and buyers", role: "non-rating environmental planning guide", products: [], productState: "PARTIAL", ecosystem: ["AV engineering", "facilities"], downstream: "Defender/category review", dimensions: [8, 8, 9, 9, 10, 9, 7, 8, 7], safety: "C" },
  { topic: "Projection mapping creator workflow", keyword: "projection mapping projector setup", secondary: ["projection mapping enclosure workflow"], audience: "mapping creators and projection artists", role: "creator-to-hardware workflow guide", products: [], productState: "PARTIAL", ecosystem: ["HeavyM", "MadMapper", "Resolume", "TouchDesigner", "Millumin", "Isadora"], downstream: "hardware fitment and commercial escalation", dimensions: [9, 9, 8, 8, 9, 9, 10, 7, 6], safety: "B" },
  { topic: "Architectural lighting firms", keyword: "projection mapping enclosures for architectural lighting firms", secondary: ["commercial facade projector protection"], audience: "architectural lighting designers and firms", role: "professional audience landing guide", products: [], productState: "PARTIAL", ecosystem: ["architectural lighting firms", "AV integrators"], downstream: "large facade project review", dimensions: [8, 7, 8, 10, 10, 9, 9, 8, 6], safety: "C" },
];

export function buildNicheOpportunities(existingAssets: readonly SitewideInventoryAsset[], workbookLineage: string | null): NicheOpportunity[] {
  return opportunitySeeds.map((seed, index) => {
    const dimensions = { searchRelevance: seed.dimensions[0], audienceSize: seed.dimensions[1], productFit: seed.dimensions[2], commercialIntent: seed.dimensions[3], escalationValue: seed.dimensions[4], internalLinkLeverage: seed.dimensions[5], ecosystemAdjacency: seed.dimensions[6], competitionGap: seed.dimensions[7], authorityReadiness: seed.dimensions[8] };
    const matchingOwner = existingAssets.find((asset) => asset.apparentIntent.includes(seed.keyword) || asset.yoastFocus.toLowerCase() === seed.keyword);
    return { opportunityId: `pe-opportunity-${String(index + 1).padStart(3, "0")}`, topic: seed.topic, primaryKeyword: seed.keyword, secondaryKeywords: seed.secondary, workbookLineage, audience: seed.audience, currentOwnerId: matchingOwner?.sourceId ?? null, cannibalizationResult: matchingOwner ? "ADJACENT_OWNER" : "CLEAR", pageRole: seed.role, productIds: seed.products, productAuthorityState: seed.productState, parentTopics: ["projector enclosure applications"], childTopics: [], ecosystemAdjacency: seed.ecosystem, downstreamProjectValue: seed.downstream, score: scoreOpportunity(dimensions), scoreDimensions: dimensions, rationale: `Weighted strategic score reflects audience, product fit, commercial intent, escalation, link leverage, ecosystem adjacency, competition gap, and authority readiness; no traffic estimate is asserted.`, disposition: "NEW_PAGE_OPPORTUNITY", safetyClass: seed.safety, dependencies: seed.productState === "PRODUCT_AUTHORITY_MISSING" ? ["product authority"] : ["ownership preflight", "keyword research validation"] };
  }).sort((a, b) => b.score - a.score || a.topic.localeCompare(b.topic));
}