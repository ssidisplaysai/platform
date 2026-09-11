import type { GenerationAuthoritySnapshot } from "./site-generation-readiness";
import { isCapabilityReviewComplete, selectDistinctCapabilityOpportunities } from "./site-capability-transition";
import type { CreativeDirectionProposal, SiteIntelligenceWorkspace, SiteStrategyProposal } from "./site-intelligence";
import type { SiteProductServiceAuthority, SiteSource } from "./site-product-authority-repository";
import type { SiteConfiguration } from "./types";

export const SITE_BUILD_POLICY_VERSION = "bounded-fresh-site-build-v1";

export type SiteBuildPageType = "HOME" | "CAPABILITIES" | "CATEGORY" | "OFFERING" | "MARKET" | "ABOUT" | "CONTACT";
export type SiteBuildPageAuthority = { kind: "SITE" | "STRATEGY" | "CREATIVE" | "CAPABILITY" | "PRODUCT_SERVICE" | "MARKET" | "SOURCE"; referenceId: string; label: string };
export type SiteBuildPlanPage = { pageId: string; name: string; slug: string; pageType: SiteBuildPageType; purpose: string; primaryAudience: string; launchPhase: "INITIAL" | "FUTURE"; authority: SiteBuildPageAuthority[] };
export type SiteBuildPlanChangeRequest = { changeRequestId: string; buildSessionId: string; organizationId: string; siteId: string; fromRevision: number; requestedBy: string; requestedAt: string; instructions: string; authoritySnapshot: GenerationAuthoritySnapshot };
export type SiteBuildPlanChangeSummary = { added: string[]; removed: string[]; changed: string[]; unchanged: string[] };
export type SiteBuildPlanProposal = {
  buildSessionId: string;
  organizationId: string;
  siteId: string;
  revision: number;
  status: "PROPOSED" | "APPROVED" | "REVISION_REQUESTED" | "REJECTED";
  ownerInstructions: string | null;
  lineage?: { previousRevision: number | null; changeRequestId: string | null };
  changeSummary?: SiteBuildPlanChangeSummary;
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
function normalizedName(value: string): string { return slug(value).replace(/-solutions?$/, "").replace(/s$/, ""); }
function words(value: string): Set<string> { return new Set(slug(value).split("-").filter((item) => item.length > 3)); }
function overlaps(left: string, right: string): boolean { const rightWords = words(right); return [...words(left)].some((item) => rightWords.has(item)); }
function findPage(pages: SiteBuildPlanPage[], name: string): SiteBuildPlanPage | undefined { const normalized = normalizedName(name); return pages.find((item) => normalizedName(item.name) === normalized || normalizedName(item.name).includes(normalized) || normalized.includes(normalizedName(item.name))); }
function summarize(previous: SiteBuildPlanPage[], next: SiteBuildPlanPage[]): SiteBuildPlanChangeSummary {
  const before = new Map(previous.map((item) => [item.pageId, item])); const after = new Map(next.map((item) => [item.pageId, item]));
  const added = next.filter((item) => !before.has(item.pageId)).map((item) => item.name);
  const removed = previous.filter((item) => !after.has(item.pageId)).map((item) => item.name);
  const changed = next.filter((item) => { const prior = before.get(item.pageId); return prior && JSON.stringify(prior) !== JSON.stringify(item); }).map((item) => item.name);
  const unchanged = next.filter((item) => { const prior = before.get(item.pageId); return prior && JSON.stringify(prior) === JSON.stringify(item); }).map((item) => item.name);
  return { added, removed, changed, unchanged };
}

function applyOwnerDirection(input: { buildSessionId: string; site: SiteConfiguration; priorPlan: SiteBuildPlanProposal; instructions: string; approvedOfferings: SiteProductServiceAuthority[]; siteAuthority: SiteBuildPageAuthority[] }): { pages: SiteBuildPlanPage[]; summary: SiteBuildPlanChangeSummary } {
  const pages = structuredClone(input.priorPlan.pages);
  const addPattern = /\badd\s+(?:a\s+|an\s+)?(?:first-class\s+)?(.+?)\s+page\b/gi;
  for (const match of input.instructions.matchAll(addPattern)) {
    const name = match[1].trim().replace(/^(?:the\s+)/i, "");
    if (findPage(pages, name)) continue;
    const matchingOfferings = input.approvedOfferings.filter((item) => overlaps(name, item.displayName));
    const siteDirected = normalizedName(name) === normalizedName(input.site.displayName);
    if (!siteDirected && matchingOfferings.length === 0) throw new Error(`OWNER_DIRECTION_OUTSIDE_APPROVED_AUTHORITY:${name}`);
    pages.splice(2, 0, page(input.buildSessionId, { name, slug: slug(name), pageType: "CATEGORY", purpose: `Organize the approved product and service architecture around ${name} as requested by the owner.`, primaryAudience: input.priorPlan.pages[0]?.primaryAudience ?? "Qualified buyers", launchPhase: "INITIAL", authority: [...input.siteAuthority, ...matchingOfferings.map((item) => ({ kind: "PRODUCT_SERVICE" as const, referenceId: item.authorityId, label: item.displayName }))] }));
  }
  const consolidatePattern = /\bconsolidate\s+([a-z][a-z &/-]+?)\s+into(?:\s+the)?(?:\s+broader)?\s+([a-z][a-z &/-]+?)(?:\s+architecture|[.,;\n])/gi;
  for (const match of input.instructions.matchAll(consolidatePattern)) {
    const source = findPage(pages, match[1].trim()); const target = findPage(pages, match[2].trim());
    if (!source || !target || source.pageType !== "MARKET" || target.pageType !== "MARKET" || source.pageId === target.pageId) continue;
    const sourceName = source.name.replace(/\s+Solutions$/i, "");
    target.purpose = `Serve the broader ${target.name.replace(/\s+Solutions$/i, "")} audience, including ${sourceName.toLowerCase()} buyers, with distinct guidance grounded in approved market authority.`;
    target.primaryAudience = `${target.name.replace(/\s+Solutions$/i, "")} buyers, including ${sourceName.toLowerCase()} buyers`;
    target.authority = [...target.authority, ...source.authority.filter((authority) => !target.authority.some((current) => current.kind === authority.kind && current.referenceId === authority.referenceId))];
    pages.splice(pages.indexOf(source), 1);
  }
  const summary = summarize(input.priorPlan.pages, pages);
  if (summary.added.length + summary.removed.length + summary.changed.length === 0) throw new Error("OWNER_DIRECTION_DID_NOT_CHANGE_PLAN");
  return { pages, summary };
}

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
  priorPlan?: SiteBuildPlanProposal | null;
  changeRequest?: SiteBuildPlanChangeRequest | null;
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
  const instructions = input.ownerInstructions?.trim() || null;
  if (instructions && (!input.priorPlan || !input.changeRequest)) throw new Error("PRIOR_PLAN_AND_CHANGE_REQUEST_REQUIRED");
  const revised = instructions ? applyOwnerDirection({ buildSessionId: input.buildSessionId, site: input.site, priorPlan: input.priorPlan!, instructions, approvedOfferings, siteAuthority }) : null;
  return { buildSessionId: input.buildSessionId, organizationId: input.site.organizationId, siteId: input.site.siteId, revision: input.revision, status: "PROPOSED", ownerInstructions: instructions, lineage: { previousRevision: input.priorPlan?.revision ?? null, changeRequestId: input.changeRequest?.changeRequestId ?? null }, changeSummary: revised?.summary ?? { added: pages.map((item) => item.name), removed: [], changed: [], unchanged: [] }, pages: revised?.pages ?? pages, authoritySnapshot: input.authoritySnapshot, buildPolicyVersion: SITE_BUILD_POLICY_VERSION, createdBy: input.actor, createdAt: input.now ?? new Date().toISOString(), decidedBy: null, decidedAt: null };
}