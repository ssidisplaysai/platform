import { describe, expect, it } from "@jest/globals";
import { createGmpProject } from "@/lib/gmp/models";
import { createInMemoryGmpRepository } from "@/lib/gmp/repository";
import { createInMemoryGmpPageRepository } from "@/lib/gmp/page-repository";
import { buildPage } from "@/lib/gmp/page-models";
import { buildPageGraph } from "@/lib/gmp/page-graph-service";
import { buildPageLinkSummary } from "@/lib/gmp/page-link-service";
import { buildPageHealthReport } from "@/lib/gmp/page-health-service";

async function seedPageIntelligenceFixture() {
  const project = createGmpProject({
    name: "Page Intelligence Project",
    workspaceId: "glw-led-display-warehouse",
    ownerActorId: "admin@example.com",
    slug: "page-intelligence-project",
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
  const pageA = await pageRepository.createPage(buildPage({
    projectId: project.projectId,
    siteId: site.siteId,
    actorId: "admin@example.com",
    pageType: "home",
    name: "Home",
    title: "Home",
  }));
  const pageB = await pageRepository.createPage(buildPage({
    projectId: project.projectId,
    siteId: site.siteId,
    actorId: "admin@example.com",
    pageType: "product",
    name: "Controller",
    title: "Controller",
  }));
  const pageC = await pageRepository.createPage(buildPage({
    projectId: project.projectId,
    siteId: site.siteId,
    actorId: "admin@example.com",
    pageType: "service",
    name: "Service",
    title: "Service",
  }));

  const brief = await pageRepository.createBrief({
    projectId: project.projectId,
    pageId: pageA.pageId,
    status: "APPROVED",
    purpose: "Explain the product",
    audience: "Operators",
    userNeed: "Understand the offer",
    businessGoal: "Generate leads",
    primaryTopic: "Intelligence",
    secondaryTopics: [],
    primaryKeyword: "page intelligence",
    secondaryKeywords: [],
    searchIntent: "commercial",
    funnelStage: "consideration",
    valueProposition: "Clear planning",
    requiredClaims: [],
    requiredProofPoints: [],
    requiredProductsOrServices: [],
    requiredApplications: [],
    requiredIndustries: [],
    requiredTechnicalSpecifications: [],
    requiredFaqs: [],
    restrictedMessaging: [],
    conversionGoal: "contact",
    primaryCta: "Request quote",
    secondaryCta: "Learn more",
    competitorContext: {},
    toneGuidance: "direct",
    evidenceRequirements: ["source-1"],
    knowledgeRecordReferences: [],
    sourceReferences: [],
    approvedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    approvedBy: "admin@example.com",
    archivedAt: null,
    metadata: {},
  });
  await pageRepository.updatePage(pageA.pageId, { currentBriefId: brief.briefId, currentContentPlanId: "plan-a" });

  await pageRepository.createContentPlan({
    projectId: project.projectId,
    pageId: pageA.pageId,
    pageBriefId: brief.briefId,
    status: "APPROVED",
    planningModelVersion: "test",
    targetWordRange: { min: 800, max: 1000 },
    readingLevel: "grade 8",
    requiredSectionCount: 2,
    optionalSectionCount: 1,
    sectionOrder: ["hero", "proof"],
    internalLinkRequirements: [],
    externalEvidenceRequirements: [],
    structuredDataRequirements: [],
    mediaRequirements: [],
    ctaRequirements: [],
    seoRequirements: [],
    accessibilityRequirements: [],
    approvalRequirements: [],
    readinessScore: 90,
    approvedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    approvedBy: "admin@example.com",
    archivedAt: null,
    metadata: {},
  });

  const contentPlan = (await pageRepository.listContentPlansForPage(pageA.pageId))[0];
  await pageRepository.updatePage(pageA.pageId, { currentContentPlanId: contentPlan?.contentPlanId });

  await pageRepository.createReadinessAssessment({
    projectId: project.projectId,
    pageId: pageA.pageId,
    scoringModelVersion: "test",
    overallScore: 92,
    planningReadiness: 95,
    knowledgeReadiness: 90,
    seoReadiness: 88,
    evidenceReadiness: 91,
    linkingReadiness: 89,
    blockingIssues: [],
    warnings: ["needs_link_review"],
    recommendations: ["Add supporting links"],
    metadata: {},
  });

  await pageRepository.upsertRelationship({
    projectId: project.projectId,
    sourcePageId: pageA.pageId,
    targetPageId: pageB.pageId,
    relationshipType: "Canonical Variant",
    priority: 10,
    reason: "canonical target",
    status: "ACTIVE",
    metadata: {},
  });
  await pageRepository.upsertRelationship({
    projectId: project.projectId,
    sourcePageId: pageA.pageId,
    targetPageId: pageC.pageId,
    relationshipType: "Canonical Variant",
    priority: 8,
    reason: "canonical target 2",
    status: "ACTIVE",
    metadata: {},
  });
  await pageRepository.upsertRelationship({
    projectId: project.projectId,
    sourcePageId: pageB.pageId,
    targetPageId: pageC.pageId,
    relationshipType: "Parent",
    priority: 6,
    reason: "structural parent",
    status: "ACTIVE",
    metadata: {},
  });
  await pageRepository.upsertRelationship({
    projectId: project.projectId,
    sourcePageId: pageC.pageId,
    targetPageId: pageA.pageId,
    relationshipType: "Parent",
    priority: 6,
    reason: "structural parent cycle",
    status: "ACTIVE",
    metadata: {},
  });
  await pageRepository.upsertRelationship({
    projectId: project.projectId,
    sourcePageId: pageA.pageId,
    targetPageId: pageB.pageId,
    relationshipType: "Parent",
    priority: 5,
    reason: "structural parent cycle",
    status: "ACTIVE",
    metadata: {},
  });

  const [plannedLink, brokenLink] = await pageRepository.replaceInternalLinksForPage(pageA.pageId, [
    {
      projectId: project.projectId,
      sourcePageId: pageA.pageId,
      targetPageId: pageB.pageId,
      sourcePageRefId: pageA.pageId,
      targetPageRefId: pageB.pageId,
      linkPurpose: "Support",
      anchorTextGuidance: "controller overview",
      requirementLevel: "REQUIRED",
      sectionPlacement: "body",
      priority: 10,
      status: "PLANNED",
      reason: "supporting reference",
      knowledgeRelationship: "supports",
      seoRelationship: "internal",
      metadata: {},
    },
    {
      projectId: project.projectId,
      sourcePageId: pageA.pageId,
      targetPageId: "missing-page",
      sourcePageRefId: pageA.pageId,
      targetPageRefId: "missing-page",
      linkPurpose: "Support",
      anchorTextGuidance: "controller overview",
      requirementLevel: "REQUIRED",
      sectionPlacement: "body",
      priority: 9,
      status: "PLANNED",
      reason: "broken reference",
      knowledgeRelationship: "supports",
      seoRelationship: "internal",
      metadata: {},
    },
  ]);

  void plannedLink;

  return { project, pageRepository, pageA, pageB, pageC, brokenLink };
}

describe("gmp page intelligence", () => {
  it("builds a deterministic page graph with cycles and duplicate canonical targets", async () => {
    const { project, pageRepository, pageA, pageB, pageC, brokenLink } = await seedPageIntelligenceFixture();

    const first = await buildPageGraph(project.projectId, pageRepository);
    const second = await buildPageGraph(project.projectId, pageRepository);

    expect(first).toEqual(second);
    expect(first.circularReferences.length).toBeGreaterThan(0);
    expect(first.duplicateCanonicalTargets).toContain(pageA.pageId);
    expect(first.brokenReferences).toContain(brokenLink.internalLinkPlanId);
    expect(first.relationshipCounts.Parent).toBeGreaterThan(0);
    expect(first.pages.map((page) => page.pageId)).toEqual(expect.arrayContaining([pageA.pageId, pageB.pageId, pageC.pageId]));
  });

  it("builds deterministic link intelligence and flags broken targets", async () => {
    const { project, pageRepository, pageA, brokenLink } = await seedPageIntelligenceFixture();

    const first = await buildPageLinkSummary(project.projectId, pageRepository);
    const second = await buildPageLinkSummary(project.projectId, pageRepository);

    expect(first).toEqual(second);
    expect(first.brokenTargets).toEqual([brokenLink.internalLinkPlanId]);
    expect(first.duplicateLinks).toEqual([]);
    expect(first.noInboundLinks).toContain(pageA.pageId);
    expect(first.issues.some((issue) => issue.ruleId === "page.link.broken-target")).toBe(true);
  });

  it("aggregates planning health from graph, links, and readiness state", async () => {
    const { project, pageRepository } = await seedPageIntelligenceFixture();

    const first = await buildPageHealthReport({ projectId: project.projectId, repository: pageRepository, executions: [{ executionId: "exec-1", status: "SUCCEEDED", operationType: "relationship_scan", createdAt: "2026-01-01T00:00:00.000Z" }] });
    const second = await buildPageHealthReport({ projectId: project.projectId, repository: pageRepository, executions: [{ executionId: "exec-1", status: "SUCCEEDED", operationType: "relationship_scan", createdAt: "2026-01-01T00:00:00.000Z" }] });

    expect(first).toEqual(second);
    expect(first.pagesReady).toBe(1);
    expect(first.pagesBlocked).toBe(0);
    expect(first.relationshipHealth.score).toBeLessThan(100);
    expect(first.linkHealth.score).toBeLessThan(100);
    expect(first.overallPlanningHealth.score).toBeLessThanOrEqual(100);
    expect(first.latestGopExecutions).toHaveLength(1);
  });
});