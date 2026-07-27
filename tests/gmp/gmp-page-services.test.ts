import { describe, expect, it } from "@jest/globals";
import { createGmpProject } from "@/lib/gmp/models";
import { createInMemoryGmpRepository } from "@/lib/gmp/repository";
import { createInMemoryGmpKnowledgeRepository } from "@/lib/gmp/knowledge-repository";
import { createInMemoryGmpPageRepository } from "@/lib/gmp/page-repository";
import { createGmpPageServices } from "@/lib/gmp/page-services";
import { buildPage } from "@/lib/gmp/page-models";

describe("gmp page services", () => {
  it("generates deterministic page plan shape from approved brief and knowledge", async () => {
    const project = createGmpProject({
      name: "Page Planning Project",
      workspaceId: "glw-led-display-warehouse",
      ownerActorId: "admin@example.com",
      slug: "page-planning-project",
    });

    const projectRepository = createInMemoryGmpRepository({ projects: [project] });
    const site = await projectRepository.createSite({
      projectId: project.projectId,
      displayName: "Main Site",
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

    const pageRepository = createInMemoryGmpPageRepository();
    const knowledgeRepository = createInMemoryGmpKnowledgeRepository();
    const workspace = await knowledgeRepository.ensureWorkspace(project.projectId);

    const claim = await knowledgeRepository.createRecord({
      projectId: project.projectId,
      knowledgeWorkspaceId: workspace.knowledgeWorkspaceId,
      domain: "claims",
      recordType: "claim",
      canonicalKey: "approved_claim",
      title: "Approved Claim",
      summary: "5 year reliability",
      structuredValue: { text: "5 year reliability" },
      normalizedValue: { text: "5 year reliability" },
      status: "APPROVED",
      confidence: 90,
      priority: 80,
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

    const page = await pageRepository.createPage(buildPage({
      projectId: project.projectId,
      siteId: site.siteId,
      actorId: "admin@example.com",
      pageType: "product",
      name: "LED Controller",
      title: "Industrial LED Controller",
    }));

    const brief = await pageRepository.createBrief({
      projectId: project.projectId,
      pageId: page.pageId,
      status: "APPROVED",
      purpose: "Explain capabilities",
      audience: "Engineers",
      userNeed: "Understand controller durability",
      businessGoal: "Generate RFQs",
      primaryTopic: "Industrial controllers",
      secondaryTopics: ["environmental tolerance"],
      primaryKeyword: "industrial led controller",
      secondaryKeywords: ["rugged led control"],
      searchIntent: "commercial",
      funnelStage: "consideration",
      valueProposition: "Reliability in harsh conditions",
      requiredClaims: ["approved_claim"],
      requiredProofPoints: ["lab-validated"],
      requiredProductsOrServices: ["controller-x"],
      requiredApplications: ["warehouses"],
      requiredIndustries: ["logistics"],
      requiredTechnicalSpecifications: ["IP67"],
      requiredFaqs: ["What is max load?"],
      restrictedMessaging: [],
      conversionGoal: "contact",
      primaryCta: "Request Quote",
      secondaryCta: "Download Spec",
      competitorContext: {},
      toneGuidance: "technical",
      evidenceRequirements: ["spec-sheet"],
      knowledgeRecordReferences: [claim.knowledgeRecordId],
      sourceReferences: ["source-1"],
      approvedAt: new Date().toISOString(),
      approvedBy: "admin@example.com",
      archivedAt: null,
      metadata: {},
    });

    await pageRepository.updatePage(page.pageId, { currentBriefId: brief.briefId });

    const services = createGmpPageServices({ pageRepository, knowledgeRepository });
    const first = await services.generatePlanForPage({ pageId: page.pageId, actorId: "admin@example.com" });
    const second = await services.generatePlanForPage({ pageId: page.pageId, actorId: "admin@example.com", briefId: brief.briefId });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first?.contentPlan.sectionOrder).toEqual(second?.contentPlan.sectionOrder);
    expect(first?.sections.map((section) => section.sectionKey)).toEqual(second?.sections.map((section) => section.sectionKey));
  });

  it("computes readiness and emits blocking issues when approvals are missing", async () => {
    const project = createGmpProject({
      name: "Page Readiness Project",
      workspaceId: "glw-led-display-warehouse",
      ownerActorId: "admin@example.com",
      slug: "page-readiness-project",
    });

    const projectRepository = createInMemoryGmpRepository({ projects: [project] });
    const site = await projectRepository.createSite({
      projectId: project.projectId,
      displayName: "Main Site",
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

    const pageRepository = createInMemoryGmpPageRepository();
    const page = await pageRepository.createPage(buildPage({
      projectId: project.projectId,
      siteId: site.siteId,
      actorId: "admin@example.com",
      pageType: "home",
      name: "Homepage",
      title: "Homepage",
    }));

    const services = createGmpPageServices({
      pageRepository,
      knowledgeRepository: createInMemoryGmpKnowledgeRepository(),
    });

    const readiness = await services.runReadinessAssessment(page.pageId, "admin@example.com");
    expect(readiness?.blockingIssues).toContain("approved_brief_required");
    expect(readiness?.blockingIssues).toContain("approved_plan_required");
  });
});
