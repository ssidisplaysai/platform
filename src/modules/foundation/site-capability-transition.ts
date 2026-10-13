import type { SiteIntelligenceWorkspace, SiteOpportunity, SiteStrategyProposal } from "./site-intelligence";
import { getCapabilityAuthorityAssurance } from "./site-intelligence";
import { classifyOpportunitySemantics } from "./opportunity-semantic-classifier";

export type PostCapabilityNextStep = "REVIEW_UPDATED_STRATEGY" | "CONTINUE_TO_CREATIVE_DIRECTION" | "REVIEW_REMAINING_CAPABILITIES";

export type PostCapabilityTransition = {
  distinctCapabilityCount: number;
  capabilityReviewsComplete: number;
  capabilityReviewsRemaining: number;
  duplicateHistoricalRecordsPresent: boolean;
  strategyPredatesFinalCapabilitySnapshot: boolean;
  materialStrategyImpactDetected: boolean;
  nextStep: PostCapabilityNextStep;
};

function latestAuthorityTime(opportunity: SiteOpportunity): number {
  const authority = opportunity.capabilityAuthorityRevisions?.at(-1);
  return authority?.decision === opportunity.capabilityState && authority.decidedAt ? Date.parse(authority.decidedAt) || 0 : 0;
}

export function isCapabilityReviewComplete(opportunity: SiteOpportunity): boolean {
  const authority = opportunity.capabilityAuthorityRevisions?.at(-1);
  if (!authority || authority.decision !== opportunity.capabilityState) return false;
  if (opportunity.capabilityState === "VERIFIED" || opportunity.capabilityState === "QUALIFIED") {
    return getCapabilityAuthorityAssurance(opportunity) !== "REVIEW_REQUIRED";
  }
  if (opportunity.capabilityState === "FUTURE_CAPABILITY") return Boolean(authority.attestation.trim());
  return opportunity.capabilityState === "REJECTED";
}

export function selectDistinctCapabilityOpportunities(opportunities: readonly SiteOpportunity[]): SiteOpportunity[] {
  const byId = new Map<string, SiteOpportunity>();
  for (const opportunity of opportunities) {
    const current = byId.get(opportunity.opportunityId);
    if (!current || latestAuthorityTime(opportunity) > latestAuthorityTime(current)) byId.set(opportunity.opportunityId, opportunity);
  }
  return [...byId.values()];
}

function sorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function differs(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(sorted(left)) !== JSON.stringify(sorted(right));
}

export function hasMaterialStrategyAuthorityImpact(opportunities: readonly SiteOpportunity[], strategy: SiteStrategyProposal | null): boolean {
  if (!strategy?.synthesisContext) return true;
  const distinct = selectDistinctCapabilityOpportunities(opportunities);
  const approved = distinct.filter((item) => item.ownerDecision === "APPROVED");
  const classifications = approved.map(classifyOpportunitySemantics);
  const currentAuthorityIds = approved.filter((item) => getCapabilityAuthorityAssurance(item) === "OWNER_ATTESTED" || getCapabilityAuthorityAssurance(item) === "EVIDENCE_VERIFIED").map((item) => item.opportunityId);
  const futureIds = approved.filter((item) => item.capabilityState === "FUTURE_CAPABILITY").map((item) => item.opportunityId);
  const excludedIds = distinct.filter((item) => item.ownerDecision !== "APPROVED").map((item) => item.opportunityId);
  const productServiceFamilies = classifications.filter((item) => item.capabilityAuthority === "CURRENT" && item.roles.includes("PRODUCT_SERVICE")).flatMap((item) => item.productServiceCandidates);
  const marketVerticals = classifications.flatMap((item) => item.marketVerticals);
  const salesChannels = classifications.flatMap((item) => item.salesChannels);
  const currentGeographies = classifications.filter((item) => item.capabilityAuthority === "CURRENT" && item.roles.includes("CAPABILITY")).flatMap((item) => item.researchedGeographies);
  return differs(approved.map((item) => item.opportunityId), strategy.synthesisContext.approvedOpportunityIds)
    || differs(currentAuthorityIds, strategy.synthesisContext.capabilityAuthorityOpportunityIds)
    || differs(futureIds, strategy.synthesisContext.futureCapabilityOpportunityIds)
    || differs(excludedIds, strategy.synthesisContext.excludedOpportunityIds)
    || differs(productServiceFamilies, strategy.productServiceFamilies)
    || differs(marketVerticals, strategy.majorVerticals)
    || differs(salesChannels, strategy.synthesisContext.salesChannels ?? [])
    || differs(currentGeographies, strategy.synthesisContext.currentServiceGeographies ?? []);
}

export function resolvePostCapabilityTransition(workspace: SiteIntelligenceWorkspace): PostCapabilityTransition {
  const distinct = selectDistinctCapabilityOpportunities(workspace.opportunities);
  const completed = distinct.filter(isCapabilityReviewComplete);
  const latestStrategy = workspace.strategyRevisions.at(-1) ?? null;
  const finalCapabilityAt = Math.max(0, ...completed.map(latestAuthorityTime));
  const strategyAt = latestStrategy ? Date.parse(latestStrategy.createdAt) || 0 : 0;
  const strategyPredatesFinalCapabilitySnapshot = Boolean(latestStrategy && finalCapabilityAt > strategyAt);
  const materialStrategyImpactDetected = completed.length === distinct.length && hasMaterialStrategyAuthorityImpact(distinct, latestStrategy);
  const nextStep = completed.length < distinct.length
    ? "REVIEW_REMAINING_CAPABILITIES"
    : workspace.strategyState === "STRATEGY_APPROVED" && !materialStrategyImpactDetected
      ? "CONTINUE_TO_CREATIVE_DIRECTION"
      : "REVIEW_UPDATED_STRATEGY";
  return {
    distinctCapabilityCount: distinct.length,
    capabilityReviewsComplete: completed.length,
    capabilityReviewsRemaining: distinct.length - completed.length,
    duplicateHistoricalRecordsPresent: workspace.opportunities.length > distinct.length,
    strategyPredatesFinalCapabilitySnapshot,
    materialStrategyImpactDetected,
    nextStep,
  };
}