import type { GenerationAuthoritySnapshot } from "./site-generation-readiness";
import { isCapabilityReviewComplete, selectDistinctCapabilityOpportunities } from "./site-capability-transition";
import type { CreativeDirectionProposal, SiteIntelligenceWorkspace, SiteStrategyProposal } from "./site-intelligence";
import type { SiteProductServiceAuthority, SiteSource } from "./site-product-authority-repository";
import type { SiteConfiguration } from "./types";

export const SITE_BUILD_POLICY_VERSION = "bounded-fresh-site-build-v1";

export type SiteBuildPageType = "HOME" | "CAPABILITIES" | "OFFERING" | "MARKET" | "ABOUT" | "CONTACT";
export type SiteBuildPageAuthority = { kind: "SITE" | "STRATEGY" | "CREATIVE" | "CAPABILITY" | "PRODUCT_SERVICE" | "MARKET" | "SOURCE"; referenceId: string; label: string };
export type SiteBuildPlanPage = { pageId: string; name: string; slug: string; pageType: SiteBuildPageType; purpose: string; primaryAudience: string; launchPhase: "INITIAL" | "FUTURE"; authority: SiteBuildPageAuthority[] };
export type SiteBuildPlanProposal = {
  buildSessionId: string;
  organizationId: string;
  siteId: string;
  revision: number;
  status: "PROPOSED" | "APPROVED" | "REVISION_REQUESTED" | "REJECTED";
  ownerInstructions: string | null;
  pages: SiteBuildPlanPage[];
  authoritySnapshot: GenerationAuthoritySnapshot;
  buildPolicyVersion: typeof SITE_BUILD_POLICY_VERSION;
  createdBy: string;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
};

function slug(value: string): string { return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function page(buildSessionId: string, input: Omit<SiteBuildPlanPage, "pageId">): SiteBuildPlanPage { return { pageId: `${buildSessionId}-${input.pageType.toLowerCase()}-${input.slug || "home"}`, ...input }; }

export function synthesizeSiteBuildPlan(input: {
  buildSessionId: string;
  site: SiteConfiguration;
  intelligence: SiteIntelligenceWorkspace;
  strategy: SiteStrategyProposal;
  creative: CreativeDirectionProposal;
  candidates: SiteProductServiceAuthority[];
  sources: SiteSource[];
  authoritySnapshot: GenerationAuthoritySnapshot;
  revision: number;
  ownerInstructions?: string | null;
  actor: string;
  now?: string;
}): SiteBuildPlanProposal {
  if (input.strategy.status !== "APPROVED" || input.creative.status !== "APPROVED") throw new Error("APPROVED_DIRECTION_REQUIRED");
  const opportunities = selectDistinctCapabilityOpportunities(input.intelligence.opportunities);
  const approvedOpportunityIds = new Set(opportunities.filter((item) => item.ownerDecision === "APPROVED" && isCapabilityReviewComplete(item)).map((item) => item.opportunityId));
  const approvedOfferings = input.candidates.filter((item) => (item.decision === "APPROVED" || item.decision === "QUALIFIED") && (item.protectedClaimBlockers.length === 0 || item.authorityBasis === "OWNER_ATTESTED_AND_EVIDENCE"));
  if (!approvedOfferings.length) throw new Error("APPROVED_PRODUCT_SERVICE_AUTHORITY_REQUIRED");
  const semanticMarkets = new Map<string, Set<string>>();
  for (const classification of input.strategy.synthesisContext?.semanticClassifications ?? []) {
    if (!approvedOpportunityIds.has(classification.opportunityId)) continue;
    for (const market of classification.marketVerticals) {
      const normalized = market.trim(); if (!normalized) continue;
      const references = semanticMarkets.get(normalized) ?? new Set<string>(); references.add(classification.opportunityId); semanticMarkets.set(normalized, references);
    }
  }
  const approvedStrategyMarkets = new Set(input.strategy.majorVerticals.map((item) => item.trim()).filter(Boolean));
  const markets = [...semanticMarkets.entries()].filter(([market]) => approvedStrategyMarkets.has(market)).sort(([left], [right]) => left.localeCompare(right));
  const siteAuthority: SiteBuildPageAuthority[] = [{ kind: "SITE", referenceId: input.site.siteId, label: input.site.displayName }, { kind: "STRATEGY", referenceId: `strategy-${input.strategy.revision}`, label: `Approved strategy revision ${input.strategy.revision}` }, { kind: "CREATIVE", referenceId: `creative-${input.creative.revision}`, label: `Approved Creative Direction revision ${input.creative.revision}` }];
  const pages: SiteBuildPlanPage[] = [page(input.buildSessionId, { name: "Home", slug: "", pageType: "HOME", purpose: input.strategy.homepageGoals.join(" ") || "Introduce the approved offering and guide qualified buyers.", primaryAudience: input.strategy.primaryAudience, launchPhase: "INITIAL", authority: siteAuthority })];
  if (input.strategy.informationArchitecture.some((item) => /capabilit/i.test(item))) pages.push(page(input.buildSessionId, { name: "Capabilities", slug: "capabilities", pageType: "CAPABILITIES", purpose: "Present current owner-confirmed capabilities without implying independent proof.", primaryAudience: input.strategy.primaryAudience, launchPhase: "INITIAL", authority: [...siteAuthority, ...opportunities.filter((item) => approvedOpportunityIds.has(item.opportunityId)).map((item) => ({ kind: "CAPABILITY" as const, referenceId: item.opportunityId, label: item.name }))] }));
  for (const offering of approvedOfferings.sort((left, right) => left.displayName.localeCompare(right.displayName))) pages.push(page(input.buildSessionId, { name: offering.displayName, slug: offering.slug, pageType: "OFFERING", purpose: offering.description, primaryAudience: input.strategy.primaryAudience, launchPhase: "INITIAL", authority: [...siteAuthority, { kind: "PRODUCT_SERVICE", referenceId: offering.authorityId, label: offering.displayName }, ...offering.sourceIds.map((sourceId) => ({ kind: "SOURCE" as const, referenceId: sourceId, label: input.sources.find((source) => source.sourceId === sourceId)?.label ?? "Approved source" }))] }));
  for (const [market, opportunityIds] of markets) pages.push(page(input.buildSessionId, { name: `${market} Solutions`, slug: `markets/${slug(market)}`, pageType: "MARKET", purpose: `Help ${market} buyers understand the approved offerings relevant to their project needs.`, primaryAudience: `${market} buyers`, launchPhase: "INITIAL", authority: [...siteAuthority, ...[...opportunityIds].map((opportunityId) => ({ kind: "MARKET" as const, referenceId: opportunityId, label: market }))] }));
  if (input.strategy.informationArchitecture.some((item) => /^about$/i.test(item.trim()))) pages.push(page(input.buildSessionId, { name: "About", slug: "about", pageType: "ABOUT", purpose: "Explain the business using only approved site and owner authority.", primaryAudience: input.strategy.primaryAudience, launchPhase: "INITIAL", authority: siteAuthority }));
  if (input.strategy.informationArchitecture.some((item) => /quote|contact/i.test(item)) || input.strategy.conversionPaths.length) pages.push(page(input.buildSessionId, { name: "Request a Quote", slug: "request-a-quote", pageType: "CONTACT", purpose: "Collect project details for an owner-reviewed quote conversation.", primaryAudience: input.strategy.primaryAudience, launchPhase: "INITIAL", authority: siteAuthority }));
  return { buildSessionId: input.buildSessionId, organizationId: input.site.organizationId, siteId: input.site.siteId, revision: input.revision, status: "PROPOSED", ownerInstructions: input.ownerInstructions?.trim() || null, pages, authoritySnapshot: input.authoritySnapshot, buildPolicyVersion: SITE_BUILD_POLICY_VERSION, createdBy: input.actor, createdAt: input.now ?? new Date().toISOString(), decidedBy: null, decidedAt: null };
}