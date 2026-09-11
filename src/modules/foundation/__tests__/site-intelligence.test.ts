import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SiteIntelligenceEvidence, SiteOpportunity } from "../site-intelligence";
import { canUseOpportunityAsAuthority, downstreamGenerationAllowed, isPublishableSiteAsset } from "../site-intelligence";

const scope = { organizationId: "rj-metal", siteId: "site-rj-metal-commercial-stainless-counters", actor: "owner", reason: "Owner review." };

function evidence(): SiteIntelligenceEvidence {
  return { evidenceId: "evidence-market-1", sourceReference: "https://market.example/observed", sourceType: "WEB", observedClaim: "A competitor markets a category.", retrievedAt: "2026-09-10T00:00:00.000Z", entity: "Observed Competitor", confidence: 0.8, strength: "MODERATE", authority: "OBSERVATION" };
}

function opportunity(): SiteOpportunity {
  return { opportunityId: "opportunity-1", name: "Observed market category", category: "market", buyer: "commercial buyer", problemUseCase: "observed use case", commercialValue: "UNKNOWN", demandSignal: "Observed market language", competitionLevel: "UNKNOWN", organizationFit: "UNKNOWN", evidenceStrength: "MODERATE", confidence: 0.8, geographicScope: "Unknown", nationalRolloutPotential: false, recurringReplacementPotential: false, seoContentOpportunity: "Research required", rationale: "Evidence supports market interest, not business capability.", competitorEntities: ["Observed Competitor"], evidenceIds: ["evidence-market-1"], capabilityState: "OWNER_VALIDATION_REQUIRED", capabilityEvidenceIds: [], capabilityNotes: null, recommendation: "OWNER_VALIDATION_REQUIRED", ownerDecision: "PENDING", decidedBy: null, decidedAt: null };
}

describe("site intelligence authority", () => {
  const oldDir = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let dir: string;

  beforeEach(() => {
    jest.resetModules();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "site-intelligence-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = dir;
  });

  afterEach(() => {
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = oldDir;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("creates a scoped not-started workspace without downstream mutations", async () => {
    const repository = await import("../site-intelligence-repository");
    const workspace = repository.ensureSiteIntelligenceWorkspace({ organizationId: "rj-metal", siteId: "site-rj-metal-commercial-stainless-counters", publicBrandIdentity: "Rocklin Metal", actor: "owner" });
    expect(workspace).toMatchObject({ internalOrganizationIdentity: "rj-metal", publicBrandIdentity: "Rocklin Metal", intelligenceState: "INTELLIGENCE_NOT_STARTED", strategyState: "STRATEGY_NOT_STARTED", creativeState: "CREATIVE_NOT_STARTED", revision: 0 });
    expect(workspace.opportunities).toEqual([]);
    expect(fs.readdirSync(dir)).toEqual(["site-intelligence-repository.json"]);
  });

  test("retains provenance and does not convert discovery into capability authority", async () => {
    const repository = await import("../site-intelligence-repository");
    let workspace = repository.ensureSiteIntelligenceWorkspace({ ...scope, publicBrandIdentity: "Rocklin Metal" });
    workspace = repository.startSiteIntelligence({ ...scope, expectedRevision: workspace.revision, providerReference: "provider-bounded-site-research-v1" });
    workspace = repository.recordSiteOpportunity({ ...scope, expectedRevision: workspace.revision, opportunity: opportunity(), evidence: [evidence()] });
    expect(workspace.evidence[0]).toEqual(evidence());
    expect(workspace.opportunities[0].capabilityState).toBe("OWNER_VALIDATION_REQUIRED");
    expect(canUseOpportunityAsAuthority(workspace.opportunities[0])).toBe(false);
  });

  test("owner decisions and capability validation are explicit", async () => {
    const repository = await import("../site-intelligence-repository");
    let workspace = repository.ensureSiteIntelligenceWorkspace({ ...scope, publicBrandIdentity: "Rocklin Metal" });
    workspace = repository.startSiteIntelligence({ ...scope, expectedRevision: workspace.revision, providerReference: "provider" });
    workspace = repository.recordSiteOpportunity({ ...scope, expectedRevision: workspace.revision, opportunity: opportunity(), evidence: [evidence()] });
    for (const decision of ["RESEARCH_MORE", "HOLD", "REJECTED", "APPROVED"] as const) {
      workspace = repository.decideSiteOpportunity({ ...scope, expectedRevision: workspace.revision, opportunityId: "opportunity-1", decision });
      expect(workspace.opportunities[0].ownerDecision).toBe(decision);
    }
    workspace = repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "opportunity-1", state: "REJECTED", evidenceIds: [], notes: "Not offered." });
    expect(canUseOpportunityAsAuthority(workspace.opportunities[0])).toBe(false);
    workspace = repository.addCreativeInput({ ...scope, expectedRevision: workspace.revision, creativeInput: { inputId: "owner-evidence-1", kind: "URL", reference: "https://owner.example/capability", sentiment: "REFERENCE_ONLY", classification: "OWNER_SUPPLIED_REFERENCE", notes: "Owner capability evidence.", suppliedBy: "owner", suppliedAt: "2026-09-10T00:00:00.000Z", binaryAsset: null } });
    workspace = repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "opportunity-1", state: "VERIFIED", evidenceIds: ["creative:owner-evidence-1"], evidenceRelevance: [{ evidenceId: "creative:owner-evidence-1", relevanceType: "DIRECT_CAPABILITY_PROOF", ownerConfirmedRelevant: true }], attestation: "Rocklin Metal currently provides this capability.", notes: "Owner confirmed with evidence." });
    expect(canUseOpportunityAsAuthority(workspace.opportunities[0])).toBe(true);
  });

  test("market decisions remain independent from capability authority and survive reload", async () => {
    const repository = await import("../site-intelligence-repository");
    let workspace = repository.ensureSiteIntelligenceWorkspace({ ...scope, publicBrandIdentity: "Rocklin Metal" });
    workspace = repository.startSiteIntelligence({ ...scope, expectedRevision: workspace.revision, providerReference: "provider" });
    workspace = repository.recordSiteOpportunity({ ...scope, expectedRevision: workspace.revision, opportunity: opportunity(), evidence: [evidence()] });
    for (const decision of ["APPROVED", "RESEARCH_MORE", "HOLD", "REJECTED"] as const) {
      workspace = repository.decideSiteOpportunity({ ...scope, expectedRevision: workspace.revision, opportunityId: "opportunity-1", decision });
      expect(workspace.opportunities).toHaveLength(1);
      expect(workspace.opportunities[0]).toMatchObject({ ownerDecision: decision, capabilityState: "OWNER_VALIDATION_REQUIRED", capabilityEvidenceIds: [] });
      expect(workspace.strategyRevisions).toEqual([]);
    }
    expect(repository.getSiteIntelligenceWorkspace(scope.siteId)?.opportunities[0]).toMatchObject({ ownerDecision: "REJECTED", capabilityState: "OWNER_VALIDATION_REQUIRED" });
  });

  test("capability decisions preserve authority requirements and do not change market decisions", async () => {
    const repository = await import("../site-intelligence-repository");
    let workspace = repository.ensureSiteIntelligenceWorkspace({ ...scope, publicBrandIdentity: "Rocklin Metal" });
    workspace = repository.startSiteIntelligence({ ...scope, expectedRevision: workspace.revision, providerReference: "provider" });
    workspace = repository.recordSiteOpportunity({ ...scope, expectedRevision: workspace.revision, opportunity: opportunity(), evidence: [evidence()] });
    workspace = repository.decideSiteOpportunity({ ...scope, expectedRevision: workspace.revision, opportunityId: "opportunity-1", decision: "APPROVED" });
    expect(() => repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "opportunity-1", state: "VERIFIED", evidenceIds: [], notes: "Missing attestation" })).toThrow("CAPABILITY_ATTESTATION_REQUIRED");
    workspace = repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "opportunity-1", state: "VERIFIED", evidenceIds: [], attestation: "Rocklin Metal currently provides this capability.", notes: "" });
    expect(workspace.opportunities[0]).toMatchObject({ ownerDecision: "APPROVED", capabilityState: "VERIFIED", capabilityEvidenceIds: [], capabilityAuthorityRevisions: [expect.objectContaining({ authorityBasis: "OWNER_ATTESTATION" })] });
    expect(() => repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "opportunity-1", state: "QUALIFIED", evidenceIds: [], notes: "Missing attestation" })).toThrow("CAPABILITY_ATTESTATION_REQUIRED");
    workspace = repository.addCreativeInput({ ...scope, expectedRevision: workspace.revision, creativeInput: { inputId: "qualified-evidence", kind: "URL", reference: "https://owner.example/qualified", sentiment: "REFERENCE_ONLY", classification: "OWNER_SUPPLIED_REFERENCE", notes: "Qualified capability evidence.", suppliedBy: "owner", suppliedAt: "2026-09-10T00:00:00.000Z", binaryAsset: null } });
    workspace = repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "opportunity-1", state: "QUALIFIED", evidenceIds: ["creative:qualified-evidence"], evidenceRelevance: [{ evidenceId: "creative:qualified-evidence", relevanceType: "SERVICE_SCOPE", ownerConfirmedRelevant: true }], attestation: "Rocklin Metal provides this capability subject to the recorded limits.", notes: "Qualified scope." });
    expect(workspace.opportunities[0]).toMatchObject({ ownerDecision: "APPROVED", capabilityState: "QUALIFIED", capabilityEvidenceIds: ["creative:qualified-evidence"] });
    workspace = repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "opportunity-1", state: "FUTURE_CAPABILITY", evidenceIds: [], attestation: "Rocklin Metal intends to develop this capability.", notes: "Future capability." });
    expect(workspace.opportunities[0]).toMatchObject({ ownerDecision: "APPROVED", capabilityState: "FUTURE_CAPABILITY" });
    workspace = repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "opportunity-1", state: "REJECTED", evidenceIds: [], notes: "Not offered." });
    expect(workspace.opportunities[0]).toMatchObject({ ownerDecision: "APPROVED", capabilityState: "REJECTED" });
  });

  test("duplicate market clicks are CAS-safe and cannot duplicate opportunities", async () => {
    const repository = await import("../site-intelligence-repository");
    let workspace = repository.ensureSiteIntelligenceWorkspace({ ...scope, publicBrandIdentity: "Rocklin Metal" });
    workspace = repository.startSiteIntelligence({ ...scope, expectedRevision: workspace.revision, providerReference: "provider" });
    workspace = repository.recordSiteOpportunity({ ...scope, expectedRevision: workspace.revision, opportunity: opportunity(), evidence: [evidence()] });
    const decisionRevision = workspace.revision;
    workspace = repository.decideSiteOpportunity({ ...scope, expectedRevision: decisionRevision, opportunityId: "opportunity-1", decision: "APPROVED" });
    expect(() => repository.decideSiteOpportunity({ ...scope, expectedRevision: decisionRevision, opportunityId: "opportunity-1", decision: "APPROVED" })).toThrow("revision conflict");
    expect(workspace.opportunities).toHaveLength(1);
    expect(() => repository.decideSiteOpportunity({ ...scope, organizationId: "other", expectedRevision: workspace.revision, opportunityId: "opportunity-1", decision: "HOLD" })).toThrow("ORGANIZATION_MISMATCH");
    expect(() => repository.decideSiteOpportunity({ ...scope, expectedRevision: workspace.revision, opportunityId: "opportunity-1", decision: "INVALID" as never })).toThrow("OPPORTUNITY_DECISION_INVALID");
    expect(() => repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "opportunity-1", state: "INVALID" as never, evidenceIds: [], notes: "" })).toThrow("CAPABILITY_STATE_INVALID");
  });

  test("strategy and creative proposals require prior approvals and retain revisions", async () => {
    const repository = await import("../site-intelligence-repository");
    let workspace = repository.ensureSiteIntelligenceWorkspace({ ...scope, publicBrandIdentity: "Rocklin Metal" });
    workspace = repository.startSiteIntelligence({ ...scope, expectedRevision: workspace.revision, providerReference: "provider" });
    workspace = repository.recordSiteOpportunity({ ...scope, expectedRevision: workspace.revision, opportunity: opportunity(), evidence: [evidence()] });
    await expect(async () => repository.addStrategyProposal({ ...scope, expectedRevision: workspace.revision, proposal: strategyProposal() })).rejects.toThrow("APPROVED_INTELLIGENCE_REQUIRED");
    workspace = repository.decideSiteOpportunity({ ...scope, expectedRevision: workspace.revision, opportunityId: "opportunity-1", decision: "APPROVED" });
    workspace = repository.approveSiteIntelligence({ ...scope, expectedRevision: workspace.revision });
    workspace = repository.addStrategyProposal({ ...scope, expectedRevision: workspace.revision, proposal: strategyProposal() });
    expect(workspace.strategyRevisions[0].revision).toBe(1);
    workspace = repository.decideStrategy({ ...scope, expectedRevision: workspace.revision, decision: "APPROVED" });
    workspace = repository.addCreativeInput({ ...scope, expectedRevision: workspace.revision, creativeInput: { inputId: "creative-1", kind: "URL", reference: "https://competitor.example", sentiment: "LIKE", classification: "COMPETITOR_REFERENCE_ONLY", notes: "Layout inspiration only.", suppliedBy: "owner", suppliedAt: "2026-09-10T00:00:00.000Z", binaryAsset: null } });
    expect(workspace.creativeInputs[0].classification).toBe("COMPETITOR_REFERENCE_ONLY");
    workspace = repository.addCreativeProposal({ ...scope, expectedRevision: workspace.revision, proposal: creativeProposal(1) });
    expect(workspace.creativeRevisions[0]).toMatchObject({ revision: 1, strategyRevision: 1, status: "PROPOSED" });
    workspace = repository.decideCreativeProposal({ ...scope, expectedRevision: workspace.revision, decision: "APPROVED" });
    expect(workspace.creativeState).toBe("CREATIVE_APPROVED");
    expect(downstreamGenerationAllowed(workspace)).toBe(false);
  });

  test("asset classification keeps external references non-publishable", () => {
    expect(isPublishableSiteAsset("COMPETITOR_REFERENCE_ONLY")).toBe(false);
    expect(isPublishableSiteAsset("EXTERNAL_INSPIRATION_ONLY")).toBe(false);
    expect(isPublishableSiteAsset("GENESIS_GENERATED_CANDIDATE")).toBe(false);
    expect(isPublishableSiteAsset("OWNER_APPROVED_PUBLISHABLE")).toBe(true);
  });

  test("asset classification change is explicit and audited", async () => {
    const repository = await import("../site-intelligence-repository");
    let workspace = repository.ensureSiteIntelligenceWorkspace({ ...scope, publicBrandIdentity: "Rocklin Metal" });
    workspace = repository.addCreativeInput({ ...scope, expectedRevision: workspace.revision, creativeInput: { inputId: "asset-1", kind: "IMAGE", reference: "assetref-1", sentiment: "NEUTRAL", classification: "OWNER_SUPPLIED_REFERENCE", notes: null, suppliedBy: "owner", suppliedAt: "2026-09-10T00:00:00.000Z", binaryAsset: null } });
    workspace = repository.classifyCreativeInput({ ...scope, expectedRevision: workspace.revision, inputId: "asset-1", classification: "OWNER_APPROVED_PUBLISHABLE" });
    expect(workspace.creativeInputs[0].classification).toBe("OWNER_APPROVED_PUBLISHABLE");
    expect(workspace.audit.at(-1)?.action).toBe("CREATIVE_INPUT_CLASSIFIED");
  });

  test("reload is durable, organization mismatch and stale revision fail closed", async () => {
    const repository = await import("../site-intelligence-repository");
    const workspace = repository.ensureSiteIntelligenceWorkspace({ ...scope, publicBrandIdentity: "Rocklin Metal" });
    expect(repository.getSiteIntelligenceWorkspace(scope.siteId)?.publicBrandIdentity).toBe("Rocklin Metal");
    expect(() => repository.startSiteIntelligence({ ...scope, organizationId: "led-display-warehouse", expectedRevision: workspace.revision, providerReference: "provider" })).toThrow("ORGANIZATION_MISMATCH");
    const started = repository.startSiteIntelligence({ ...scope, expectedRevision: workspace.revision, providerReference: "provider" });
    expect(() => repository.decideSiteOpportunity({ ...scope, expectedRevision: workspace.revision, opportunityId: "missing", decision: "HOLD" })).toThrow("revision conflict");
    expect(repository.getSiteIntelligenceWorkspace(scope.siteId)?.revision).toBe(started.revision);
  });
});

function strategyProposal() {
  return { positioning: "Proposed positioning", primaryAudience: "Commercial buyers", secondaryAudiences: [], valueProposition: "Proposed value", majorVerticals: [], productServiceFamilies: [], informationArchitecture: ["Home"], proposedSitemap: ["/"], homepageGoals: ["Explain authority"], conversionPaths: ["Contact"], ctaHierarchy: ["Request quote"], trustProofRequirements: ["Owner evidence"], geographicStrategy: "To be validated", proposedProductAuthority: [], reason: "Synthesized from approved intelligence." };
}

function creativeProposal(strategyRevision: number) {
  return { strategyRevision, overallDirection: "Proposed visual direction", brandInterpretation: "Evidence-led", colorDirection: "Owner approval required", typographyDirection: "Owner approval required", spacingLayoutDirection: "Clear commercial hierarchy", photographyStyle: "Real fabrication preferred", generatedImageStyle: "Candidate only until approved", heroTreatment: "Positioning and proof", ctaTreatment: "Clear quote path", trustProofPresentation: "Verified evidence only", productPresentation: "Authority-backed", verticalPresentation: "Approved capabilities only", mobileConsiderations: "Compact hierarchy", visualDos: ["Use approved assets"], visualDonts: ["Do not use competitor imagery"], homepageBlueprint: ["Hero", "Capabilities", "Proof", "CTA"], imagePlan: [{ requirementId: "image-home-hero", pageSection: "Homepage Hero", desiredSubject: "Approved fabrication context", aspectOrientation: "wide", purpose: "Positioning", preferredSource: "Owner photography", approvedAssetAvailable: false, ownerUploadRecommended: true, generationCandidate: true, status: "OWNER_UPLOAD_OR_GENERATE_FOR_APPROVAL" as const }], reason: "Derived from approved strategy." };
}