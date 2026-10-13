import fs from "node:fs";
import path from "node:path";
import type { SiteIntelligenceWorkspace, SiteOpportunity } from "../site-intelligence";
import type { IntegrationProfileConfiguration } from "../types";

jest.mock("server-only", () => ({}));

function profile(profileId: string, profileType: IntegrationProfileConfiguration["profileType"]): IntegrationProfileConfiguration {
  return {
    profileId,
    profileType,
    organizationId: "org",
    profileName: `${profileType} profile`,
    description: `${profileType} guidance`,
    status: "active",
    enabled: true,
    version: "1",
    assignedSiteIds: ["site"],
    defaultForOrganization: false,
    references: {},
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
    notes: `${profileType} notes`,
  };
}

function opportunity(overrides: Partial<SiteOpportunity> = {}): SiteOpportunity {
  return {
    opportunityId: "opportunity-1",
    name: "Projector protection systems",
    category: "projector protection",
    buyer: "Commercial facilities teams",
    problemUseCase: "Protect projector systems across weather and security constraints.",
    commercialValue: "HIGH",
    demandSignal: "Observed demand",
    competitionLevel: "MODERATE",
    organizationFit: "HIGH",
    evidenceStrength: "MODERATE",
    confidence: 0.8,
    geographicScope: "National",
    nationalRolloutPotential: true,
    recurringReplacementPotential: false,
    seoContentOpportunity: "projector protection enclosure",
    rationale: "Evidence-backed demand.",
    competitorEntities: [],
    evidenceIds: ["e1"],
    capabilityState: "VERIFIED",
    capabilityEvidenceIds: ["owner-opportunity-1"],
    capabilityNotes: null,
    capabilityAuthorityRevisions: [{
      organizationId: "org",
      siteId: "site",
      opportunityId: "opportunity-1",
      decision: "VERIFIED",
      evidenceIds: ["owner-opportunity-1"],
      evidenceRelevance: [],
      attestation: "Owner confirms current capability.",
      qualificationNotes: null,
      decidedBy: "owner",
      decidedAt: "2026-09-10T00:01:00.000Z",
      revision: 1,
    }],
    recommendation: "RESEARCH_MORE",
    ownerDecision: "APPROVED",
    decidedBy: "owner",
    decidedAt: "2026-09-10T00:01:00.000Z",
    ...overrides,
  };
}

function workspace(fabricationAuthority = false): SiteIntelligenceWorkspace {
  const approvedOpportunity = fabricationAuthority
    ? opportunity({
        name: "Custom fabrication services",
        category: "custom fabrication and technical build",
        seoContentOpportunity: "custom fabrication services",
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
    strategyState: "STRATEGY_NOT_STARTED",
    creativeState: "CREATIVE_NOT_STARTED",
    providerReference: null,
    researchStartedAt: null,
    researchExecutions: [],
    evidence: [{
      evidenceId: "e1",
      sourceReference: "https://example.com/evidence",
      sourceType: "WEB",
      observedClaim: fabricationAuthority ? "Verified fabrication workflow and technical process evidence." : "Verified product compatibility and thermal performance evidence.",
      retrievedAt: "2026-09-10T00:00:00.000Z",
      entity: "Market",
      confidence: 0.8,
      strength: "MODERATE",
      authority: "OBSERVATION",
    }],
    opportunities: [approvedOpportunity],
    strategyRevisions: [],
    creativeInputs: [],
    creativeRevisions: [],
    audit: [],
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
  };
}

const context = {
  domain: "example.com",
  publicBrandIdentity: "Projector Climate Control",
  brandProfile: profile("brand-profile", "brand"),
  seoProfile: profile("seo-profile", "seo"),
  promptProfile: profile("prompt-profile", "prompt"),
};

describe("site strategy synthesizer", () => {
  test("generic sites without fabrication authority do not get stainless/fabrication defaults", async () => {
    const { synthesizeInitialSiteStrategy } = await import("../site-strategy-synthesizer");
    const proposal = synthesizeInitialSiteStrategy(workspace(false), context);
    const text = [
      proposal.positioning,
      proposal.valueProposition,
      ...proposal.homepageGoals,
      ...proposal.trustProofRequirements,
    ].join(" ");
    expect(text).not.toMatch(/\bstainless\b/i);
    expect(text).not.toMatch(/\bfabricat(?:e|ion|ed|ing)?\b/i);
  });

  test("approved fabrication authority can still shape strategy language", async () => {
    const { synthesizeInitialSiteStrategy } = await import("../site-strategy-synthesizer");
    const proposal = synthesizeInitialSiteStrategy(workspace(true), context);
    const text = [proposal.positioning, proposal.valueProposition, ...proposal.trustProofRequirements].join(" ");
    expect(text).toMatch(/\bfabricat(?:e|ion|ed|ing)?\b/i);
  });

  test("contains no ProjectorEnclosure or RJ-specific branching", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/site-strategy-synthesizer.ts"), "utf8").toLowerCase();
    expect(source).not.toContain("site-ssi-projectorenclosure");
    expect(source).not.toContain("projectorenclosure");
    expect(source).not.toContain("rj-metal");
  });
});
