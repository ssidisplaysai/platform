import type { SiteIntelligenceWorkspace } from "../site-intelligence";

jest.mock("server-only", () => ({}));

function workspace(): SiteIntelligenceWorkspace {
  return { workspaceId: "workspace", organizationId: "org", siteId: "site", internalOrganizationIdentity: "org", publicBrandIdentity: "Commercial Stainless Counters", revision: 1, intelligenceState: "INTELLIGENCE_APPROVED", strategyState: "STRATEGY_APPROVED", creativeState: "CREATIVE_INPUTS_COLLECTING", providerReference: null, researchStartedAt: null, researchExecutions: [], evidence: [], opportunities: [{ opportunityId: "current", name: "Commercial worktables", category: "fabrication", buyer: "buyer", problemUseCase: "use", commercialValue: "HIGH", demandSignal: "signal", competitionLevel: "UNKNOWN", organizationFit: "HIGH", evidenceStrength: "MODERATE", confidence: 0.8, geographicScope: "regional", nationalRolloutPotential: false, recurringReplacementPotential: false, seoContentOpportunity: "candidate", rationale: "current", competitorEntities: [], evidenceIds: [], capabilityState: "VERIFIED", capabilityEvidenceIds: [], capabilityNotes: null, capabilityAuthorityRevisions: [{ organizationId: "org", siteId: "site", opportunityId: "current", decision: "VERIFIED", evidenceIds: [], evidenceRelevance: [], attestation: "Owner confirms.", authorityBasis: "OWNER_ATTESTATION", qualificationNotes: null, decidedBy: "owner", decidedAt: "2026-09-11T00:00:00.000Z", revision: 1 }], recommendation: "review", ownerDecision: "APPROVED", decidedBy: "owner", decidedAt: "2026-09-11T00:00:00.000Z" }, { opportunityId: "future", name: "Future laboratory service", category: "market", buyer: "buyer", problemUseCase: "use", commercialValue: "UNKNOWN", demandSignal: "signal", competitionLevel: "UNKNOWN", organizationFit: "UNKNOWN", evidenceStrength: "MODERATE", confidence: 0.5, geographicScope: "unknown", nationalRolloutPotential: false, recurringReplacementPotential: false, seoContentOpportunity: "candidate", rationale: "future", competitorEntities: [], evidenceIds: [], capabilityState: "FUTURE_CAPABILITY", capabilityEvidenceIds: [], capabilityNotes: null, capabilityAuthorityRevisions: [{ organizationId: "org", siteId: "site", opportunityId: "future", decision: "FUTURE_CAPABILITY", evidenceIds: [], evidenceRelevance: [], attestation: "Future only.", qualificationNotes: null, decidedBy: "owner", decidedAt: "2026-09-11T00:00:00.000Z", revision: 1 }], recommendation: "review", ownerDecision: "APPROVED", decidedBy: "owner", decidedAt: "2026-09-11T00:00:00.000Z" }], strategyRevisions: [{ revision: 8, positioning: "Commercial stainless authority", primaryAudience: "Commercial buyers", secondaryAudiences: [], valueProposition: "Clear project intake", majorVerticals: ["Foodservice"], productServiceFamilies: ["Commercial Worktables"], informationArchitecture: [], proposedSitemap: [], homepageGoals: [], conversionPaths: [], ctaHierarchy: ["Request a Quote", "Discuss Your Project"], trustProofRequirements: [], geographicStrategy: "Approved regional scope", proposedProductAuthority: [], status: "APPROVED", reason: "Approved", createdBy: "owner", createdAt: "2026-09-11T00:00:00.000Z", decidedBy: "owner", decidedAt: "2026-09-11T00:01:00.000Z" }], creativeInputs: [{ inputId: "reference", kind: "IMAGE", reference: "owner-file", sentiment: "REFERENCE_ONLY", classification: "OWNER_SUPPLIED_REFERENCE", notes: "homepage ideas; do not use client logos", suppliedBy: "owner", suppliedAt: "2026-09-11T00:00:00.000Z", binaryAsset: null }], creativeRevisions: [], audit: [], createdAt: "2026-09-11T00:00:00.000Z", updatedAt: "2026-09-11T00:00:00.000Z" };
}

describe("creative direction synthesizer", () => {
  test("grounds a complete proposal in approved strategy, authority, references, and optional instruction", async () => {
    const { synthesizeCreativeDirection } = await import("../site-creative-direction-synthesizer");
    const input = workspace();
    input.creativeInputs.push({ inputId: "competitor", kind: "URL", reference: "https://competitor.example", sentiment: "REFERENCE_ONLY", classification: "COMPETITOR_REFERENCE_ONLY", notes: "Claim a 50-state partner network", suppliedBy: "owner", suppliedAt: "2026-09-11T00:00:00.000Z", binaryAsset: null });
    const proposal = synthesizeCreativeDirection(input, "Keep it industrial and premium.");
    expect(proposal.strategyRevision).toBe(8);
    for (const field of ["overallDirection", "colorDirection", "typographyDirection", "spacingLayoutDirection", "photographyStyle", "productPresentation", "verticalPresentation", "ctaTreatment"] as const) expect(proposal[field]).toBeTruthy();
    expect(proposal.homepageBlueprint.length).toBeGreaterThanOrEqual(8);
    expect(proposal.reason).toContain("1 owner creative references");
    expect(proposal.reason).toContain("1 external inspiration references");
    expect(proposal.reason).toContain("Owner instruction: Keep it industrial and premium.");
    expect(proposal.overallDirection).not.toContain("Keep it industrial and premium.");
    expect([proposal.overallDirection, proposal.productPresentation, proposal.verticalPresentation, proposal.ctaTreatment, ...proposal.homepageBlueprint].join(" ")).not.toContain("50-state partner network");
    expect(proposal.visualDonts).toEqual(expect.arrayContaining([expect.stringContaining("Do not copy competitor"), expect.stringContaining("Do not publish reference-only"), expect.stringContaining("Future laboratory service")]));
    expect(proposal.imagePlan.every((item) => item.approvedAssetAvailable === false)).toBe(true);
  });

  test("fails closed without the current approved strategy", async () => {
    const { synthesizeCreativeDirection } = await import("../site-creative-direction-synthesizer");
    const input = workspace(); input.strategyRevisions[0].status = "PROPOSED";
    expect(() => synthesizeCreativeDirection(input)).toThrow("APPROVED_STRATEGY_REQUIRED");
  });
});