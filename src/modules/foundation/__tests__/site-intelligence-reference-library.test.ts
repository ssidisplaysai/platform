import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CreativeInput, SiteIntelligenceBinaryAsset } from "../site-intelligence";

const scope = { organizationId: "rj-metal", siteId: "site-commercial-stainless", actor: "owner", reason: "Reference library update." };

function urlInput(inputId: string, reference: string, overrides: Partial<CreativeInput> = {}): CreativeInput {
  return { inputId, kind: "URL", reference, sentiment: "REFERENCE_ONLY", classification: "OWNER_SUPPLIED_REFERENCE", notes: null, suppliedBy: "owner", suppliedAt: "2026-09-10T00:00:00.000Z", binaryAsset: null, ...overrides };
}

function asset(inputId: string, sha256: string): CreativeInput {
  const binaryAsset: SiteIntelligenceBinaryAsset = { assetId: `site-asset-${sha256}`, sha256, originalFileName: `${inputId}.png`, mediaType: "image/png", sizeBytes: 7, uploadedAt: "2026-09-10T00:00:00.000Z", uploadedBy: "owner", organizationId: scope.organizationId, siteId: scope.siteId, providerReference: "GENESIS_SITE_INTELLIGENCE_ASSET_STORE_V1", provenance: { sourceType: "OWNER_UPLOAD", sourceReference: `${inputId}.png`, recordedAt: "2026-09-10T00:00:00.000Z" }, classification: "OWNER_SUPPLIED_REFERENCE", note: null };
  return { inputId, kind: "IMAGE", reference: binaryAsset.assetId, sentiment: "REFERENCE_ONLY", classification: "OWNER_SUPPLIED_REFERENCE", notes: null, suppliedBy: "owner", suppliedAt: "2026-09-10T00:00:00.000Z", binaryAsset };
}

describe("Site Intelligence multi-reference library", () => {
  const old = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let directory: string;
  beforeEach(() => { jest.resetModules(); directory = fs.mkdtempSync(path.join(os.tmpdir(), "site-reference-library-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = directory; });
  afterEach(() => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = old; fs.rmSync(directory, { recursive: true, force: true }); });

  async function workspace() {
    const repository = await import("../site-intelligence-repository");
    return { repository, workspace: repository.ensureSiteIntelligenceWorkspace({ ...scope, publicBrandIdentity: "Rocklin Metal" }) };
  }

  test("adds many independent normalized URLs and retains per-record metadata", async () => {
    const started = await workspace(); let current = started.workspace;
    for (let index = 1; index <= 12; index += 1) {
      current = started.repository.addCreativeInput({ ...scope, expectedRevision: current.revision, creativeInput: urlInput(`url-${index}`, `https://EXAMPLE.com/reference-${index}/#section`, { classification: index === 1 ? "COMPETITOR_REFERENCE_ONLY" : "EXTERNAL_INSPIRATION_ONLY", sentiment: index === 1 ? "LIKE" : "DISLIKE", notes: `Notes ${index}` }) });
    }
    expect(current.creativeInputs).toHaveLength(12);
    expect(current.creativeInputs[0]).toMatchObject({ reference: "https://example.com/reference-1", classification: "COMPETITOR_REFERENCE_ONLY", sentiment: "LIKE", notes: "Notes 1" });
    expect(current.creativeInputs[11]).toMatchObject({ inputId: "url-12", sentiment: "DISLIKE", notes: "Notes 12" });
  });

  test("rejects a duplicate normalized URL and points to the existing record", async () => {
    const started = await workspace();
    const current = started.repository.addCreativeInput({ ...scope, expectedRevision: started.workspace.revision, creativeInput: urlInput("url-existing", "https://example.com/catalog/#top") });
    expect(() => started.repository.addCreativeInput({ ...scope, expectedRevision: current.revision, creativeInput: urlInput("url-duplicate", "https://EXAMPLE.com/catalog/") })).toThrow("REFERENCE_ALREADY_EXISTS:url-existing");
    expect(started.repository.getSiteIntelligenceWorkspace(scope.siteId)?.creativeInputs).toHaveLength(1);
  });

  test("edits one record without replacing siblings and rejects while preserving provenance", async () => {
    const started = await workspace();
    let current = started.repository.addCreativeInput({ ...scope, expectedRevision: started.workspace.revision, creativeInput: urlInput("url-1", "https://one.example") });
    current = started.repository.addCreativeInput({ ...scope, expectedRevision: current.revision, creativeInput: urlInput("url-2", "https://two.example") });
    current = started.repository.updateCreativeInputMetadata({ ...scope, expectedRevision: current.revision, inputId: "url-1", classification: "COMPETITOR_REFERENCE_ONLY", sentiment: "LIKE", notes: "Like the navigation." });
    current = started.repository.updateCreativeInputMetadata({ ...scope, expectedRevision: current.revision, inputId: "url-1", classification: "REJECTED" });
    expect(current.creativeInputs).toHaveLength(2);
    expect(current.creativeInputs[0]).toMatchObject({ inputId: "url-1", classification: "REJECTED", sentiment: "LIKE", notes: "Like the navigation.", suppliedBy: "owner" });
    expect(current.creativeInputs[1]).toMatchObject({ inputId: "url-2", classification: "OWNER_SUPPLIED_REFERENCE" });
    expect(current.audit.at(-1)?.action).toBe("CREATIVE_INPUT_METADATA_UPDATED");
  });

  test("prevents duplicate binary authority records and edits asset metadata without re-upload", async () => {
    const started = await workspace();
    let current = started.repository.addCreativeInput({ ...scope, expectedRevision: started.workspace.revision, creativeInput: asset("asset-1", "abc123") });
    expect(() => started.repository.addCreativeInput({ ...scope, expectedRevision: current.revision, creativeInput: asset("asset-2", "abc123") })).toThrow("ASSET_ALREADY_EXISTS:asset-1");
    current = started.repository.updateCreativeInputMetadata({ ...scope, expectedRevision: current.revision, inputId: "asset-1", classification: "OWNER_APPROVED_PUBLISHABLE", sentiment: "LIKE", notes: "Approved owner photograph." });
    expect(current.creativeInputs[0]).toMatchObject({ classification: "OWNER_APPROVED_PUBLISHABLE", sentiment: "LIKE", notes: "Approved owner photograph.", binaryAsset: { classification: "OWNER_APPROVED_PUBLISHABLE", note: "Approved owner photograph." } });
  });

  test("fails closed for organization scope and stale revisions without touching research execution", async () => {
    const started = await workspace();
    let current = started.repository.startSiteIntelligence({ ...scope, expectedRevision: started.workspace.revision, providerReference: "test" });
    current = started.repository.queueSiteResearchExecution({ ...scope, expectedRevision: current.revision, providerReference: "test", kind: "INITIAL", timeoutMs: 60_000, maxAttempts: 1 });
    current = started.repository.updateSiteResearchExecution({ ...scope, expectedRevision: current.revision, executionId: current.researchExecutions[0].executionId, state: "RECOVERABLE", attemptCount: 1, errorCode: "PROVIDER_FAILED", errorMessage: "Existing failure." });
    const execution = structuredClone(current.researchExecutions[0]);
    expect(() => started.repository.updateCreativeInputMetadata({ ...scope, organizationId: "other", expectedRevision: current.revision, inputId: "missing", notes: "x" })).toThrow("ORGANIZATION_MISMATCH");
    expect(() => started.repository.addCreativeInput({ ...scope, expectedRevision: current.revision - 1, creativeInput: urlInput("url-1", "https://example.com") })).toThrow("revision conflict");
    expect(started.repository.getSiteIntelligenceWorkspace(scope.siteId)?.researchExecutions[0]).toEqual(execution);
  });
});