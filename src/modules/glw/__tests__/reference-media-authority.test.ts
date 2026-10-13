jest.mock("server-only", () => ({}));

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const campaignId = "campaign-ssi-site-ssi-screen-solutions-international-ssi-accent-rear-projection-film-multi-state-benchmark";

describe("SSI Accent California media authority", () => {
  const original = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let root: string;
  beforeEach(() => { jest.resetModules(); root = mkdtempSync(join(tmpdir(), "ssi-ca-media-authority-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; });
  afterEach(() => { if (original === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR; else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = original; rmSync(root, { recursive: true, force: true }); });

  test("persists only bounded generated-media lineage and requires owner approval", async () => {
    const repository = await import("../reference-media-authority");
    const record = repository.getGlwReferenceMediaAuthority(campaignId, "CA");
    expect(record).toMatchObject({
      wordpressObjectId: "15336", wordpressMediaId: "15338", externalExecutionId: "478029",
      sourceType: "GENESIS_GENERATED_MEDIA", semanticRole: "LOCAL_CONTEXTUAL_ATMOSPHERE",
      provenanceStatus: "PROVEN_BOUNDED", ownerApprovalStatus: "REQUIRED",
      approvedBy: null, approvedSessionId: null,
    });
    expect(record?.lineageLimitations).toEqual(expect.arrayContaining([expect.stringContaining("Historical owner approval was not persisted")]));
    const evidence = JSON.parse(readFileSync(join(process.cwd(), "docs/genesis/evidence/ssi-accent-ca-media-15338-lineage-v1.json"), "utf8"));
    expect(evidence).toEqual(record);
  });

  test("approves only the exact media and lineage fingerprint with a session principal", async () => {
    const repository = await import("../reference-media-authority");
    const record = repository.getGlwReferenceMediaAuthority(campaignId, "CA")!;
    expect(() => repository.approveGlwReferenceMediaAuthority({ campaignId, stateCode: "CA", wordpressMediaId: "wrong", expectedLineageFingerprint: record.lineageFingerprint, principalId: "owner", sessionId: "session" })).toThrow("REFERENCE_MEDIA_NOT_FOUND");
    expect(() => repository.approveGlwReferenceMediaAuthority({ campaignId, stateCode: "CA", wordpressMediaId: "15338", expectedLineageFingerprint: "wrong", principalId: "owner", sessionId: "session" })).toThrow("REFERENCE_MEDIA_LINEAGE_CHANGED");
    expect(repository.approveGlwReferenceMediaAuthority({ campaignId, stateCode: "CA", wordpressMediaId: "15338", expectedLineageFingerprint: record.lineageFingerprint, principalId: "owner", sessionId: "session", now: new Date("2030-01-01") })).toMatchObject({ ownerApprovalStatus: "APPROVED", approvedBy: "owner", approvedSessionId: "session" });
  });
});