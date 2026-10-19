import fs from "node:fs";
import path from "node:path";
import type { SiteIntelligenceWorkspace, SiteOpportunity } from "../site-intelligence";
import type { IntegrationProfileConfiguration } from "../types";
import { synthesizeInitialSiteStrategy, synthesizeRevisedSiteStrategy } from "../site-strategy-synthesizer";

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
    name: "Local service and multi-location landing pages",
    category: "website development and local SEO",
    buyer: "Local service businesses and multi-location operators",
    problemUseCase: "Build location-accurate search visibility.",
    commercialValue: "HIGH",
    demandSignal: "Observed demand",
    competitionLevel: "MODERATE",
    organizationFit: "HIGH",
    evidenceStrength: "MODERATE",
    confidence: 0.8,
    geographicScope: "Service territories",
    nationalRolloutPotential: false,
    recurringReplacementPotential: false,
    seoContentOpportunity: "service and location pages",
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

function workspace(opportunities: SiteOpportunity[]): SiteIntelligenceWorkspace {
  return {
    workspaceId: "workspace",
    organizationId: "org",
    siteId: "site",
    internalOrganizationIdentity: "org",
    publicBrandIdentity: "PageEngines",
    revision: 1,
    intelligenceState: "INTELLIGENCE_APPROVED",
    strategyState: "STRATEGY_READY_FOR_REVIEW",
    creativeState: "CREATIVE_NOT_STARTED",
    providerReference: null,
    researchStartedAt: null,
    researchExecutions: [],
    evidence: [{
      evidenceId: "e1",
      sourceReference: "https://example.com/evidence",
      sourceType: "WEB",
      observedClaim: "Verified website and search growth demand evidence.",
      retrievedAt: "2026-09-10T00:00:00.000Z",
      entity: "Market",
      confidence: 0.8,
      strength: "MODERATE",
      authority: "OBSERVATION",
    }],
    opportunities,
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
  publicBrandIdentity: "PageEngines",
  brandProfile: profile("brand-profile", "brand"),
  seoProfile: profile("seo-profile", "seo"),
  promptProfile: profile("prompt-profile", "prompt"),
};

describe("site strategy synthesizer", () => {
  test("generic sites without fabrication authority do not get stainless/fabrication defaults", () => {
    const proposal = synthesizeInitialSiteStrategy(workspace([opportunity()]), context);
    const text = [proposal.positioning, proposal.valueProposition, ...proposal.trustProofRequirements].join(" ");
    expect(text).not.toMatch(/\bstainless\b/i);
    expect(text).not.toMatch(/\bfabricat(?:e|ion|ed|ing)?\b/i);
  });

  test("commercial consultancy to website/search platform material revision removes legacy language", () => {
    const proposal = synthesizeRevisedSiteStrategy(workspace([opportunity({
      name: "Commercial project consultancy",
      category: "commercial project consultancy",
      seoContentOpportunity: "project consulting",
    })]), context, {
      revisionInstructions: "Reposition as a website development and local-search growth platform with consultation-oriented conversion paths. We are not a commercial construction consultancy and should not be quote-centric.",
    });
    const corpus = [proposal.positioning, proposal.valueProposition, ...proposal.ctaHierarchy, ...proposal.homepageGoals, ...proposal.conversionPaths].join(" ").toLowerCase();
    expect(corpus).toMatch(/\bwebsite\b/);
    expect(corpus).toMatch(/\bsearch\b/);
    expect(corpus).not.toMatch(/commercial project resource|project requirements|quote-ready conversation|request a quote/);
  });

  test("retail store to professional service business updates IA and proposition", () => {
    const proposal = synthesizeRevisedSiteStrategy(workspace([opportunity({
      name: "Retail storefront merchandising",
      category: "retail storefront",
      seoContentOpportunity: "retail display",
    })]), context, {
      revisionInstructions: "Shift from retail store positioning to a professional service business model focused on consultation and outcomes.",
    });
    expect(proposal.positioning.toLowerCase()).toContain("professional services growth partner");
    expect(proposal.informationArchitecture).toEqual(["Home", "Services", "Process", "Industries", "About", "Contact"]);
    expect(proposal.proposedSitemap).toEqual(["/", "/services", "/process", "/industries", "/about", "/contact"]);
  });

  test("local business to multi-location business updates audience and geography", () => {
    const proposal = synthesizeRevisedSiteStrategy(workspace([opportunity()]), context, {
      revisionInstructions: "Expand from a local business to a multi-location strategy with service territory coverage and consultation-led onboarding.",
    });
    expect(proposal.primaryAudience.toLowerCase()).toMatch(/multi-location|small and medium-sized businesses/);
    expect(proposal.geographicStrategy.toLowerCase()).toMatch(/territor|location|geograph/);
  });

  test("nationwide platform guidance still respects per-customer geographic constraints", () => {
    const proposal = synthesizeRevisedSiteStrategy(workspace([opportunity()]), context, {
      revisionInstructions: "We serve customers throughout the United States as a nationwide platform, but each customer must be represented only within their verified service territory.",
    });
    expect(proposal.geographicStrategy).toContain("across the United States");
    expect(proposal.geographicStrategy.toLowerCase()).toContain("per-customer service-territory constraints");
  });

  test("removes obsolete quote-centric CTA and navigation in material revisions", () => {
    const proposal = synthesizeRevisedSiteStrategy(workspace([opportunity()]), context, {
      revisionInstructions: "Use website growth positioning and remove quote-centric navigation. Focus on solutions and contact.",
    });
    expect(proposal.ctaHierarchy[0]).toBe("Get Started");
    expect(proposal.informationArchitecture).toEqual(["Home", "Solutions", "How It Works", "Industries", "About", "Contact"]);
    expect(proposal.proposedSitemap).not.toContain("/request-a-quote");
  });

  test("changes primary conversion goal to consultation-led flow", () => {
    const proposal = synthesizeRevisedSiteStrategy(workspace([opportunity()]), context, {
      revisionInstructions: "Set primary conversion to consultation and growth-plan intake for website search visibility.",
    });
    expect(proposal.ctaHierarchy).toEqual(["Get Started", "Book a Consultation", "Request SEO Growth Plan"]);
    expect(proposal.conversionPaths.join(" ").toLowerCase()).toContain("consultation");
  });

  test("minor copy-only revision keeps structural fields stable", () => {
    const base = synthesizeInitialSiteStrategy(workspace([opportunity()]), context);
    const proposal = synthesizeRevisedSiteStrategy(workspace([opportunity()]), context, {
      revisionInstructions: "Minor copy-only revision: tighten phrasing but keep structure.",
    });
    expect(proposal.informationArchitecture).toEqual(base.informationArchitecture);
    expect(proposal.proposedSitemap).toEqual(base.proposedSitemap);
    expect(proposal.ctaHierarchy).toEqual(base.ctaHierarchy);
  });

  test("fails closed on conflicting/insufficient revision intent", () => {
    expect(() => synthesizeRevisedSiteStrategy(workspace([opportunity()]), context, {
      revisionInstructions: "Remove consultancy language.",
    })).toThrow("STRATEGY_REVISION_INCOMPLETE_INTENT");
  });

  test("unverified capabilities are not promoted into authorized product/service families", () => {
    const proposal = synthesizeRevisedSiteStrategy(workspace([
      opportunity(),
      opportunity({
        opportunityId: "opportunity-2",
        name: "AI search visibility monitoring",
        category: "ai search monitoring",
        capabilityState: "OWNER_VALIDATION_REQUIRED",
        capabilityEvidenceIds: [],
        capabilityAuthorityRevisions: [],
      }),
    ]), context, {
      revisionInstructions: "Reposition around website and search growth services.",
    });
    expect(proposal.productServiceFamilies.some((item) => /ai search visibility monitoring/i.test(item))).toBe(false);
  });

  test("cross-site isolation: one site's opportunities do not leak into another revision output", () => {
    const siteA = workspace([opportunity({ name: "HVAC local SEO growth", opportunityId: "a1" })]);
    const siteB = workspace([opportunity({ name: "Dental practice lead generation", opportunityId: "b1" })]);
    const revisedA = synthesizeRevisedSiteStrategy(siteA, context, { revisionInstructions: "Reposition for website and search growth." });
    const revisedB = synthesizeRevisedSiteStrategy(siteB, { ...context, publicBrandIdentity: "DentalEngines" }, { revisionInstructions: "Reposition for website and search growth." });
    expect(revisedA.reason).toContain("HVAC local SEO growth");
    expect(revisedB.reason).toContain("Dental practice lead generation");
    expect(revisedA.reason).not.toContain("Dental practice lead generation");
  });

  test("revision output preserves contract context for history/audit", () => {
    const instructions = "Reposition around website and search growth services for multi-location operators.";
    const proposal = synthesizeRevisedSiteStrategy(workspace([opportunity()]), context, { revisionInstructions: instructions });
    expect(proposal.synthesisContext?.approvedOpportunityIds).toEqual(["opportunity-1"]);
    expect(proposal.synthesisContext?.profileIds).toEqual(["brand-profile", "seo-profile", "prompt-profile"]);
    expect(proposal.synthesisContext?.revisionInstructions).toBe(instructions);
  });

  test("contains no ProjectorEnclosure or RJ-specific branching", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/site-strategy-synthesizer.ts"), "utf8").toLowerCase();
    expect(source).not.toContain("site-ssi-projectorenclosure");
    expect(source).not.toContain("projectorenclosure");
    expect(source).not.toContain("rj-metal");
  });
});
