import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CreativeInput, SiteIntelligenceBinaryAsset, SiteOpportunity } from "../site-intelligence";

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

  test("resolves scoped owner URL and upload evidence with provenance", async () => {
    const { repository } = await prepared();
    expect(repository.listCapabilityEvidenceOptions(scope)).toEqual(expect.arrayContaining([
      expect.objectContaining({ referenceId: "creative:url-proof", sourceType: "OWNER_URL", provenance: "Supplied by owner" }),
      expect.objectContaining({ referenceId: "creative:upload-proof", sourceType: "OWNER_UPLOAD", provenance: expect.stringContaining("OWNER_UPLOAD") }),
    ]));
  });

  test("supports explicit owner-supplied authority evidence but not provider discovery", async () => {
    const { repository, workspace: initial } = await prepared();
    const workspace = repository.recordSiteOpportunity({ ...scope, expectedRevision: initial.revision, opportunity: opportunity("o3"), evidence: [{ evidenceId: "owner-authority", sourceReference: "owner-record://capability", sourceType: "CONNECTED_SOURCE", observedClaim: "Owner confirmed current capability.", retrievedAt: "2026-09-10T00:00:00.000Z", entity: "Owner authority", confidence: 1, strength: "STRONG", authority: "OWNER_SUPPLIED_AUTHORITY" }] });
    expect(repository.listCapabilityEvidenceOptions(scope)).toEqual(expect.arrayContaining([expect.objectContaining({ referenceId: "evidence:owner-authority", sourceType: "OWNER_SUPPLIED_AUTHORITY" })]));
    const verified = repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "o3", state: "VERIFIED", evidenceIds: ["evidence:owner-authority"], notes: "Owner confirmed." });
    expect(verified.opportunities.find((item) => item.opportunityId === "o3")).toMatchObject({ capabilityState: "VERIFIED", capabilityEvidenceIds: ["evidence:owner-authority"] });
  });

  test.each([
    ["creative:missing", "CAPABILITY_EVIDENCE_NOT_FOUND"],
    ["evidence:research-evidence", "CAPABILITY_EVIDENCE_TYPE_NOT_ALLOWED"],
    ["creative:external", "CAPABILITY_EVIDENCE_TYPE_NOT_ALLOWED"],
    ["creative:rejected", "CAPABILITY_EVIDENCE_REJECTED"],
  ])("rejects invalid evidence reference %s", async (referenceId, error) => {
    const { repository, workspace } = await prepared();
    expect(() => repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "o1", state: "VERIFIED", evidenceIds: [referenceId], notes: "Owner confirms." })).toThrow(error);
  });

  test("rejects cross-organization and cross-site evidence", async () => {
    const { repository, workspace } = await prepared();
    expect(() => repository.resolveCapabilityEvidenceReferences({ ...scope, organizationId: "other", referenceIds: ["creative:url-proof"] })).toThrow("CAPABILITY_EVIDENCE_SCOPE_MISMATCH");
    let other = repository.ensureSiteIntelligenceWorkspace({ organizationId: scope.organizationId, siteId: "other-site", publicBrandIdentity: "Other", actor: "owner" });
    other = repository.addCreativeInput({ organizationId: scope.organizationId, siteId: "other-site", expectedRevision: other.revision, actor: "owner", reason: "test", creativeInput: ownerUrl("other-proof") });
    expect(other.creativeInputs).toHaveLength(1);
    expect(() => repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "o1", state: "VERIFIED", evidenceIds: ["creative:other-proof"], notes: "Owner confirms." })).toThrow("CAPABILITY_EVIDENCE_SCOPE_MISMATCH");
  });

  test("valid evidence supports verified and qualified capabilities independently and can be reused", async () => {
    const { repository, workspace: initial } = await prepared();
    let workspace = repository.validateOpportunityCapability({ ...scope, expectedRevision: initial.revision, opportunityId: "o1", state: "VERIFIED", evidenceIds: ["creative:url-proof", "creative:upload-proof"], notes: "Currently provided." });
    workspace = repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "o2", state: "QUALIFIED", evidenceIds: ["creative:url-proof"], notes: "Available on project review." });
    expect(workspace.opportunities[0]).toMatchObject({ capabilityState: "VERIFIED", capabilityEvidenceIds: ["creative:url-proof", "creative:upload-proof"] });
    expect(workspace.opportunities[1]).toMatchObject({ capabilityState: "QUALIFIED", capabilityEvidenceIds: ["creative:url-proof"], capabilityNotes: "Available on project review." });
  });

  test("owner notes alone never substitute for evidence", async () => {
    const { repository, workspace } = await prepared();
    expect(() => repository.validateOpportunityCapability({ ...scope, expectedRevision: workspace.revision, opportunityId: "o1", state: "QUALIFIED", evidenceIds: [], notes: "Owner confirms." })).toThrow("CAPABILITY_EVIDENCE_REQUIRED");
  });
});
