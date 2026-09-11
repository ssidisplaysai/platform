import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CapabilityEvidenceRelevanceType, CreativeInput, SiteIntelligenceBinaryAsset, SiteOpportunity } from "../site-intelligence";

const scope = { organizationId: "owner-org", siteId: "owner-site", actor: "owner", reason: "Capability evidence test." };

function opportunity(id: string): SiteOpportunity {
  return { opportunityId: id, name: id, category: "market", buyer: "buyer", problemUseCase: "use", commercialValue: "UNKNOWN", demandSignal: "signal", competitionLevel: "UNKNOWN", organizationFit: "UNKNOWN", evidenceStrength: "MODERATE", confidence: 0.7, geographicScope: "regional", nationalRolloutPotential: false, recurringReplacementPotential: false, seoContentOpportunity: "candidate", rationale: "reason", competitorEntities: [], evidenceIds: ["research-evidence"], capabilityState: "OWNER_VALIDATION_REQUIRED", capabilityEvidenceIds: [], capabilityNotes: null, recommendation: "review", ownerDecision: "APPROVED", decidedBy: "owner", decidedAt: "2026-09-10T00:00:00.000Z" };
}

function ownerUrl(inputId: string, classification: CreativeInput["classification"] = "OWNER_SUPPLIED_REFERENCE"): CreativeInput {
  return { inputId, kind: "URL", reference: `https://owner.example/${inputId}`, sentiment: "REFERENCE_ONLY", classification, notes: "Owner-supplied proof.", suppliedBy: "owner", suppliedAt: "2026-09-10T00:00:00.000Z", binaryAsset: null };
}

function ownerUpload(inputId: string): CreativeInput {
  const binaryAsset: SiteIntelligenceBinaryAsset = { assetId: `asset-${inputId}`, sha256: `sha-${inputId}`, originalFileName: `${inputId}.pdf`, mediaType: "application/pdf", sizeBytes: 20, uploadedAt: "2026-09-10T00:00:00.000Z", uploadedBy: "owner", organizationId: scope.organizationId, siteId: scope.siteId, providerReference: `site-intelligence-assets/${inputId}.bin`, provenance: { sourceType: "OWNER_UPLOAD", sourceReference: `${inputId}.pdf`, recordedAt: "2026-09-10T00:00:00.000Z" }, classification: "OWNER_SUPPLIED_REFERENCE", note: "Owner document" };
  return { inputId, kind: "TEXT", reference: binaryAsset.providerReference, sentiment: "REFERENCE_ONLY", classification: "OWNER_SUPPLIED_REFERENCE", notes: "Owner document", suppliedBy: "owner", suppliedAt: "2026-09-10T00:00:00.000Z", binaryAsset };
}

function relevance(evidenceId: string, relevanceType: CapabilityEvidenceRelevanceType = "DIRECT_CAPABILITY_PROOF") {
  return [{ evidenceId, relevanceType, ownerConfirmedRelevant: true }];
}

describe("typed capability evidence authority", () => {
  const old = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let directory: string;
  beforeEach(() => { jest.resetModules(); directory = fs.mkdtempSync(path.join(os.tmpdir(), "capability-evidence-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = directory; });
  afterEach(() => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = old; fs.rmSync(directory, { recursive: true, force: true }); });

  async function prepared() {
    const repository = await import("../site-intelligence-repository");
    let workspace = repository.ensureSiteIntelligenceWorkspace({ ...scope, publicBrandIdentity: "Owner Brand" });
    workspace = repository.startSiteIntelligence({ ...scope, expectedRevision: workspace.revision, providerReference: "test" });
    workspace = repository.recordSiteOpportunity({ ...scope, expectedRevision: workspace.revision, opportunity: opportunity("o1"), evidence: [{ evidenceId: "research-evidence", sourceReference: "https://research.example", sourceType: "WEB", observedClaim: "Discovery only", retrievedAt: "2026-09-10T00:00:00.000Z", entity: null, confidence: 0.7, strength: "MODERATE", authority: "OBSERVATION" }] });
    workspace = repository.recordSiteOpportunity({ ...scope, expectedRevision: workspace.revision, opportunity: opportunity("o2"), evidence: [] });
    workspace = repository.addCreativeInputs({ ...scope, expectedRevision: workspace.revision, creativeInputs: [ownerUrl("url-proof"), ownerUpload("upload-proof"), ownerUrl("external", "EXTERNAL_INSPIRATION_ONLY"), ownerUrl("rejected", "REJECTED")] });
    return { repository, workspace };
  }

  test("resolves only scoped owner evidence with provenance", async () => {
    const { repository } = await prepared();
    expect(repository.listCapabilityEvidenceOptions(scope)).toEqual(expect.arrayContaining([
      expect.objectContaining({ referenceId: "creative:url-proof", sourceType: "OWNER_URL", provenance: "Supplied by owner" }),
      expect.objectContaining({ referenceId: "creative:upload-proof", sourceType: "OWNER_UPLOAD", provenance: expect.stringContaining("OWNER_UPLOAD") }),
    ]));
  });

  test.each(["VERIFIED", "QUALIFIED"] as const)("%s requires explicit owner attestation", async (state) => {
    const { repository, workspace } = await prepared();
    expect(() => repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "o1", state, evidenceIds: ["creative:url-proof"], evidenceRelevance: relevance("creative:url-proof"), notes: state === "QUALIFIED" ? "Selected projects." : "" })).toThrow("CAPABILITY_ATTESTATION_REQUIRED");
  });

  test.each(["VERIFIED", "QUALIFIED"] as const)("%s requires capability-specific relevance", async (state) => {
    const { repository, workspace } = await prepared();
    expect(() => repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "o1", state, evidenceIds: ["creative:url-proof"], evidenceRelevance: relevance("creative:url-proof", "GENERAL_REFERENCE"), attestation: "Rocklin Metal currently provides this capability.", notes: state === "QUALIFIED" ? "Selected projects." : "" })).toThrow("CAPABILITY_SPECIFIC_RELEVANCE_REQUIRED");
  });

  test("qualified authority requires a non-empty limitation", async () => {
    const { repository, workspace } = await prepared();
    expect(() => repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "o1", state: "QUALIFIED", evidenceIds: ["creative:url-proof"], evidenceRelevance: relevance("creative:url-proof"), attestation: "Rocklin Metal provides this capability subject to the stated limits.", notes: "  " })).toThrow("CAPABILITY_QUALIFICATION_NOTES_REQUIRED");
  });

  test("one evidence record supports multiple capabilities only through independent links", async () => {
    const { repository, workspace: initial } = await prepared();
    let workspace = repository.validateOpportunityCapability({ ...scope, expectedRevision: initial.revision, opportunityId: "o1", state: "VERIFIED", evidenceIds: ["creative:url-proof"], evidenceRelevance: relevance("creative:url-proof", "PRODUCT_EXAMPLE"), attestation: "Rocklin Metal currently provides o1.", notes: "" });
    expect(() => repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "o2", state: "VERIFIED", evidenceIds: ["creative:url-proof"], evidenceRelevance: [], attestation: "Rocklin Metal currently provides o2.", notes: "" })).toThrow("CAPABILITY_SPECIFIC_RELEVANCE_REQUIRED");
    workspace = repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "o2", state: "VERIFIED", evidenceIds: ["creative:url-proof"], evidenceRelevance: relevance("creative:url-proof", "FABRICATION_EXAMPLE"), attestation: "Rocklin Metal currently provides o2.", notes: "" });
    expect(workspace.opportunities.map((item) => item.capabilityAuthorityRevisions?.at(-1)?.opportunityId)).toEqual(["o1", "o2"]);
  });

  test("compliance authority requires confirmed compliance relevance, not a general creative reference", async () => {
    const { repository, workspace: initial } = await prepared();
    let workspace = repository.recordSiteOpportunity({ ...scope, expectedRevision: initial.revision, opportunity: opportunity("compliance"), evidence: [{ evidenceId: "owner-compliance", sourceReference: "owner-record://compliance", sourceType: "CONNECTED_SOURCE", observedClaim: "Owner compliance record.", retrievedAt: "2026-09-10T00:00:00.000Z", entity: "Compliance record", confidence: 1, strength: "STRONG", authority: "OWNER_SUPPLIED_AUTHORITY" }] });
    expect(() => repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "compliance", state: "VERIFIED", evidenceIds: ["creative:url-proof"], evidenceRelevance: relevance("creative:url-proof", "GENERAL_REFERENCE"), attestation: "Current compliance capability.", notes: "" })).toThrow("CAPABILITY_SPECIFIC_RELEVANCE_REQUIRED");
    workspace = repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "compliance", state: "VERIFIED", evidenceIds: ["evidence:owner-compliance"], evidenceRelevance: relevance("evidence:owner-compliance", "SPECIFICATION_OR_COMPLIANCE_EVIDENCE"), attestation: "Current compliance capability.", notes: "" });
    expect(workspace.opportunities.at(-1)?.capabilityState).toBe("VERIFIED");
  });

  test("invalid, discovery, rejected, and cross-site evidence fail closed", async () => {
    const { repository, workspace } = await prepared();
    for (const referenceId of ["creative:missing", "evidence:research-evidence", "creative:external", "creative:rejected"]) expect(() => repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "o1", state: "VERIFIED", evidenceIds: [referenceId], evidenceRelevance: relevance(referenceId), attestation: "Current capability.", notes: "" })).toThrow();
    let other = repository.ensureSiteIntelligenceWorkspace({ organizationId: scope.organizationId, siteId: "other-site", publicBrandIdentity: "Other", actor: "owner" });
    other = repository.addCreativeInput({ organizationId: scope.organizationId, siteId: "other-site", expectedRevision: other.revision, actor: "owner", reason: "test", creativeInput: ownerUrl("other-proof") });
    expect(other.creativeInputs).toHaveLength(1);
    expect(() => repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "o1", state: "VERIFIED", evidenceIds: ["creative:other-proof"], evidenceRelevance: relevance("creative:other-proof"), attestation: "Current capability.", notes: "" })).toThrow("CAPABILITY_EVIDENCE_SCOPE_MISMATCH");
  });

  test("future intent requires attestation but not current proof", async () => {
    const { repository, workspace } = await prepared();
    expect(() => repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "o1", state: "FUTURE_CAPABILITY", evidenceIds: [], notes: "" })).toThrow("CAPABILITY_ATTESTATION_REQUIRED");
    const future = repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "o1", state: "FUTURE_CAPABILITY", evidenceIds: [], attestation: "Rocklin Metal intends to develop this capability.", notes: "" });
    expect(future.opportunities[0]).toMatchObject({ capabilityState: "FUTURE_CAPABILITY", capabilityEvidenceIds: [] });
  });

  test("return to owner review preserves and supersedes prior authority history", async () => {
    const { repository, workspace: initial } = await prepared();
    let workspace = repository.validateOpportunityCapability({ ...scope, expectedRevision: initial.revision, opportunityId: "o1", state: "VERIFIED", evidenceIds: ["creative:upload-proof"], evidenceRelevance: relevance("creative:upload-proof", "PROJECT_EXAMPLE"), attestation: "Rocklin Metal currently provides o1.", notes: "" });
    workspace = repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "o1", state: "OWNER_VALIDATION_REQUIRED", evidenceIds: [], notes: "Prior authority withdrawn for review." });
    const current = workspace.opportunities[0];
    expect(current.capabilityState).toBe("OWNER_VALIDATION_REQUIRED");
    expect(current.capabilityAuthorityRevisions).toHaveLength(2);
    expect(current.capabilityAuthorityRevisions?.[0]).toMatchObject({ decision: "VERIFIED", evidenceIds: ["creative:upload-proof"] });
    expect(current.capabilityAuthorityRevisions?.[1]).toMatchObject({ decision: "OWNER_VALIDATION_REQUIRED", evidenceIds: ["creative:upload-proof"] });
    expect(workspace.audit.at(-1)?.action).toBe("CAPABILITY_OWNER_VALIDATION_REQUIRED");
  });

  test("legacy verified authority is review-required and ineligible for current claims", async () => {
    const { getCapabilityAuthorityStatus, hasVerifiedCapability } = await import("../site-intelligence");
    const legacy = { ...opportunity("legacy"), capabilityState: "VERIFIED" as const, capabilityEvidenceIds: ["creative:url-proof"] };
    expect(getCapabilityAuthorityStatus(legacy)).toBe("AUTHORITY_REVIEW_REQUIRED");
    expect(hasVerifiedCapability(legacy)).toBe(false);
  });
});