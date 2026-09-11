import type { SiteIntelligenceWorkspace, SiteOpportunity, SiteStrategyProposal } from "../site-intelligence";
import { resolvePostCapabilityTransition, selectDistinctCapabilityOpportunities } from "../site-capability-transition";

function opportunity(id: string, input: Partial<SiteOpportunity> = {}): SiteOpportunity {
  return { opportunityId: id, name: `Capability ${id}`, category: "fabrication", buyer: "Commercial buyer", problemUseCase: "fabrication", commercialValue: "HIGH", demandSignal: "signal", competitionLevel: "UNKNOWN", organizationFit: "HIGH", evidenceStrength: "MODERATE", confidence: 0.8, geographicScope: "regional", nationalRolloutPotential: false, recurringReplacementPotential: false, seoContentOpportunity: "candidate", rationale: "Ordinary capability", competitorEntities: [], evidenceIds: [], capabilityState: "VERIFIED", capabilityEvidenceIds: [], capabilityNotes: null, capabilityAuthorityRevisions: [{ organizationId: "org", siteId: "site", opportunityId: id, decision: "VERIFIED", evidenceIds: [], evidenceRelevance: [], attestation: "Owner confirms current capability.", authorityBasis: "OWNER_ATTESTATION", qualificationNotes: null, decidedBy: "owner", decidedAt: "2026-09-11T02:00:00.000Z", revision: 1 }], recommendation: "review", ownerDecision: "APPROVED", decidedBy: "owner", decidedAt: "2026-09-11T01:00:00.000Z", ...input };
}

function strategy(overrides: Partial<SiteStrategyProposal> = {}): SiteStrategyProposal {
  return { revision: 1, positioning: "Position", primaryAudience: "Commercial buyer", secondaryAudiences: [], valueProposition: "Value", majorVerticals: [], productServiceFamilies: ["Capability O1", "Capability O2"], informationArchitecture: [], proposedSitemap: [], homepageGoals: [], conversionPaths: [], ctaHierarchy: [], trustProofRequirements: [], geographicStrategy: "Regional", proposedProductAuthority: [], status: "APPROVED", reason: "test", createdBy: "owner", createdAt: "2026-09-11T01:30:00.000Z", decidedBy: "owner", decidedAt: "2026-09-11T01:40:00.000Z", synthesisContext: { approvedOpportunityIds: ["O1", "O2"], capabilityAuthorityOpportunityIds: ["O1", "O2"], pendingCapabilityOpportunityIds: [], futureCapabilityOpportunityIds: [], excludedOpportunityIds: [], evidenceIds: [], referenceInputIds: [], profileIds: [], evidenceClaims: [], referenceGuidance: [], profileGuidance: [], semanticClassifications: [], opportunityPrioritization: [], salesChannels: [], currentServiceGeographies: ["regional"], targetExpansionGeographies: [], researchedDemandGeographies: [], locationSeoOpportunities: [] }, ...overrides };
}

function workspace(opportunities: SiteOpportunity[], strategyRevision = strategy()): SiteIntelligenceWorkspace {
  return { workspaceId: "workspace", organizationId: "org", siteId: "site", internalOrganizationIdentity: "org", publicBrandIdentity: "Brand", revision: 1, intelligenceState: "INTELLIGENCE_APPROVED", strategyState: "STRATEGY_APPROVED", creativeState: "CREATIVE_INPUTS_COLLECTING", providerReference: null, researchStartedAt: null, researchExecutions: [], evidence: [], opportunities, strategyRevisions: [strategyRevision], creativeInputs: [], creativeRevisions: [], audit: [], createdAt: "2026-09-11T00:00:00.000Z", updatedAt: "2026-09-11T02:00:00.000Z" };
}

describe("post-capability transition", () => {
  test("16 historical rows sharing 8 IDs resolve to 8 complete capability reviews", () => {
    const reviewed = Array.from({ length: 8 }, (_, index) => opportunity(`O${index + 1}`));
    const placeholders = reviewed.map((item) => opportunity(item.opportunityId, { name: `Historical ${item.opportunityId}`, capabilityState: "OWNER_VALIDATION_REQUIRED", capabilityAuthorityRevisions: [{ ...item.capabilityAuthorityRevisions![0], decision: "OWNER_VALIDATION_REQUIRED", attestation: "", decidedAt: "" }] }));
    const result = resolvePostCapabilityTransition(workspace([...reviewed, ...placeholders], strategy({ synthesisContext: { ...strategy().synthesisContext!, approvedOpportunityIds: reviewed.map((item) => item.opportunityId), capabilityAuthorityOpportunityIds: reviewed.map((item) => item.opportunityId) }, productServiceFamilies: reviewed.map((item) => item.name) })));
    expect(selectDistinctCapabilityOpportunities([...reviewed, ...placeholders])).toEqual(reviewed);
    expect(result).toMatchObject({ distinctCapabilityCount: 8, capabilityReviewsComplete: 8, capabilityReviewsRemaining: 0, duplicateHistoricalRecordsPresent: true });
  });

  test("incomplete review reports remaining distinct capability count", () => {
    const result = resolvePostCapabilityTransition(workspace([opportunity("O1"), opportunity("O2", { capabilityState: "OWNER_VALIDATION_REQUIRED", capabilityAuthorityRevisions: [] })]));
    expect(result).toMatchObject({ capabilityReviewsComplete: 1, capabilityReviewsRemaining: 1, nextStep: "REVIEW_REMAINING_CAPABILITIES" });
  });

  test("material authority change after strategy creation requires updated strategy", () => {
    const result = resolvePostCapabilityTransition(workspace([opportunity("O1"), opportunity("O2", { capabilityState: "REJECTED", capabilityAuthorityRevisions: [{ ...opportunity("O2").capabilityAuthorityRevisions![0], decision: "REJECTED", attestation: "", authorityBasis: undefined }] })]));
    expect(result).toMatchObject({ strategyPredatesFinalCapabilitySnapshot: true, materialStrategyImpactDetected: true, nextStep: "REVIEW_UPDATED_STRATEGY" });
  });

  test("matching approved strategy continues to creative direction", () => {
    const opportunities = [opportunity("O1"), opportunity("O2")];
    const matching = strategy({ createdAt: "2026-09-11T03:00:00.000Z" });
    expect(resolvePostCapabilityTransition(workspace(opportunities, matching))).toMatchObject({ materialStrategyImpactDetected: false, nextStep: "CONTINUE_TO_CREATIVE_DIRECTION" });
  });
});