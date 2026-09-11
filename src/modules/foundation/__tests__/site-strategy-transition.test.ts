import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SiteIntelligenceEvidence, SiteOpportunity } from "../site-intelligence";
import type { IntegrationProfileConfiguration } from "../types";

const scope = { organizationId: "strategy-org", siteId: "strategy-site", actor: "owner", reason: "Strategy transition test." };
const evidence: SiteIntelligenceEvidence = { evidenceId: "e1", sourceReference: "https://example.com/evidence", sourceType: "WEB", observedClaim: "Observed market demand.", retrievedAt: "2026-09-10T00:00:00.000Z", entity: "Market", confidence: 0.8, strength: "MODERATE", authority: "OBSERVATION" };

function opportunity(id: string, ownerDecision: SiteOpportunity["ownerDecision"], capabilityState: SiteOpportunity["capabilityState"]): SiteOpportunity {
  return { opportunityId: id, name: `Opportunity ${id}`, category: `Vertical ${id}`, buyer: `Buyer ${id}`, problemUseCase: "Use case", commercialValue: "HIGH", demandSignal: "Observed", competitionLevel: "MODERATE", organizationFit: "UNKNOWN", evidenceStrength: "MODERATE", confidence: 0.8, geographicScope: "Regional", nationalRolloutPotential: false, recurringReplacementPotential: false, seoContentOpportunity: "Candidate", rationale: "Evidence-backed market priority.", competitorEntities: [], evidenceIds: ["e1"], capabilityState, capabilityEvidenceIds: capabilityState === "VERIFIED" || capabilityState === "QUALIFIED" ? [`owner-${id}`] : [], capabilityNotes: null, recommendation: "Review", ownerDecision, decidedBy: ownerDecision === "PENDING" ? null : "owner", decidedAt: ownerDecision === "PENDING" ? null : "2026-09-10T00:01:00.000Z" };
}

function profile(profileId: string, profileType: IntegrationProfileConfiguration["profileType"]): IntegrationProfileConfiguration {
  return { profileId, profileType, organizationId: scope.organizationId, profileName: `${profileType} profile`, description: `${profileType} content guidance`, status: "active", enabled: true, version: "1", assignedSiteIds: [scope.siteId], defaultForOrganization: false, references: { voiceReference: profileType === "brand" ? "clear-commercial-voice" : null, titleStrategyReference: profileType === "seo" ? "market-title-strategy" : null, promptReference: profileType === "prompt" ? "evidence-led-content" : null } as IntegrationProfileConfiguration["references"], createdAt: "2026-09-10T00:00:00.000Z", updatedAt: "2026-09-10T00:00:00.000Z", notes: `${profileType} notes` };
}

const context = { domain: "example.com", publicBrandIdentity: "Example Fabrication", brandProfile: profile("brand-profile", "brand"), seoProfile: profile("seo-profile", "seo"), promptProfile: profile("prompt-profile", "prompt") };

describe("Site Intelligence to strategy transition", () => {
  const old = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let directory: string;
  beforeEach(() => { jest.resetModules(); directory = fs.mkdtempSync(path.join(os.tmpdir(), "site-strategy-transition-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = directory; });
  afterEach(() => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = old; fs.rmSync(directory, { recursive: true, force: true }); });

  async function reviewed(opportunities: SiteOpportunity[]) {
    const repository = await import("../site-intelligence-repository");
    let workspace = repository.ensureSiteIntelligenceWorkspace({ ...scope, publicBrandIdentity: context.publicBrandIdentity });
    workspace = repository.startSiteIntelligence({ ...scope, expectedRevision: workspace.revision, providerReference: "test" });
    for (const item of opportunities) workspace = repository.recordSiteOpportunity({ ...scope, expectedRevision: workspace.revision, opportunity: item, evidence: workspace.evidence.length ? [] : [evidence] });
    if (opportunities.some((item) => item.ownerDecision === "APPROVED")) workspace = repository.approveSiteIntelligence({ ...scope, expectedRevision: workspace.revision });
    return { repository, workspace };
  }

  test("readiness uses existing approved-intelligence and approved-opportunity prerequisites", async () => {
    const pending = await reviewed([opportunity("pending", "PENDING", "OWNER_VALIDATION_REQUIRED")]);
    expect(pending.repository.getStrategyReadiness(pending.workspace)).toMatchObject({ ready: false, approvedOpportunityCount: 0 });
    expect(pending.repository.getStrategyReadiness(pending.workspace).blockers).toEqual(expect.arrayContaining([expect.stringContaining("Approve Site Intelligence"), expect.stringContaining("Approve at least one")]));
    fs.rmSync(directory, { recursive: true, force: true }); fs.mkdirSync(directory); jest.resetModules();
    const ready = await reviewed([opportunity("approved", "APPROVED", "OWNER_VALIDATION_REQUIRED")]);
    expect(ready.repository.getStrategyReadiness(ready.workspace)).toMatchObject({ ready: true, approvedOpportunityCount: 1, verifiedCapabilityCount: 0, qualifiedCapabilityCount: 0 });
  });

  test("first synthesis creates one review revision and double click is idempotent", async () => {
    const started = await reviewed([opportunity("verified", "APPROVED", "VERIFIED"), opportunity("future", "APPROVED", "FUTURE_CAPABILITY"), opportunity("rejected", "REJECTED", "VERIFIED")]);
    started.workspace = started.repository.addCreativeInput({ ...scope, expectedRevision: started.workspace.revision, creativeInput: { inputId: "reference-1", kind: "URL", reference: "https://reference.example/layout", sentiment: "LIKE", classification: "EXTERNAL_INSPIRATION_ONLY", notes: "Like the navigation.", suppliedBy: "owner", suppliedAt: "2026-09-10T00:02:00.000Z", binaryAsset: null } });
    const { synthesizeInitialSiteStrategy } = await import("../site-strategy-synthesizer");
    const proposal = synthesizeInitialSiteStrategy(started.workspace, context);
    let workspace = started.repository.addInitialStrategyProposal({ ...scope, expectedRevision: started.workspace.revision, proposal });
    const firstRevision = workspace.revision;
    workspace = started.repository.addInitialStrategyProposal({ ...scope, expectedRevision: started.workspace.revision, proposal });
    expect(workspace.revision).toBe(firstRevision);
    expect(workspace.strategyRevisions).toHaveLength(1);
    expect(workspace.strategyState).toBe("STRATEGY_READY_FOR_REVIEW");
    expect(workspace.strategyRevisions[0]).toMatchObject({ status: "PROPOSED", decidedBy: null, decidedAt: null, proposedProductAuthority: ["Opportunity verified"] });
    expect(workspace.strategyRevisions[0].reason).not.toContain("Opportunity rejected");
    expect(workspace.strategyRevisions[0].reason).toContain("1 owner references considered (1 likes");
    expect(workspace.strategyRevisions[0].synthesisContext?.referenceGuidance).toContain("Favor: Like the navigation.");
    expect(workspace.strategyRevisions[0].synthesisContext?.evidenceClaims).toContain("Observed market demand.");
    expect(workspace.strategyRevisions[0].synthesisContext?.profileGuidance).toEqual(expect.arrayContaining(["brand content guidance", "seo content guidance", "prompt content guidance", "voiceReference: clear-commercial-voice", "titleStrategyReference: market-title-strategy", "promptReference: evidence-led-content"]));
    expect(workspace.strategyRevisions[0].synthesisContext?.futureCapabilityOpportunityIds).toEqual(["future"]);
    expect(workspace.creativeState).toBe("CREATIVE_INPUTS_COLLECTING");
    expect(workspace.creativeRevisions).toEqual([]);
  });

  test("unverified approved markets inform strategy but cannot become present capability authority", async () => {
    const started = await reviewed([opportunity("market", "APPROVED", "OWNER_VALIDATION_REQUIRED")]);
    const { synthesizeInitialSiteStrategy } = await import("../site-strategy-synthesizer");
    const proposal = synthesizeInitialSiteStrategy(started.workspace, context);
    expect(proposal.majorVerticals).toEqual(["Vertical market"]);
    expect(proposal.proposedProductAuthority).toEqual([]);
    expect(proposal.productServiceFamilies).toEqual([]);
    expect(proposal.synthesisContext?.pendingCapabilityOpportunityIds).toEqual(["market"]);
    for (const value of [proposal.positioning, proposal.valueProposition, ...proposal.homepageGoals, proposal.geographicStrategy]) expect(value).not.toMatch(/owner validation|owner-verified|verified capabilities|qualified capabilities|authority gating/i);
  });

  test("CAS and organization scope fail closed while downstream stores remain absent", async () => {
    const started = await reviewed([opportunity("approved", "APPROVED", "QUALIFIED")]);
    const { synthesizeInitialSiteStrategy } = await import("../site-strategy-synthesizer");
    const proposal = synthesizeInitialSiteStrategy(started.workspace, context);
    expect(() => started.repository.addInitialStrategyProposal({ ...scope, organizationId: "other", expectedRevision: started.workspace.revision, proposal })).toThrow("ORGANIZATION_MISMATCH");
    expect(() => started.repository.addInitialStrategyProposal({ ...scope, expectedRevision: started.workspace.revision - 1, proposal })).toThrow("revision conflict");
    const workspace = started.repository.addInitialStrategyProposal({ ...scope, expectedRevision: started.workspace.revision, proposal });
    expect(workspace.strategyRevisions).toHaveLength(1);
    for (const name of ["product-repository.json", "glw-campaign-repository.json", "glw-page-execution-repository.json", "wordpress-credential-store.json"]) expect(fs.existsSync(path.join(directory, name))).toBe(false);
  });

  test("approval is terminal and owner correction preserves approved revision history", async () => {
    const started = await reviewed([opportunity("approved", "APPROVED", "VERIFIED")]);
    const { synthesizeInitialSiteStrategy } = await import("../site-strategy-synthesizer");
    let workspace = started.repository.addInitialStrategyProposal({ ...scope, expectedRevision: started.workspace.revision, proposal: synthesizeInitialSiteStrategy(started.workspace, context) });
    workspace = started.repository.decideStrategy({ ...scope, expectedRevision: workspace.revision, decision: "APPROVED" });
    const approvedRevision = structuredClone(workspace.strategyRevisions[0]);
    const approvalEvents = workspace.audit.filter((item) => item.action === "STRATEGY_APPROVED").length;
    expect(() => started.repository.decideStrategy({ ...scope, expectedRevision: workspace.revision, decision: "APPROVED" })).toThrow("STRATEGY_DECISION_ALREADY_FINAL");
    const correctionReason = "Owner indicated strategy approval was unintentional; reopened for review before further strategy work.";
    expect(() => started.repository.reopenApprovedStrategyForReview({ ...scope, expectedRevision: workspace.revision - 1, reason: correctionReason })).toThrow("revision conflict");
    expect(() => started.repository.reopenApprovedStrategyForReview({ ...scope, organizationId: "other", expectedRevision: workspace.revision, reason: correctionReason })).toThrow("ORGANIZATION_MISMATCH");
    workspace = started.repository.reopenApprovedStrategyForReview({ ...scope, expectedRevision: workspace.revision, reason: correctionReason });
    expect(workspace.strategyState).toBe("STRATEGY_READY_FOR_REVIEW");
    expect(workspace.strategyRevisions).toHaveLength(2);
    expect(workspace.strategyRevisions[0]).toEqual(approvedRevision);
    expect(workspace.strategyRevisions[1]).toMatchObject({ revision: 2, status: "REVISION_REQUESTED", createdBy: "owner", reason: correctionReason, decidedBy: null, decidedAt: null });
    expect(workspace.audit.filter((item) => item.action === "STRATEGY_APPROVED")).toHaveLength(approvalEvents);
    expect(workspace.audit.at(-1)).toMatchObject({ action: "STRATEGY_REOPENED_FOR_REVIEW", actor: "owner", reason: correctionReason });
    expect(started.repository.getSiteIntelligenceWorkspace(scope.siteId)?.strategyRevisions).toHaveLength(2);
  });
});
