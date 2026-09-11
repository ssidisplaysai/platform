import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SiteResearchAuthority, SiteResearchProvider } from "../site-intelligence-research-executor";

const authority: SiteResearchAuthority = { organizationId: "rj-metal", siteId: "site-rj-metal-commercial-stainless-counters", domain: "commercialstainlesscounters.com", publicBrandIdentity: "Rocklin Metal", brandProfileId: "brand", seoProfileId: "seo", promptProfileId: "prompt", imageProfileId: "image" };
function output(executionId: string) { return { organizationId: authority.organizationId, siteId: authority.siteId, executionId, evidence: [{ evidenceId: "e1", sourceReference: "https://competitor.example", sourceType: "WEB" as const, observedClaim: "Observed market positioning.", retrievedAt: "2026-09-10T00:00:00.000Z", entity: "Competitor", confidence: 0.7, strength: "MODERATE" as const, authority: "OBSERVATION" as const }], opportunities: [{ opportunityId: "o1", name: "Candidate niche", category: "niche", buyer: "buyer", problemUseCase: "use", commercialValue: "UNKNOWN" as const, demandSignal: "observed", competitionLevel: "UNKNOWN" as const, organizationFit: "UNKNOWN" as const, evidenceStrength: "MODERATE" as const, confidence: 0.7, geographicScope: "unknown", nationalRolloutPotential: false, recurringReplacementPotential: false, seoContentOpportunity: "candidate", rationale: "inference", competitorEntities: ["Competitor"], evidenceIds: ["e1"], capabilityState: "VERIFIED" as const, capabilityEvidenceIds: ["fabricated"], capabilityNotes: null, recommendation: "review", ownerDecision: "APPROVED" as const, decidedBy: "provider", decidedAt: "now" }] }; }

describe("site intelligence bounded research executor", () => {
  const old = process.env.GCP_FOUNDATION_PERSISTENCE_DIR; let dir: string;
  beforeEach(() => { jest.resetModules(); dir = fs.mkdtempSync(path.join(os.tmpdir(), "site-research-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = dir; });
  afterEach(() => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = old; fs.rmSync(dir, { recursive: true, force: true }); });

  async function started() { const repository = await import("../site-intelligence-repository"); let workspace = repository.ensureSiteIntelligenceWorkspace({ organizationId: authority.organizationId, siteId: authority.siteId, publicBrandIdentity: authority.publicBrandIdentity, actor: "owner" }); workspace = repository.startSiteIntelligence({ organizationId: authority.organizationId, siteId: authority.siteId, expectedRevision: workspace.revision, actor: "owner", reason: "start", providerReference: "test" }); return workspace; }

  test("records evidence-backed output once and strips provider capability claims", async () => {
    const workspace = await started(); const execute = jest.fn(async ({ executionId }: { executionId: string }) => output(executionId)); const executor = await import("../site-intelligence-research-executor");
    const first = await executor.executeSiteIntelligenceResearch({ authority, provider: { providerId: "test", execute } as SiteResearchProvider, actor: "owner", expectedRevision: workspace.revision, maxAttempts: 2 });
    const second = await executor.executeSiteIntelligenceResearch({ authority, provider: { providerId: "test", execute } as SiteResearchProvider, actor: "owner", expectedRevision: first.revision, maxAttempts: 2 });
    expect(execute).toHaveBeenCalledTimes(1); expect(first.researchExecutions).toHaveLength(1); expect(second.researchExecutions).toHaveLength(1);
    expect(first.opportunities[0]).toMatchObject({ capabilityState: "OWNER_VALIDATION_REQUIRED", capabilityEvidenceIds: [], ownerDecision: "PENDING" });
    expect(first.intelligenceState).toBe("INTELLIGENCE_READY_FOR_REVIEW");
  });

  test("retries once then succeeds and retains source provenance", async () => {
    const workspace = await started(); let calls = 0; const executor = await import("../site-intelligence-research-executor");
    const result = await executor.executeSiteIntelligenceResearch({ authority, provider: { providerId: "test", async execute({ executionId }) { calls += 1; if (calls === 1) throw new Error("transient"); return output(executionId); } }, actor: "owner", expectedRevision: workspace.revision, maxAttempts: 2 });
    expect(calls).toBe(2); expect(result.researchExecutions[0]).toMatchObject({ state: "READY_FOR_REVIEW", attemptCount: 2 }); expect(result.evidence[0].sourceReference).toBe("https://competitor.example");
  });

  test("bounded provider timeout becomes recoverable", async () => {
    const workspace = await started(); const executor = await import("../site-intelligence-research-executor");
    const result = await executor.executeSiteIntelligenceResearch({ authority, provider: { providerId: "test", async execute() { throw new DOMException("timeout", "AbortError"); } }, actor: "owner", expectedRevision: workspace.revision, maxAttempts: 2 });
    expect(result.researchExecutions[0]).toMatchObject({ state: "RECOVERABLE", attemptCount: 2, errorCode: "PROVIDER_TIMEOUT" });
  });

  test("contract rejection is recoverable and persists no partial provider output", async () => {
    const workspace = await started(); const executor = await import("../site-intelligence-research-executor");
    const result = await executor.executeSiteIntelligenceResearch({ authority, provider: { providerId: "test", async execute() { throw new Error("RESEARCH_PROVIDER_RESPONSE_INVALID:unexpected_field"); } }, actor: "owner", expectedRevision: workspace.revision, maxAttempts: 1 });
    expect(result.researchExecutions[0]).toMatchObject({ state: "RECOVERABLE", attemptCount: 1, errorCode: "RESEARCH_PROVIDER_RESPONSE_INVALID", errorMessage: "RESEARCH_PROVIDER_RESPONSE_INVALID:unexpected_field" });
    expect(result.evidence).toEqual([]); expect(result.opportunities).toEqual([]);
  });

  test("resumes the same recoverable initial execution and retains cumulative attempts", async () => {
    const workspace = await started(); const executor = await import("../site-intelligence-research-executor"); let calls = 0;
    const provider: SiteResearchProvider = { providerId: "test", async execute({ executionId }) { calls += 1; if (calls === 1) throw new Error("transient"); return output(executionId); } };
    const failed = await executor.executeSiteIntelligenceResearch({ authority, provider, actor: "owner", expectedRevision: workspace.revision, maxAttempts: 1 });
    const executionId = failed.researchExecutions[0].executionId;
    const recovered = await executor.executeSiteIntelligenceResearch({ authority, provider, actor: "owner", expectedRevision: failed.revision, maxAttempts: 1 });
    expect(calls).toBe(2); expect(recovered.researchExecutions).toHaveLength(1);
    expect(recovered.researchExecutions[0]).toMatchObject({ executionId, state: "READY_FOR_REVIEW", attemptCount: 2, maxAttempts: 2 });
    expect(recovered.opportunities[0]).toMatchObject({ capabilityState: "OWNER_VALIDATION_REQUIRED", ownerDecision: "PENDING", decidedBy: null, decidedAt: null });
  });

  test("persists provider execution receipt metadata on success", async () => {
    const workspace = await started(); const executor = await import("../site-intelligence-research-executor");
    const result = await executor.executeSiteIntelligenceResearch({ authority, provider: { providerId: "test", async execute({ executionId }) { return { ...output(executionId), provider: { providerExecutionId: "provider-123", completedAt: "2026-09-10T00:01:00.000Z" } }; } }, actor: "owner", expectedRevision: workspace.revision, maxAttempts: 1 });
    expect(result.researchExecutions[0]).toMatchObject({ providerExecutionId: "provider-123", providerCompletedAt: "2026-09-10T00:01:00.000Z" });
  });

  test("Research More creates a continuation scoped to one opportunity", async () => {
    let workspace = await started(); const executor = await import("../site-intelligence-research-executor"); const focuses: Array<string | null> = [];
    workspace = await executor.executeSiteIntelligenceResearch({ authority, provider: { providerId: "test", async execute({ executionId }) { return output(executionId); } }, actor: "owner", expectedRevision: workspace.revision });
    const result = await executor.executeSiteIntelligenceResearch({ authority, provider: { providerId: "test", async execute({ executionId, focusOpportunityId }) { focuses.push(focusOpportunityId); return output(executionId); } }, actor: "owner", expectedRevision: workspace.revision, focusOpportunityId: "o1" });
    expect(focuses).toEqual(["o1"]); expect(result.researchExecutions.at(-1)).toMatchObject({ kind: "OPPORTUNITY_CONTINUATION", focusOpportunityId: "o1" });
  });
});