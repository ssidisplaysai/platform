import { describe, expect, it, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "mocked.session.token" }),
    set: () => undefined,
    delete: () => undefined,
  }),
}), { virtual: true });

import { createGmpProject } from "@/lib/gmp/models";
import { createInMemoryGmpRepository } from "@/lib/gmp/repository";
import { createInMemoryGmpKnowledgeRepository } from "@/lib/gmp/knowledge-repository";
import { createInMemoryGmpPageRepository } from "@/lib/gmp/page-repository";
import { createInMemoryGmpContentRepository } from "@/lib/gmp/content-repository";
import { createGmpContentServices } from "@/lib/gmp/content-services";
import { buildPage } from "@/lib/gmp/page-models";
import {
  handleApproveDraft,
  handleCreateContentDraft,
  handleGenerateContentDraft,
  handleGetContentDraft,
  handleGetContentEligibility,
  handleGetDraftLineage,
  handleGetDraftPreview,
  handleListContentDrafts,
} from "@/lib/gmp/content-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const sessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });

async function seedApiContext() {
  const project = createGmpProject({ name: "Content API Project", workspaceId: "glw-led-display-warehouse", ownerActorId: "admin@example.com", slug: "content-api-project" });
  const projectRepository = createInMemoryGmpRepository({ projects: [project] });
  const knowledgeRepository = createInMemoryGmpKnowledgeRepository();
  const pageRepository = createInMemoryGmpPageRepository();
  const contentRepository = createInMemoryGmpContentRepository();
  const contentServices = createGmpContentServices({ projectRepository, knowledgeRepository, pageRepository, contentRepository });
  const site = await projectRepository.createSite({ projectId: project.projectId, displayName: "Site", primaryDomain: "example.com", environment: "production", publishingPlatform: "wordpress", publishingStatus: "CONNECTED", authenticationMethod: "token", connectionStatus: "HEALTHY", publishingCapabilities: ["draft", "publish"], defaultLanguage: "en", defaultTheme: "core" });
  await projectRepository.upsertBrandProfile({ projectId: project.projectId, companyName: "Acme", tagline: "Trusted", mission: "Mission", brandVoice: "Direct", writingStyle: "Editorial", primaryAudience: "Operators", secondaryAudience: "Buyers", primaryColor: "#000", secondaryColor: "#fff", logoReferences: [], typography: {}, assetReferences: [], socialLinks: [], contactInformation: {}, metadata: {} });
  const workspace = await knowledgeRepository.ensureWorkspace(project.projectId);
  const claim = await knowledgeRepository.createRecord({ projectId: project.projectId, knowledgeWorkspaceId: workspace.knowledgeWorkspaceId, domain: "claims", recordType: "claim", canonicalKey: "approved_claim", title: "Approved Claim", summary: "Approved claim", structuredValue: { text: "approved claim" }, normalizedValue: { text: "approved claim" }, status: "APPROVED", confidence: 90, priority: 80, effectiveFrom: null, effectiveUntil: null, sourceCount: 1, conflictState: "NONE", reviewState: "APPROVED", parentRecordId: null, supersededByRecordId: null, archivedAt: null, metadata: {} });
  const page = await pageRepository.createPage(buildPage({ projectId: project.projectId, siteId: site.siteId, actorId: "admin@example.com", pageType: "home", name: "Home", title: "Home" }));
  const brief = await pageRepository.createBrief({ projectId: project.projectId, pageId: page.pageId, status: "APPROVED", purpose: "Intro", audience: "Buyers", userNeed: "Understand offering", businessGoal: "Lead capture", primaryTopic: "LED", secondaryTopics: [], primaryKeyword: "led", secondaryKeywords: [], searchIntent: "commercial", funnelStage: "awareness", valueProposition: "Reliable", requiredClaims: [claim.canonicalKey], requiredProofPoints: ["proof"], requiredProductsOrServices: [], requiredApplications: [], requiredIndustries: [], requiredTechnicalSpecifications: [], requiredFaqs: [], restrictedMessaging: ["best-in-world"], conversionGoal: "contact", primaryCta: "Talk to Sales", secondaryCta: "Read More", competitorContext: {}, toneGuidance: "clear", evidenceRequirements: ["source-1"], knowledgeRecordReferences: [claim.knowledgeRecordId], sourceReferences: ["source-1"], approvedAt: new Date().toISOString(), approvedBy: "admin@example.com", metadata: {}, archivedAt: null });
  await pageRepository.updatePage(page.pageId, { currentBriefId: brief.briefId });
  const plan = await pageRepository.createContentPlan({ projectId: project.projectId, pageId: page.pageId, pageBriefId: brief.briefId, status: "APPROVED", planningModelVersion: "test", targetWordRange: { min: 500, max: 700 }, readingLevel: "professional", requiredSectionCount: 4, optionalSectionCount: 1, sectionOrder: ["hero", "overview", "benefits", "proof", "cta"], internalLinkRequirements: [], externalEvidenceRequirements: ["source-1"], structuredDataRequirements: [], mediaRequirements: [], ctaRequirements: ["Talk to Sales"], seoRequirements: ["primary_keyword"], accessibilityRequirements: ["semantic_headings"], approvalRequirements: ["brief_approved"], readinessScore: 90, approvedAt: new Date().toISOString(), approvedBy: "admin@example.com", archivedAt: null, metadata: {} });
  await pageRepository.updatePage(page.pageId, { currentContentPlanId: plan.contentPlanId });
  await pageRepository.replaceSectionsForPlan(plan.contentPlanId, page.pageId, project.projectId, ["hero", "overview", "benefits", "proof", "cta"].map((key, index) => ({ projectId: project.projectId, pageId: page.pageId, contentPlanId: plan.contentPlanId, parentSectionId: undefined, sectionType: key === "cta" ? "cta" : key === "proof" ? "proof" : key === "benefits" ? "benefits" : key === "hero" ? "hero" : "overview", sectionKey: key, position: index + 1, headingLevel: index === 0 ? 1 : 2, workingHeading: key.toUpperCase(), purpose: brief.purpose, audienceNeed: brief.userNeed, requiredKnowledgeRecords: [claim.knowledgeRecordId], requiredClaims: [claim.canonicalKey], requiredEvidence: ["source-1"], requiredProducts: [], requiredServices: [], requiredSpecifications: [], requiredFaqs: [], targetWordRange: { min: 50, max: 120 }, ctaType: key === "cta" ? "primary" : undefined, mediaRequirement: {}, internalLinkRequirement: {}, structuredDataContribution: {}, optional: false, status: "PLANNED", metadata: {} })));
  await pageRepository.createReadinessAssessment({ projectId: project.projectId, pageId: page.pageId, scoringModelVersion: "test", overallScore: 90, planningReadiness: 90, knowledgeReadiness: 90, seoReadiness: 90, evidenceReadiness: 90, linkingReadiness: 90, blockingIssues: [], warnings: [], recommendations: [], metadata: {} });
  return { project, page, projectRepository, knowledgeRepository, pageRepository, contentRepository, contentServices };
}

describe("gmp content api", () => {
  it("serves eligibility, draft creation, generation, preview, and lineage", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const seeded = await seedApiContext();
    const deps = { sessionLoader, ...seeded };

    const eligibility = await handleGetContentEligibility(makeRequest(`/api/gmp/pages/${seeded.page.pageId}/content/eligibility`), seeded.page.pageId, deps);
    expect(eligibility.status).toBe(200);

    const createDraft = await handleCreateContentDraft(makeRequest(`/api/gmp/pages/${seeded.page.pageId}/content/drafts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }), seeded.page.pageId, deps);
    expect(createDraft.status).toBe(201);
    const draft = (await createDraft.json() as { draft: { contentDraftId: string } }).draft;

    const listDrafts = await handleListContentDrafts(makeRequest(`/api/gmp/pages/${seeded.page.pageId}/content/drafts`), seeded.page.pageId, deps);
    expect(listDrafts.status).toBe(200);

    const generate = await handleGenerateContentDraft(makeRequest(`/api/gmp/content/drafts/${draft.contentDraftId}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }), draft.contentDraftId, deps);
    expect(generate.status).toBe(201);

    const detail = await handleGetContentDraft(makeRequest(`/api/gmp/content/drafts/${draft.contentDraftId}`), draft.contentDraftId, deps);
    expect(detail.status).toBe(200);

    const preview = await handleGetDraftPreview(makeRequest(`/api/gmp/content/drafts/${draft.contentDraftId}/preview`), draft.contentDraftId, deps);
    expect(preview.status).toBe(200);

    const lineage = await handleGetDraftLineage(makeRequest(`/api/gmp/content/drafts/${draft.contentDraftId}/lineage`), draft.contentDraftId, deps);
    expect(lineage.status).toBe(200);
  });

  it("enforces authorization and workspace isolation", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const seeded = await seedApiContext();

    const unauthorized = await handleListContentDrafts(makeRequest(`/api/gmp/pages/${seeded.page.pageId}/content/drafts`), seeded.page.pageId, { sessionLoader: async () => null, ...seeded });
    expect(unauthorized.status).toBe(401);

    const foreignProject = createGmpProject({ name: "Foreign", workspaceId: "other-workspace", ownerActorId: "admin@example.com", slug: "foreign-content-project" });
    await seeded.projectRepository.createProject(foreignProject);
    const foreignPage = await seeded.pageRepository.createPage(buildPage({ projectId: foreignProject.projectId, siteId: seeded.page.siteId, actorId: "admin@example.com", pageType: "home", name: "Foreign", title: "Foreign" }));
    const isolated = await handleGetContentEligibility(makeRequest(`/api/gmp/pages/${foreignPage.pageId}/content/eligibility`), foreignPage.pageId, { sessionLoader, ...seeded });
    expect(isolated.status).toBe(404);
  });

  it("blocks draft approval until section approvals exist", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const seeded = await seedApiContext();
    const deps = { sessionLoader, ...seeded };
    const createDraft = await handleCreateContentDraft(makeRequest(`/api/gmp/pages/${seeded.page.pageId}/content/drafts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }), seeded.page.pageId, deps);
    const draft = (await createDraft.json() as { draft: { contentDraftId: string } }).draft;
    await handleGenerateContentDraft(makeRequest(`/api/gmp/content/drafts/${draft.contentDraftId}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }), draft.contentDraftId, deps);

    const approval = await handleApproveDraft(makeRequest(`/api/gmp/content/drafts/${draft.contentDraftId}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: "approve" }) }), draft.contentDraftId, deps);
    expect(approval.status).toBe(409);
  });
});