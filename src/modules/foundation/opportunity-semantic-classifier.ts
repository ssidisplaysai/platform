import type { SiteOpportunity } from "./site-intelligence";

export type OpportunitySemanticRole = "CAPABILITY" | "PRODUCT_SERVICE" | "MARKET_VERTICAL" | "AUDIENCE" | "SALES_CHANNEL" | "GEOGRAPHY" | "DELIVERY_MODEL" | "SEO_OPPORTUNITY" | "FUTURE_EXPANSION" | "PROOF_REQUIREMENT";
export type OpportunitySemanticClassification = {
  opportunityId: string;
  roles: OpportunitySemanticRole[];
  capabilityAuthority: "CURRENT" | "FUTURE" | "REJECTED" | "UNVALIDATED";
  productServiceCandidates: string[];
  marketVerticals: string[];
  audiences: string[];
  salesChannels: string[];
  researchedGeographies: string[];
  deliveryModels: string[];
  seoOpportunities: string[];
  proofRequirements: string[];
};

const channelPattern = /\b(dealer|consultant|specifier|spec-channel|channel sales|quote-ready|submittal)\b/i;
const deliveryPattern = /\b(direct[- ]to[- ]ship|ship(?:ped|ping)?|installation|install|design[- ]build|project fabrication)\b/i;
const productPattern = /\b(countertop|countertops|worktable|worktables|prep table|prep tables|workstation|workstations|serving counter|serving counters|fabrication|millwork|stainless package|stainless packages)\b/i;
const verticalTerms = ["grocery", "deli", "restaurant", "commercial kitchen", "foodservice", "hospitality", "healthcare", "education", "institutional", "corporate dining", "food processing", "pharma", "medical", "chemical", "cosmetics", "industrial", "laboratory", "labs"];

function unique(values: string[]): string[] { return [...new Set(values.map((value) => value.trim()).filter(Boolean))]; }
function title(value: string): string { return value.replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function matches(text: string, terms: string[]): string[] { const lower = text.toLowerCase(); return terms.filter((term) => lower.includes(term)).map(title); }
function productLabel(opportunity: SiteOpportunity): string {
  const source = opportunity.name.replace(/\b(niche|regional|direct-to-ship|custom)\b/gi, "").replace(/\s+/g, " ").trim();
  return title(source);
}

function geographyLabels(scope: string): string[] {
  const normalized = scope.trim();
  if (!normalized || normalized.toLowerCase() === "unknown") return [];
  const labels: string[] = [];
  if (/\bnational\b|\bnationwide\b|\bUS\b|United States/i.test(normalized)) labels.push("United States");
  if (/Canada/i.test(normalized)) labels.push("Canada");
  if (/Dallas[- ]Fort Worth|\bDFW\b/i.test(normalized)) labels.push("Dallas-Fort Worth");
  if (/Mid-Atlantic/i.test(normalized)) labels.push("Mid-Atlantic");
  if (!labels.length) labels.push(normalized);
  return unique(labels);
}

export function classifyOpportunitySemantics(opportunity: SiteOpportunity): OpportunitySemanticClassification {
  const combined = [opportunity.name, opportunity.category, opportunity.buyer, opportunity.problemUseCase, opportunity.rationale].join(" ");
  const productService = productPattern.test(`${opportunity.name} ${opportunity.category}`);
  const channel = channelPattern.test(`${opportunity.name} ${opportunity.category}`) || (!productService && channelPattern.test(opportunity.buyer));
  const delivery = deliveryPattern.test(combined);
  const currentCapability = opportunity.capabilityState === "VERIFIED" || opportunity.capabilityState === "QUALIFIED";
  const marketVerticals = unique(matches(`${opportunity.buyer} ${opportunity.problemUseCase}`, verticalTerms));
  const audiences = [opportunity.buyer.trim()];
  const salesChannels = channel ? unique([/dealer/i.test(combined) ? "Dealer channel" : "", /consultant/i.test(combined) ? "Consultant channel" : "", /specifier|spec-channel/i.test(combined) ? "Specification channel" : ""]) : [];
  const researchedGeographies = geographyLabels(opportunity.geographicScope);
  const deliveryModels = unique([
    /direct[- ]to[- ]ship|\bship(?:ped|ping)?\b/i.test(combined) ? "Direct-to-ship" : "",
    /installation|install/i.test(combined) ? "Installation support" : "",
    /design[- ]build/i.test(combined) ? "Design-build project delivery" : "",
    /project fabrication/i.test(combined) ? "Project fabrication" : "",
  ]);
  const proofRequirements = unique([
    productService ? `Product specifications and fabrication examples for ${productLabel(opportunity)}` : "",
    delivery ? "Documented delivery, shipping, or installation scope" : "",
    channel ? "Quote, drawing, specification, and submittal workflow evidence" : "",
  ]);
  const roles: OpportunitySemanticRole[] = ["AUDIENCE", "SEO_OPPORTUNITY", "PROOF_REQUIREMENT"];
  if (productService) roles.push("CAPABILITY", "PRODUCT_SERVICE");
  if (marketVerticals.length) roles.push("MARKET_VERTICAL");
  if (channel) roles.push("SALES_CHANNEL");
  if (researchedGeographies.length) roles.push("GEOGRAPHY");
  if (deliveryModels.length) roles.push("DELIVERY_MODEL");
  if (opportunity.capabilityState === "FUTURE_CAPABILITY" || (!currentCapability && (delivery || researchedGeographies.length > 0))) roles.push("FUTURE_EXPANSION");
  return {
    opportunityId: opportunity.opportunityId,
    roles: unique(roles) as OpportunitySemanticRole[],
    capabilityAuthority: opportunity.capabilityState === "FUTURE_CAPABILITY" ? "FUTURE" : opportunity.capabilityState === "REJECTED" ? "REJECTED" : currentCapability ? "CURRENT" : "UNVALIDATED",
    productServiceCandidates: productService ? [productLabel(opportunity)] : [],
    marketVerticals,
    audiences,
    salesChannels,
    researchedGeographies,
    deliveryModels,
    seoOpportunities: opportunity.seoContentOpportunity ? [opportunity.seoContentOpportunity] : [],
    proofRequirements,
  };
}
