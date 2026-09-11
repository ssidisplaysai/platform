import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("site page image candidate repository", () => {
  const prior = process.env.GCP_FOUNDATION_PERSISTENCE_DIR; let directory: string;
  beforeEach(() => { jest.resetModules(); directory = fs.mkdtempSync(path.join(os.tmpdir(), "page-image-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = directory; });
  afterEach(() => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = prior; fs.rmSync(directory, { recursive: true, force: true }); });
  const scope = { organizationId: "org", siteId: "site", buildSessionId: "build", pageId: "home", pageRevisionId: "home-r5", slotId: "home-hero", mimeType: "image/jpeg" as const, visualBrief: "Editorial commercial stainless scene", creativeRevision: 1, authorityReferences: ["strategy-8", "offering-1"], actor: "owner" };
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]);

  test("stores local candidate bytes with immutable revision lineage and scope", async () => {
    const repository = await import("../site-page-image-candidate-repository");
    const first = repository.saveSitePageImageCandidate({ ...scope, sourceType: "GENERATED_VISUAL", bytes: jpeg, generationPrompt: "prompt" });
    const second = repository.saveSitePageImageCandidate({ ...scope, sourceType: "GENERATED_VISUAL", bytes: Buffer.concat([jpeg, Buffer.from([2])]), generationPrompt: "revised", ownerInstructions: "Brighter" });
    expect(second).toMatchObject({ revision: 2, priorCandidateId: first.candidateId, status: "READY_FOR_OWNER_REVIEW", generationBasis: { referenceOnlyInputsUsed: false, competitorInputsUsed: false } });
    expect(repository.listSitePageImageCandidates({ organizationId: "org", siteId: "site", buildSessionId: "build" })).toHaveLength(2);
    expect(repository.listSitePageImageCandidates({ organizationId: "other", siteId: "site", buildSessionId: "build" })).toEqual([]);
    expect(repository.readSitePageImageCandidateBytes({ organizationId: "org", siteId: "site", candidateId: second.candidateId })?.bytes).toEqual(Buffer.concat([jpeg, Buffer.from([2])]));
  });

  test("requires explicit owner decision and preserves rejected history", async () => {
    const repository = await import("../site-page-image-candidate-repository"); const first = repository.saveSitePageImageCandidate({ ...scope, sourceType: "GENERATED_VISUAL", bytes: jpeg });
    expect(repository.decideSitePageImageCandidate({ organizationId: "org", siteId: "site", buildSessionId: "build", candidateId: first.candidateId, decision: "REJECT", actor: "owner" })).toMatchObject({ status: "REJECTED", decidedBy: "owner" });
    expect(() => repository.decideSitePageImageCandidate({ organizationId: "org", siteId: "site", buildSessionId: "build", candidateId: first.candidateId, decision: "APPROVE", actor: "owner" })).toThrow("IMAGE_CANDIDATE_NOT_REVIEWABLE");
  });
});