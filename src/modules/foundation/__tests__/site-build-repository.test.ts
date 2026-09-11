import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SiteBuildPlanProposal } from "../site-build-plan";

const scope = { organizationId: "org", siteId: "site" };
const snapshot = { strategyRevision: 8, creativeRevision: 1, marketFingerprint: "market", capabilityFingerprint: "capability", productServiceFingerprint: "product", sourcesFingerprint: "sources", generationPolicyVersion: "site-draft-generation-v1" };
const certification = { certificationId: "cert-1", revision: 1, ...scope, certifiedAt: "now", certifiedBy: "owner", ...snapshot };
function plan(revision = 1): SiteBuildPlanProposal { return { buildSessionId: "build-1", ...scope, revision, status: "PROPOSED", ownerInstructions: null, pages: [{ pageId: "p1", name: "Home", slug: "", pageType: "HOME", purpose: "Introduce approved offerings.", primaryAudience: "Buyers", launchPhase: "INITIAL", authority: [{ kind: "SITE", referenceId: "site", label: "Site" }] }], authoritySnapshot: snapshot, buildPolicyVersion: "bounded-fresh-site-build-v1", createdBy: "owner", createdAt: "now", decidedBy: null, decidedAt: null }; }

describe("bounded Site Build repository", () => {
  const prior = process.env.GCP_FOUNDATION_PERSISTENCE_DIR; let directory: string;
  beforeEach(() => { jest.resetModules(); directory = fs.mkdtempSync(path.join(os.tmpdir(), "site-build-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = directory; });
  afterEach(() => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = prior; fs.rmSync(directory, { recursive: true, force: true }); });

  test("START SITE BUILD is idempotent across repeated current certifications", async () => {
    const repository = await import("../site-generation-readiness-repository");
    const first = repository.startSiteBuild({ ...scope, actor: "owner", certification });
    const second = repository.startSiteBuild({ ...scope, actor: "owner", certification: { ...certification, certificationId: "cert-2", revision: 2 } });
    expect(second.buildSessionId).toBe(first.buildSessionId);
    expect(repository.listActiveSiteBuildSessions(scope)).toHaveLength(1);
  });

  test("preserves build-plan revisions and requires explicit plan and draft approvals", async () => {
    const repository = await import("../site-generation-readiness-repository");
    repository.saveBuildPlanProposal(plan());
    const revised = { ...plan(2), ownerInstructions: "Emphasize quote intake." };
    repository.saveRevisedBuildPlan({ currentRevision: 1, proposal: revised, actor: "owner", instructions: "Emphasize quote intake." });
    expect(repository.getSiteBuildRecords({ ...scope, buildSessionId: "build-1" }).plans.map((item) => item.status)).toEqual(["REVISION_REQUESTED", "PROPOSED"]);
    expect(() => repository.generateSiteBuildDrafts({ plan: revised, actor: "owner" })).toThrow("APPROVED_BUILD_PLAN_REQUIRED");
    const approved = repository.decideBuildPlan({ ...scope, buildSessionId: "build-1", revision: 2, decision: "APPROVE", actor: "owner", reason: "Approved." });
    approved.pages[0].name = "Home <script>";
    const drafts = repository.generateSiteBuildDrafts({ plan: approved, actor: "owner" });
    expect(drafts).toMatchObject({ status: "GENERATED", buildPlanRevision: 2 });
    expect(drafts.drafts[0].contentHtml).toContain("Home &lt;script&gt;");
    expect(repository.generateSiteBuildDrafts({ plan: approved, actor: "owner" }).draftSetId).toBe(drafts.draftSetId);
    expect(repository.approveSiteBuildDrafts({ ...scope, buildSessionId: "build-1", draftSetId: drafts.draftSetId, actor: "owner" }).status).toBe("APPROVED");
  });

  test("WordPress draft receipts are idempotent and build operations do not touch unrelated stores", async () => {
    const repository = await import("../site-generation-readiness-repository");
    const receipt = { buildSessionId: "build-1", draftId: "draft-1", wordpressObjectId: "100", wordpressUrl: "https://example.com/?page_id=100", wordpressStatus: "draft" as const, createdAt: "now" };
    expect(repository.recordSiteBuildWordPressDraft(receipt)).toEqual(receipt);
    expect(repository.recordSiteBuildWordPressDraft({ ...receipt, wordpressObjectId: "200" })).toEqual(receipt);
    for (const name of ["site-repository.json", "site-intelligence-repository.json", "site-product-authority-repository.json", "product-repository.json", "glw-campaign-repository.json", "glw-page-execution-repository.json"]) expect(fs.existsSync(path.join(directory, name))).toBe(false);
  });
});