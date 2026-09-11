import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

describe("site intelligence API boundary", () => {
  const oldDir = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let dir: string;

  beforeEach(() => {
    jest.resetModules();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "site-intelligence-api-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = dir;
  });

  afterEach(() => {
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = oldDir;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function request(method = "GET", organizationId = "led-display-warehouse", body?: unknown) {
    return new NextRequest("http://localhost/api/sites/site-led-display-warehouse-production/intelligence", {
      method,
      headers: {
        "content-type": "application/json",
        "x-gcp-roles": "ops_manager",
        "x-gcp-organization-id": organizationId,
        "x-gcp-site-id": "site-led-display-warehouse-production",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  const context = { params: Promise.resolve({ siteId: "site-led-display-warehouse-production" }) };

  test("GET exposes the start boundary without creating persistence", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const response = await route.GET(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ workspace: null, startBoundary: "START_SITE_INTELLIGENCE" });
    expect(fs.existsSync(path.join(dir, "site-intelligence-repository.json"))).toBe(false);
  });

  test("explicit START fails closed without a configured dedicated provider", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const response = await route.POST(request("POST", "led-display-warehouse", { action: "START", expectedRevision: 0, publicBrandIdentity: "Test Brand", providerReference: "provider-test" }), context);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("SITE_INTELLIGENCE_PROVIDER_NOT_CONFIGURED");
    expect(fs.existsSync(path.join(dir, "site-intelligence-repository.json"))).toBe(false);
  });

  test("workspace organization mismatch cannot access another site", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const response = await route.GET(request("GET", "rj-metal"), context);
    expect(response.status).toBe(404);
  });

  test("adds multiple URL references and updates one independently", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const first = await route.POST(request("POST", "led-display-warehouse", { action: "ADD_URL_REFERENCE", expectedRevision: 0, reference: "https://example.com/one/", classification: "COMPETITOR_REFERENCE_ONLY", sentiment: "LIKE", notes: "One" }), context);
    const firstBody = await first.json();
    const second = await route.POST(request("POST", "led-display-warehouse", { action: "ADD_URL_REFERENCE", expectedRevision: firstBody.workspace.revision, reference: "https://example.com/two", classification: "EXTERNAL_INSPIRATION_ONLY", sentiment: "DISLIKE", notes: "Two" }), context);
    const secondBody = await second.json();
    expect(secondBody.workspace.creativeInputs).toHaveLength(2);
    const updated = await route.POST(request("POST", "led-display-warehouse", { action: "UPDATE_CREATIVE_INPUT", expectedRevision: secondBody.workspace.revision, inputId: secondBody.workspace.creativeInputs[0].inputId, sentiment: "REFERENCE_ONLY", notes: "Updated" }), context);
    const updatedBody = await updated.json();
    expect(updatedBody.workspace.creativeInputs).toHaveLength(2);
    expect(updatedBody.workspace.creativeInputs[0]).toMatchObject({ sentiment: "REFERENCE_ONLY", notes: "Updated" });
    expect(updatedBody.workspace.creativeInputs[1]).toMatchObject({ sentiment: "DISLIKE", notes: "Two" });
  });

  test("returns deterministic duplicate URL error", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const first = await route.POST(request("POST", "led-display-warehouse", { action: "ADD_URL_REFERENCE", expectedRevision: 0, reference: "https://example.com/path/#one", classification: "OWNER_SUPPLIED_REFERENCE", sentiment: "REFERENCE_ONLY" }), context);
    const firstBody = await first.json();
    const duplicate = await route.POST(request("POST", "led-display-warehouse", { action: "ADD_URL_REFERENCE", expectedRevision: firstBody.workspace.revision, reference: "https://EXAMPLE.com/path/", classification: "OWNER_SUPPLIED_REFERENCE", sentiment: "REFERENCE_ONLY" }), context);
    expect(duplicate.status).toBe(422);
    expect((await duplicate.json()).error).toMatch(/^REFERENCE_ALREADY_EXISTS:/);
  });

  test("market approval persists through the API without verifying capability", async () => {
    const repository = await import("../site-intelligence-repository");
    let workspace = repository.ensureSiteIntelligenceWorkspace({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", publicBrandIdentity: "LED Display Warehouse", actor: "owner" });
    workspace = repository.startSiteIntelligence({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", expectedRevision: workspace.revision, actor: "owner", reason: "test", providerReference: "test" });
    workspace = repository.recordSiteOpportunity({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", expectedRevision: workspace.revision, actor: "owner", reason: "test", evidence: [{ evidenceId: "e1", sourceReference: "https://example.com", sourceType: "WEB", observedClaim: "Observed", retrievedAt: "2026-09-10T00:00:00.000Z", entity: null, confidence: 0.7, strength: "MODERATE", authority: "OBSERVATION" }], opportunity: { opportunityId: "o1", name: "Opportunity", category: "market", buyer: "buyer", problemUseCase: "use", commercialValue: "UNKNOWN", demandSignal: "signal", competitionLevel: "UNKNOWN", organizationFit: "UNKNOWN", evidenceStrength: "MODERATE", confidence: 0.7, geographicScope: "unknown", nationalRolloutPotential: false, recurringReplacementPotential: false, seoContentOpportunity: "candidate", rationale: "reason", competitorEntities: [], evidenceIds: ["e1"], capabilityState: "OWNER_VALIDATION_REQUIRED", capabilityEvidenceIds: [], capabilityNotes: null, recommendation: "review", ownerDecision: "PENDING", decidedBy: null, decidedAt: null } });
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const response = await route.POST(request("POST", "led-display-warehouse", { action: "DECIDE_OPPORTUNITY", expectedRevision: workspace.revision, opportunityId: "o1", decision: "APPROVED", actor: "site-owner" }), context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.workspace.opportunities).toHaveLength(1);
    expect(body.workspace.opportunities[0]).toMatchObject({ ownerDecision: "APPROVED", decidedBy: "site-owner", capabilityState: "OWNER_VALIDATION_REQUIRED", capabilityEvidenceIds: [] });
  });

  test("capability verification fails visibly without owner attestation at the API boundary", async () => {
    const repository = await import("../site-intelligence-repository");
    let workspace = repository.ensureSiteIntelligenceWorkspace({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", publicBrandIdentity: "LED Display Warehouse", actor: "owner" });
    workspace = repository.startSiteIntelligence({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", expectedRevision: workspace.revision, actor: "owner", reason: "test", providerReference: "test" });
    workspace = repository.recordSiteOpportunity({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", expectedRevision: workspace.revision, actor: "owner", reason: "test", evidence: [{ evidenceId: "e1", sourceReference: "https://example.com", sourceType: "WEB", observedClaim: "Observed", retrievedAt: "2026-09-10T00:00:00.000Z", entity: null, confidence: 0.7, strength: "MODERATE", authority: "OBSERVATION" }], opportunity: { opportunityId: "o1", name: "Opportunity", category: "market", buyer: "buyer", problemUseCase: "use", commercialValue: "UNKNOWN", demandSignal: "signal", competitionLevel: "UNKNOWN", organizationFit: "UNKNOWN", evidenceStrength: "MODERATE", confidence: 0.7, geographicScope: "unknown", nationalRolloutPotential: false, recurringReplacementPotential: false, seoContentOpportunity: "candidate", rationale: "reason", competitorEntities: [], evidenceIds: ["e1"], capabilityState: "OWNER_VALIDATION_REQUIRED", capabilityEvidenceIds: [], capabilityNotes: null, recommendation: "review", ownerDecision: "PENDING", decidedBy: null, decidedAt: null } });
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const response = await route.POST(request("POST", "led-display-warehouse", { action: "VALIDATE_CAPABILITY", expectedRevision: workspace.revision, opportunityId: "o1", state: "VERIFIED", evidenceIds: [], notes: "Missing evidence" }), context);
    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("CAPABILITY_ATTESTATION_REQUIRED");
    expect(repository.getSiteIntelligenceWorkspace("site-led-display-warehouse-production")?.opportunities[0]).toMatchObject({ ownerDecision: "PENDING", capabilityState: "OWNER_VALIDATION_REQUIRED" });
  });

  test("ordinary owner-attested capability saves through scoped API without independent evidence", async () => {
    const repository = await import("../site-intelligence-repository");
    let workspace = repository.ensureSiteIntelligenceWorkspace({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", publicBrandIdentity: "LED Display Warehouse", actor: "owner" });
    workspace = repository.startSiteIntelligence({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", expectedRevision: workspace.revision, actor: "owner", reason: "test", providerReference: "test" });
    workspace = repository.recordSiteOpportunity({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", expectedRevision: workspace.revision, actor: "owner", reason: "test", evidence: [], opportunity: { opportunityId: "ordinary-capability", name: "Commercial stainless worktables", category: "fabrication", buyer: "commercial buyer", problemUseCase: "worktable fabrication", commercialValue: "HIGH", demandSignal: "signal", competitionLevel: "UNKNOWN", organizationFit: "HIGH", evidenceStrength: "MODERATE", confidence: 0.8, geographicScope: "regional", nationalRolloutPotential: false, recurringReplacementPotential: false, seoContentOpportunity: "candidate", rationale: "Ordinary operational capability.", competitorEntities: [], evidenceIds: [], capabilityState: "OWNER_VALIDATION_REQUIRED", capabilityEvidenceIds: [], capabilityNotes: null, recommendation: "review", ownerDecision: "APPROVED", decidedBy: "owner", decidedAt: "2026-09-10T00:01:00.000Z" } });
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const response = await route.POST(request("POST", "led-display-warehouse", { action: "VALIDATE_CAPABILITY", expectedRevision: workspace.revision, opportunityId: "ordinary-capability", state: "VERIFIED", evidenceIds: [], evidenceRelevance: [], attestation: "LED Display Warehouse currently fabricates commercial stainless worktables.", actor: "site-owner" }), context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.workspace.opportunities[0]).toMatchObject({ ownerDecision: "APPROVED", capabilityState: "VERIFIED", capabilityEvidenceIds: [], capabilityAuthorityRevisions: [expect.objectContaining({ authorityBasis: "OWNER_ATTESTATION", evidenceIds: [] })] });
  });

  test("approved generated strategy enables one unapproved assisted Creative Direction revision", async () => {
    const repository = await import("../site-intelligence-repository");
    let workspace = repository.ensureSiteIntelligenceWorkspace({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", publicBrandIdentity: "LED Display Warehouse", actor: "owner" });
    workspace = repository.startSiteIntelligence({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", expectedRevision: workspace.revision, actor: "owner", reason: "test", providerReference: "test" });
    workspace = repository.recordSiteOpportunity({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", expectedRevision: workspace.revision, actor: "owner", reason: "test", evidence: [{ evidenceId: "e1", sourceReference: "https://example.com", sourceType: "WEB", observedClaim: "Observed", retrievedAt: "2026-09-10T00:00:00.000Z", entity: null, confidence: 0.7, strength: "MODERATE", authority: "OBSERVATION" }], opportunity: { opportunityId: "o1", name: "Opportunity", category: "market", buyer: "buyer", problemUseCase: "use", commercialValue: "UNKNOWN", demandSignal: "signal", competitionLevel: "UNKNOWN", organizationFit: "UNKNOWN", evidenceStrength: "MODERATE", confidence: 0.7, geographicScope: "unknown", nationalRolloutPotential: false, recurringReplacementPotential: false, seoContentOpportunity: "candidate", rationale: "reason", competitorEntities: [], evidenceIds: ["e1"], capabilityState: "OWNER_VALIDATION_REQUIRED", capabilityEvidenceIds: [], capabilityNotes: null, recommendation: "review", ownerDecision: "APPROVED", decidedBy: "owner", decidedAt: "2026-09-10T00:01:00.000Z" } });
    workspace = repository.approveSiteIntelligence({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", expectedRevision: workspace.revision, actor: "owner", reason: "test" });
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const response = await route.POST(request("POST", "led-display-warehouse", { action: "GENERATE_STRATEGY", expectedRevision: workspace.revision, actor: "site-owner" }), context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.workspace.strategyState).toBe("STRATEGY_READY_FOR_REVIEW");
    expect(body.workspace.strategyRevisions).toHaveLength(1);
    expect(body.workspace.strategyRevisions[0]).toMatchObject({ status: "PROPOSED", decidedBy: null, decidedAt: null });
    expect(body.workspace.creativeState).toBe("CREATIVE_NOT_STARTED");
    const approval = await route.POST(request("POST", "led-display-warehouse", { action: "DECIDE_STRATEGY", expectedRevision: body.workspace.revision, decision: "APPROVED", actor: "site-owner" }), context);
    const approvedBody = await approval.json();
    expect(approvedBody.workspace.strategyState).toBe("STRATEGY_APPROVED");
    const creative = await route.POST(request("POST", "led-display-warehouse", { action: "GENERATE_CREATIVE_DIRECTION", expectedRevision: approvedBody.workspace.revision, ownerInstruction: "Keep it industrial and premium.", actor: "site-owner" }), context);
    const creativeBody = await creative.json();
    expect(creative.status).toBe(200);
    expect(creativeBody.workspace.creativeState).toBe("CREATIVE_READY_FOR_REVIEW");
    expect(creativeBody.workspace.creativeRevisions).toHaveLength(1);
    expect(creativeBody.workspace.creativeRevisions[0]).toMatchObject({ revision: 1, strategyRevision: 1, status: "PROPOSED", decidedBy: null, decidedAt: null });
  });
});