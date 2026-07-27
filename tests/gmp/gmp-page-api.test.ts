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
import { createInMemoryGmpPageRepository } from "@/lib/gmp/page-repository";
import { createInMemoryGmpKnowledgeRepository } from "@/lib/gmp/knowledge-repository";
import { createGmpPageServices } from "@/lib/gmp/page-services";
import {
  handleCreatePage,
  handleGeneratePagePlan,
  handleGetPage,
  handleGetInternalLinkHealth,
  handleGetProjectPageArchitectureHealth,
  handleGetRelationshipHealth,
  handleGetPagePlan,
  handleGetPageReadiness,
  handleListPages,
  handleRunInternalLinkScan,
  handleRunProjectPageArchitectureScan,
  handleRunRelationshipScan,
  handleRunPageReadiness,
} from "@/lib/gmp/page-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const sessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });

describe("gmp page api", () => {
  it("creates and lists pages with project workspace isolation", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const project = createGmpProject({
      name: "Page API Project",
      workspaceId: "glw-led-display-warehouse",
      ownerActorId: "admin@example.com",
      slug: "page-api-project",
    });

    const projectRepository = createInMemoryGmpRepository({ projects: [project] });
    const pageRepository = createInMemoryGmpPageRepository();
    const knowledgeRepository = createInMemoryGmpKnowledgeRepository();
    const pageServices = createGmpPageServices({ pageRepository, knowledgeRepository });

    const site = await projectRepository.createSite({
      projectId: project.projectId,
      displayName: "Site",
      primaryDomain: "example.com",
      environment: "production",
      publishingPlatform: "wordpress",
      publishingStatus: "CONNECTED",
      authenticationMethod: "token",
      connectionStatus: "HEALTHY",
      publishingCapabilities: ["draft", "publish"],
      defaultLanguage: "en",
      defaultTheme: "core",
    });

    const createResponse = await handleCreatePage(
      makeRequest(`/api/gmp/projects/${project.projectId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.siteId,
          pageType: "product",
          name: "LED Controller",
          title: "LED Controller",
        }),
      }),
      project.projectId,
      { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices },
    );

    expect(createResponse.status).toBe(201);

    const listResponse = await handleListPages(
      makeRequest(`/api/gmp/projects/${project.projectId}/pages`),
      project.projectId,
      { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices },
    );

    expect(listResponse.status).toBe(200);
    const payload = await listResponse.json() as { pages: Array<{ pageId: string }> };
    expect(payload.pages.length).toBe(1);

    const isolatedProject = createGmpProject({
      name: "Other Workspace Project",
      workspaceId: "workspace-2",
      ownerActorId: "admin@example.com",
      slug: "other-workspace-project",
    });
    await projectRepository.createProject(isolatedProject);

    const isolatedList = await handleListPages(
      makeRequest(`/api/gmp/projects/${isolatedProject.projectId}/pages`),
      isolatedProject.projectId,
      { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices },
    );

    expect(isolatedList.status).toBe(404);
  });

  it("generates plans and readiness for a page", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const project = createGmpProject({
      name: "Page Plan API Project",
      workspaceId: "glw-led-display-warehouse",
      ownerActorId: "admin@example.com",
      slug: "page-plan-api-project",
    });

    const projectRepository = createInMemoryGmpRepository({ projects: [project] });
    const pageRepository = createInMemoryGmpPageRepository();
    const knowledgeRepository = createInMemoryGmpKnowledgeRepository();
    const pageServices = createGmpPageServices({ pageRepository, knowledgeRepository });
    const workspace = await knowledgeRepository.ensureWorkspace(project.projectId);

    const site = await projectRepository.createSite({
      projectId: project.projectId,
      displayName: "Site",
      primaryDomain: "example.com",
      environment: "production",
      publishingPlatform: "wordpress",
      publishingStatus: "CONNECTED",
      authenticationMethod: "token",
      connectionStatus: "HEALTHY",
      publishingCapabilities: ["draft", "publish"],
      defaultLanguage: "en",
      defaultTheme: "core",
    });

    const pageResponse = await handleCreatePage(
      makeRequest(`/api/gmp/projects/${project.projectId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.siteId,
          pageType: "home",
          name: "Home",
          title: "Home",
        }),
      }),
      project.projectId,
      { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices },
    );

    const page = (await pageResponse.json() as { page: { pageId: string } }).page;

    await knowledgeRepository.createRecord({
      projectId: project.projectId,
      knowledgeWorkspaceId: workspace.knowledgeWorkspaceId,
      domain: "company_identity",
      recordType: "profile",
      canonicalKey: "company_profile",
      title: "Company Profile",
      summary: "Approved profile",
      structuredValue: { name: "Acme" },
      normalizedValue: { name: "acme" },
      status: "APPROVED",
      confidence: 80,
      priority: 60,
      effectiveFrom: null,
      effectiveUntil: null,
      sourceCount: 1,
      conflictState: "NONE",
      reviewState: "APPROVED",
      parentRecordId: null,
      supersededByRecordId: null,
      archivedAt: null,
      metadata: {},
    });

    await pageRepository.createBrief({
      projectId: project.projectId,
      pageId: page.pageId,
      status: "APPROVED",
      purpose: "Introduce company",
      audience: "Buyers",
      userNeed: "Understand offering",
      businessGoal: "Lead capture",
      primaryTopic: "LED solutions",
      secondaryTopics: [],
      primaryKeyword: "led solutions",
      secondaryKeywords: [],
      searchIntent: "commercial",
      funnelStage: "awareness",
      valueProposition: "Dependable delivery",
      requiredClaims: ["company_profile"],
      requiredProofPoints: ["years-in-market"],
      requiredProductsOrServices: [],
      requiredApplications: [],
      requiredIndustries: [],
      requiredTechnicalSpecifications: [],
      requiredFaqs: [],
      restrictedMessaging: [],
      conversionGoal: "contact",
      primaryCta: "Talk to Sales",
      secondaryCta: "Read More",
      competitorContext: {},
      toneGuidance: "clear",
      evidenceRequirements: ["brochure"],
      knowledgeRecordReferences: ["company_profile"],
      sourceReferences: ["source-1"],
      approvedAt: new Date().toISOString(),
      approvedBy: "admin@example.com",
      metadata: {},
      archivedAt: null,
    });

    const currentBrief = (await pageRepository.listBriefsForPage(page.pageId))[0];
    await pageRepository.updatePage(page.pageId, { currentBriefId: currentBrief.briefId });

    const generateResponse = await handleGeneratePagePlan(
      makeRequest(`/api/gmp/pages/${page.pageId}/plans/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      page.pageId,
      { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices },
    );

    expect(generateResponse.status).toBe(201);

    const planResponse = await handleGetPagePlan(
      makeRequest(`/api/gmp/pages/${page.pageId}/plans`),
      page.pageId,
      { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices },
    );
    expect(planResponse.status).toBe(200);

    const readinessRun = await handleRunPageReadiness(
      makeRequest(`/api/gmp/pages/${page.pageId}/readiness/run`, { method: "POST" }),
      page.pageId,
      { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices },
    );
    expect(readinessRun.status).toBe(201);

    const readinessGet = await handleGetPageReadiness(
      makeRequest(`/api/gmp/pages/${page.pageId}/readiness`),
      page.pageId,
      { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices },
    );
    expect(readinessGet.status).toBe(200);

    const pageGet = await handleGetPage(
      makeRequest(`/api/gmp/pages/${page.pageId}`),
      page.pageId,
      { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices },
    );
    expect(pageGet.status).toBe(200);
  });

  it("serves relationship and internal-link health routes and rerun scans deterministically", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const project = createGmpProject({
      name: "Page Health API Project",
      workspaceId: "glw-led-display-warehouse",
      ownerActorId: "admin@example.com",
      slug: "page-health-api-project",
    });

    const projectRepository = createInMemoryGmpRepository({ projects: [project] });
    const pageRepository = createInMemoryGmpPageRepository();
    const knowledgeRepository = createInMemoryGmpKnowledgeRepository();
    const pageServices = createGmpPageServices({ pageRepository, knowledgeRepository });

    const site = await projectRepository.createSite({
      projectId: project.projectId,
      displayName: "Site",
      primaryDomain: "example.com",
      environment: "production",
      publishingPlatform: "wordpress",
      publishingStatus: "CONNECTED",
      authenticationMethod: "token",
      connectionStatus: "HEALTHY",
      publishingCapabilities: ["draft", "publish"],
      defaultLanguage: "en",
      defaultTheme: "core",
    });

    const pageResponse = await handleCreatePage(
      makeRequest(`/api/gmp/projects/${project.projectId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: site.siteId, pageType: "home", name: "Home", title: "Home" }),
      }),
      project.projectId,
      { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices },
    );
    const page = (await pageResponse.json() as { page: { pageId: string } }).page;

    await pageRepository.upsertRelationship({
      projectId: project.projectId,
      sourcePageId: page.pageId,
      targetPageId: page.pageId,
      relationshipType: "Canonical Variant",
      priority: 10,
      reason: "self canonical",
      status: "ACTIVE",
      metadata: {},
    });

    await pageRepository.replaceInternalLinksForPage(page.pageId, [{
      projectId: project.projectId,
      sourcePageId: page.pageId,
      targetPageId: page.pageId,
      sourcePageRefId: page.pageId,
      targetPageRefId: page.pageId,
      linkPurpose: "Support",
      anchorTextGuidance: "home",
      requirementLevel: "REQUIRED",
      sectionPlacement: "body",
      priority: 10,
      status: "PLANNED",
      reason: "self link",
      knowledgeRelationship: "supports",
      seoRelationship: "internal",
      metadata: {},
    }]);

    const relationshipHealth = await handleGetRelationshipHealth(makeRequest(`/api/gmp/pages/${page.pageId}/relationships/health`), page.pageId, { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices });
    expect(relationshipHealth.status).toBe(200);
    const relationshipPayload = await relationshipHealth.json() as { report: { projectId: string; pageId?: string; reportVersion: string } };
    expect(relationshipPayload.report.projectId).toBe(project.projectId);
    expect(relationshipPayload.report.pageId).toBe(page.pageId);

    const relationshipScan = await handleRunRelationshipScan(makeRequest(`/api/gmp/pages/${page.pageId}/relationships/scan`, { method: "POST" }), page.pageId, { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices });
    expect(relationshipScan.status).toBe(201);

    const linkHealth = await handleGetInternalLinkHealth(makeRequest(`/api/gmp/pages/${page.pageId}/internal-links/health`), page.pageId, { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices });
    expect(linkHealth.status).toBe(200);
    const linkPayload = await linkHealth.json() as { report: { projectId: string; pageId?: string } };
    expect(linkPayload.report.projectId).toBe(project.projectId);
    expect(linkPayload.report.pageId).toBe(page.pageId);

    const linkScan = await handleRunInternalLinkScan(makeRequest(`/api/gmp/pages/${page.pageId}/internal-links/scan`, { method: "POST" }), page.pageId, { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices });
    expect(linkScan.status).toBe(201);

    const projectHealth = await handleGetProjectPageArchitectureHealth(makeRequest(`/api/gmp/projects/${project.projectId}/page-architecture/health`), project.projectId, { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices });
    expect(projectHealth.status).toBe(200);

    const projectScan = await handleRunProjectPageArchitectureScan(makeRequest(`/api/gmp/projects/${project.projectId}/page-architecture/scan`, { method: "POST" }), project.projectId, { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices });
    expect(projectScan.status).toBe(201);
  });

  it("denies health routes without a session", async () => {
    const project = createGmpProject({
      name: "Denied Health Project",
      workspaceId: "glw-led-display-warehouse",
      ownerActorId: "admin@example.com",
      slug: "denied-health-project",
    });

    const projectRepository = createInMemoryGmpRepository({ projects: [project] });
    const pageRepository = createInMemoryGmpPageRepository();
    const knowledgeRepository = createInMemoryGmpKnowledgeRepository();
    const pageServices = createGmpPageServices({ pageRepository, knowledgeRepository });
    const site = await projectRepository.createSite({
      projectId: project.projectId,
      displayName: "Site",
      primaryDomain: "example.com",
      environment: "production",
      publishingPlatform: "wordpress",
      publishingStatus: "CONNECTED",
      authenticationMethod: "token",
      connectionStatus: "HEALTHY",
      publishingCapabilities: ["draft", "publish"],
      defaultLanguage: "en",
      defaultTheme: "core",
    });
    const pageResponse = await handleCreatePage(makeRequest(`/api/gmp/projects/${project.projectId}/pages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId: site.siteId, pageType: "home", name: "Home", title: "Home" }) }), project.projectId, { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices });
    const page = (await pageResponse.json() as { page: { pageId: string } }).page;

    const denied = await handleGetRelationshipHealth(makeRequest(`/api/gmp/pages/${page.pageId}/relationships/health`), page.pageId, { sessionLoader: async () => null, projectRepository, pageRepository, knowledgeRepository, pageServices });
    expect(denied.status).toBe(401);
  });
});
