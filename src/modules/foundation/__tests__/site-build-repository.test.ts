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
    const changeRequest = { changeRequestId: "change-1", buildSessionId: "build-1", ...scope, fromRevision: 1, requestedBy: "owner", requestedAt: "now", instructions: "Emphasize quote intake.", authoritySnapshot: snapshot };
    repository.saveRevisedBuildPlan({ currentRevision: 1, proposal: revised, changeRequest, actor: "owner" });
    expect(repository.getSiteBuildRecords({ ...scope, buildSessionId: "build-1" }).plans.map((item) => item.status)).toEqual(["REVISION_REQUESTED", "PROPOSED"]);
    expect(repository.getSiteBuildRecords({ ...scope, buildSessionId: "build-1" }).changeRequests).toEqual([changeRequest]);
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

  test("persists immutable assembly revisions and explicit page/site decisions", async () => {
    const repository = await import("../site-generation-readiness-repository");
    const generatedPage = { pageRevisionId: "page-1-rev-1", pageId: "page-1", revision: 1, status: "READY_FOR_OWNER_REVIEW", requestedChanges: null, name: "Home", slug: "", canonicalPath: "/", pageRole: "HOME", seoTitle: "Home", metaDescription: "Description", openGraphTitle: "Home", openGraphDescription: "Description", h1: "Home", sections: [], contentHtml: "content", internalLinks: [], imageRequirements: [], authority: [], quality: { ready: true, blockers: [], warnings: [], checks: {} }, contentFingerprint: "hash", createdAt: "now", createdBy: "owner", decidedAt: null, decidedBy: null } as const;
    const assembly = { assemblyId: "assembly-1", buildSessionId: "build-1", ...scope, buildPlanRevision: 3, creativeRevision: 1, policyVersion: "fresh-site-page-generation-v2", revision: 1, status: "READY_FOR_OWNER_REVIEW", pages: [generatedPage], navigation: [], footerLinks: [], siteWideInstructions: null, createdAt: "now", createdBy: "owner" } as const;
    repository.saveSiteAssemblyProposal(assembly);
    expect(repository.saveSiteAssemblyProposal(assembly).assemblyId).toBe("assembly-1");
    expect(repository.decideSiteAssemblyPage({ ...scope, buildSessionId: "build-1", assemblyId: "assembly-1", pageId: "page-1", decision: "REQUEST_CHANGES", instructions: "Emphasize quote intake.", actor: "owner" }).pages[0]).toMatchObject({ status: "REVISION_REQUESTED", requestedChanges: "Emphasize quote intake." });
    const revisedPage = { ...generatedPage, pageRevisionId: "page-1-rev-2", revision: 2, contentFingerprint: "new-hash" };
    const revised = repository.replaceSiteAssemblyPageRevision({ ...scope, buildSessionId: "build-1", priorAssemblyId: "assembly-1", page: revisedPage, actor: "owner" });
    expect(revised).toMatchObject({ revision: 2, status: "READY_FOR_OWNER_REVIEW", pages: [{ pageRevisionId: "page-1-rev-2" }] });
    expect(repository.approveAllReadySiteAssemblyPages({ ...scope, buildSessionId: "build-1", assemblyId: revised.assemblyId, actor: "owner" })).toMatchObject({ status: "APPROVED", pages: [{ status: "APPROVED" }] });
    expect(repository.getSiteBuildRecords({ ...scope, buildSessionId: "build-1" }).assemblies).toHaveLength(2);
  });
});