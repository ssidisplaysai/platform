import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("site visual assembly repository", () => {
  const prior = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let directory: string;

  beforeEach(() => {
    jest.resetModules();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "visual-assembly-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = directory;
  });

  afterEach(() => {
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = prior;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test("preserves approved history when creating an owner-requested revision", async () => {
    const repository = await import("../site-visual-assembly-repository");
    const input = {
      organizationId: "org", siteId: "site", buildSessionId: "build", pageId: "home", pageRevisionId: "home-r5",
      status: "READY_FOR_OWNER_REVIEW" as const, referenceAssetId: "reference", referenceClassification: "OWNER_SUPPLIED_REFERENCE" as const,
      referencePublished: false as const, imageCandidateId: "candidate", imageCandidateRevision: 1, imageProvenance: "GENERATED_VISUAL" as const,
      imageSha256: "hash", wordpressObjectId: "10", wordpressMediaId: "30", wordpressMediaUrl: "https://example.test/media.jpg",
      wordpressStatus: "draft" as const, contentHtml: "<h1>Home</h1>", designSystemVersion: "commercial-stainless-visual-v1" as const,
      ownerInstructions: null, createdBy: "owner",
    };
    const first = repository.saveSiteVisualAssembly(input);
    expect(repository.saveSiteVisualAssembly(input).assemblyId).toBe(first.assemblyId);
    const approved = repository.decideSiteVisualAssembly({ organizationId: "org", siteId: "site", buildSessionId: "build", assemblyId: first.assemblyId, decision: "APPROVE", actor: "owner" });
    const revised = repository.saveSiteVisualAssembly({ ...input, contentHtml: "<h1>Refined Home</h1>", ownerInstructions: "Reduce hero scale." });
    expect(revised).toMatchObject({ revision: 2, status: "READY_FOR_OWNER_REVIEW", wordpressMediaId: "30" });
    expect(repository.listSiteVisualAssemblies({ organizationId: "org", siteId: "site", buildSessionId: "build" }).map((item) => ({ revision: item.revision, status: item.status, contentSha256: item.contentSha256 }))).toEqual([
      { revision: 1, status: "APPROVED", contentSha256: approved.contentSha256 },
      { revision: 2, status: "READY_FOR_OWNER_REVIEW", contentSha256: revised.contentSha256 },
    ]);
  });
});
