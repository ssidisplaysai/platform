import fs from "node:fs";
import path from "node:path";
import type { SiteIntelligenceWorkspace, SiteOpportunity } from "../site-intelligence";

jest.mock("server-only", () => ({}));

function opportunity(overrides: Partial<SiteOpportunity> = {}): SiteOpportunity {
  return {
    opportunityId: "current",
    name: "Projector protection systems",
    category: "projector protection",
    buyer: "Commercial facilities teams",
    problemUseCase: "Protect projection systems in varied environments.",
    commercialValue: "HIGH",
    demandSignal: "Observed demand.",
    competitionLevel: "MODERATE",
    organizationFit: "HIGH",
    evidenceStrength: "MODERATE",
    confidence: 0.8,
    geographicScope: "regional",
    nationalRolloutPotential: false,
    recurringReplacementPotential: false,
    seoContentOpportunity: "candidate",
    rationale: "current",
    competitorEntities: [],
    evidenceIds: [],
    capabilityState: "VERIFIED",
    capabilityEvidenceIds: [],
    capabilityNotes: null,
    capabilityAuthorityRevisions: [{
      organizationId: "org",
      siteId: "site",
      opportunityId: "current",
      decision: "VERIFIED",
      evidenceIds: [],
      evidenceRelevance: [],
      attestation: "Owner confirms.",
      authorityBasis: "OWNER_ATTESTATION",
      qualificationNotes: null,
      decidedBy: "owner",
      decidedAt: "2026-09-11T00:00:00.000Z",
      revision: 1,
    }],
    recommendation: "review",
    ownerDecision: "APPROVED",
    decidedBy: "owner",
    decidedAt: "2026-09-11T00:00:00.000Z",
    ...overrides,
  };
}

function workspace(fabricationAuthority = false): SiteIntelligenceWorkspace {
  const approved = fabricationAuthority
    ? opportunity({
        name: "Precision fabrication services",
        category: "fabrication services",
      })
    : opportunity();

  return {
    workspaceId: "workspace",
    organizationId: "org",
    siteId: "site",
    internalOrganizationIdentity: "org",
    publicBrandIdentity: "Projector Climate Control",
    revision: 1,
    intelligenceState: "INTELLIGENCE_APPROVED",
    strategyState: "STRATEGY_APPROVED",
    creativeState: "CREATIVE_INPUTS_COLLECTING",
    providerReference: null,
    researchStartedAt: null,
    researchExecutions: [],
    evidence: [],
    opportunities: [
      approved,
      opportunity({
        opportunityId: "future",
        name: "Future laboratory service",
        category: "market",
        commercialValue: "UNKNOWN",
        confidence: 0.5,
        capabilityState: "FUTURE_CAPABILITY",
        capabilityAuthorityRevisions: [{
          organizationId: "org",
          siteId: "site",
          opportunityId: "future",
          decision: "FUTURE_CAPABILITY",
          evidenceIds: [],
          evidenceRelevance: [],
          attestation: "Future only.",
          qualificationNotes: null,
          decidedBy: "owner",
          decidedAt: "2026-09-11T00:00:00.000Z",
          revision: 1,
        }],
      }),
    ],
    strategyRevisions: [{
      revision: 8,
      positioning: fabricationAuthority ? "Approved fabrication positioning" : "Approved capability positioning",
      primaryAudience: "Commercial buyers",
      secondaryAudiences: [],
      valueProposition: "Clear project intake",
      majorVerticals: ["Commercial facilities"],
      productServiceFamilies: fabricationAuthority ? ["Precision Fabrication Services"] : ["Projector Enclosures"],
      informationArchitecture: [],
      proposedSitemap: [],
      homepageGoals: [],
      conversionPaths: [],
      ctaHierarchy: ["Request a Quote", "Discuss Your Project"],
      trustProofRequirements: fabricationAuthority ? ["Verified fabrication process documentation"] : ["Verified capability documentation"],
      geographicStrategy: "Approved regional scope",
      proposedProductAuthority: [],
      status: "APPROVED",
      reason: "Approved",
      createdBy: "owner",
      createdAt: "2026-09-11T00:00:00.000Z",
      decidedBy: "owner",
      decidedAt: "2026-09-11T00:01:00.000Z",
    }],
    creativeInputs: [{
      inputId: "reference",
      kind: "IMAGE",
      reference: "owner-file",
      sentiment: "REFERENCE_ONLY",
      classification: "OWNER_SUPPLIED_REFERENCE",
      notes: "homepage ideas; do not use client logos",
      suppliedBy: "owner",
      suppliedAt: "2026-09-11T00:00:00.000Z",
      binaryAsset: null,
    }],
    creativeRevisions: [],
    audit: [],
    createdAt: "2026-09-11T00:00:00.000Z",
    updatedAt: "2026-09-11T00:00:00.000Z",
  };
}

describe("creative direction synthesizer", () => {
  test("grounds a complete proposal in approved strategy, authority, references, and optional instruction", async () => {
    const { synthesizeCreativeDirection } = await import("../site-creative-direction-synthesizer");
    const input = workspace();
    input.creativeInputs.push({
      inputId: "competitor",
      kind: "URL",
      reference: "https://competitor.example",
      sentiment: "REFERENCE_ONLY",
      classification: "COMPETITOR_REFERENCE_ONLY",
      notes: "Claim a 50-state partner network",
      suppliedBy: "owner",
      suppliedAt: "2026-09-11T00:00:00.000Z",
      binaryAsset: null,
    });
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
    const input = workspace();
    input.strategyRevisions[0].status = "PROPOSED";
    expect(() => synthesizeCreativeDirection(input)).toThrow("APPROVED_STRATEGY_REQUIRED");
  });

  test("generic authority does not introduce stainless or fabrication defaults", async () => {
    const { synthesizeCreativeDirection } = await import("../site-creative-direction-synthesizer");
    const proposal = synthesizeCreativeDirection(workspace(false), "Keep hierarchy clean.");
    const text = [
      proposal.overallDirection,
      proposal.colorDirection,
      proposal.heroTreatment,
      proposal.photographyStyle,
      proposal.trustProofPresentation,
      proposal.productPresentation,
      ...proposal.homepageBlueprint,
      ...proposal.imagePlan.map((item) => `${item.pageSection} ${item.desiredSubject}`),
    ].join(" ");
    expect(text).not.toMatch(/\bstainless\b/i);
    expect(text).not.toMatch(/\bfabricat(?:e|ion|ed|ing)?\b/i);
  });

  test("approved authority can still produce fabrication-oriented creative language", async () => {
    const { synthesizeCreativeDirection } = await import("../site-creative-direction-synthesizer");
    const proposal = synthesizeCreativeDirection(workspace(true));
    const text = [
      proposal.productPresentation,
      proposal.trustProofPresentation,
      ...proposal.imagePlan.map((item) => item.desiredSubject),
    ].join(" ");
    expect(text).toMatch(/\bfabricat(?:e|ion|ed|ing)?\b/i);
  });

  test("explicit owner prohibition overrides fallback and authority phrasing", async () => {
    const { synthesizeCreativeDirection } = await import("../site-creative-direction-synthesizer");
    const proposal = synthesizeCreativeDirection(workspace(true), "Remove fabrication and stainless positioning.");
    const text = [
      proposal.overallDirection,
      proposal.colorDirection,
      proposal.heroTreatment,
      proposal.photographyStyle,
      proposal.trustProofPresentation,
      proposal.productPresentation,
      proposal.verticalPresentation,
      ...proposal.homepageBlueprint,
      ...proposal.imagePlan.map((item) => `${item.pageSection} ${item.desiredSubject}`),
      ...proposal.visualDos,
    ].join(" ");
    expect(text).not.toMatch(/\bstainless\b/i);
    expect(text).not.toMatch(/\bfabricat(?:e|ion|ed|ing)?\b/i);
    expect(proposal.visualDos).toContain("Apply explicit owner revision constraints before fallback defaults.");
  });

  test("contains no ProjectorEnclosure or RJ-specific branching", async () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/site-creative-direction-synthesizer.ts"), "utf8").toLowerCase();
    expect(source).not.toContain("site-ssi-projectorenclosure");
    expect(source).not.toContain("projectorenclosure");
    expect(source).not.toContain("rj-metal");
  });
});
