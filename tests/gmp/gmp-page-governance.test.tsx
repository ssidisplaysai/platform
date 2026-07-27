import { describe, expect, it, jest } from "@jest/globals";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "mocked.session.token" }),
    set: () => undefined,
    delete: () => undefined,
  }),
}), { virtual: true });

import { GmpGovernanceTimeline } from "@/components/gmp/gmp-governance-timeline";
import { GmpTraceabilityPanel } from "@/components/gmp/gmp-traceability-panel";
import { GmpVersionCompare } from "@/components/gmp/gmp-version-compare";
import { createGmpProject } from "@/lib/gmp/models";
import { createInMemoryGmpRepository } from "@/lib/gmp/repository";
import { createInMemoryGmpKnowledgeRepository } from "@/lib/gmp/knowledge-repository";
import { createInMemoryGmpPageRepository } from "@/lib/gmp/page-repository";
import { createGmpPageServices } from "@/lib/gmp/page-services";
import { buildPage, validatePageBriefInput } from "@/lib/gmp/page-models";
import { handleApprovePageBrief, handleUpdatePageBrief } from "@/lib/gmp/page-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const sessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });

describe("gmp page governance", () => {
  it("renders version comparison, timeline, and traceability panels", () => {
    const compareMarkup = renderToStaticMarkup(
      <GmpVersionCompare
        title="Brief comparison"
        before={{ purpose: "Old", knowledgeRecordReferences: ["record-a"], evidenceReferences: ["evidence-a"] }}
        after={{ purpose: "New", knowledgeRecordReferences: ["record-a", "record-b"], evidenceReferences: ["evidence-a", "evidence-b"], addedField: true }}
      />,
    );

    const timelineMarkup = renderToStaticMarkup(
      <GmpGovernanceTimeline
        title="Governance events"
        events={[
          { label: "Brief Created", at: "2026-07-26T10:00:00.000Z" },
          { label: "Brief Approved", at: "2026-07-26T11:00:00.000Z", state: "APPROVED" },
        ]}
      />,
    );

    const traceabilityMarkup = renderToStaticMarkup(
      <GmpTraceabilityPanel
        projectId="project-1"
        pageId="page-1"
        page={{ knowledgeWorkspaceVersion: 7, brandProfileVersion: 3 }}
        briefReferences={[{ knowledgeRecordId: "record-a", knowledgeRecordVersion: 4, required: true, role: "brief_reference", metadata: { canonicalKey: "record-a" } }]}
        planReferences={[{ knowledgeWorkspaceId: "workspace-1", knowledgeRecordId: "record-b", knowledgeRecordVersion: 2, required: true, role: "plan_reference", metadata: { canonicalKey: "record-b" } }]}
        sourceReferences={[{ sourceId: "source-1", required: true, role: "evidence_requirement" }]}
        sections={[{ sectionId: "section-1", sectionKey: "hero", workingHeading: "Hero", position: 1, requiredKnowledgeRecords: ["record-a"], requiredEvidence: ["source-1"] }]}
      />,
    );

    expect(compareMarkup).toContain("Added");
    expect(compareMarkup).toContain("Changed");
    expect(compareMarkup).toContain("knowledgeRecordReferences");
    expect(timelineMarkup).toContain("Brief Created");
    expect(timelineMarkup).toContain("APPROVED");
    expect(traceabilityMarkup).toContain("Knowledge Workspace");
    expect(traceabilityMarkup).toContain("Open GMP-0002 workspace");
    expect(traceabilityMarkup).toContain("Open section planner");
  });

  it("keeps approved briefs immutable unless superseded", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const project = createGmpProject({
      name: "Governance Project",
      workspaceId: "glw-led-display-warehouse",
      ownerActorId: "admin@example.com",
      slug: "governance-project",
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

    const page = await pageRepository.createPage(buildPage({
      projectId: project.projectId,
      siteId: site.siteId,
      actorId: "admin@example.com",
      pageType: "product",
      name: "LED Controller",
      title: "LED Controller",
    }));

    const briefInput = validatePageBriefInput({
      purpose: "Explain capabilities",
      audience: "Buyers",
      userNeed: "Understand product",
      businessGoal: "Lead capture",
      primaryTopic: "LED controllers",
      primaryKeyword: "led controller",
      secondaryTopics: [],
      secondaryKeywords: [],
      searchIntent: "commercial",
      funnelStage: "consideration",
      valueProposition: "Reliable and efficient",
      requiredClaims: [],
      requiredProofPoints: [],
      requiredProductsOrServices: [],
      requiredApplications: [],
      requiredIndustries: [],
      requiredTechnicalSpecifications: [],
      requiredFaqs: [],
      restrictedMessaging: [],
      conversionGoal: "contact",
      primaryCta: "Request Demo",
      secondaryCta: "View Specs",
      competitorContext: {},
      toneGuidance: "clear",
      evidenceRequirements: [],
      knowledgeRecordReferences: [],
      sourceReferences: [],
      metadata: {},
    });

    expect(briefInput.ok).toBe(true);

    const brief = await pageRepository.createBrief({
      projectId: project.projectId,
      pageId: page.pageId,
      status: "APPROVED",
      purpose: "Explain capabilities",
      audience: "Buyers",
      userNeed: "Understand product",
      businessGoal: "Lead capture",
      primaryTopic: "LED controllers",
      secondaryTopics: [],
      primaryKeyword: "led controller",
      secondaryKeywords: [],
      searchIntent: "commercial",
      funnelStage: "consideration",
      valueProposition: "Reliable and efficient",
      requiredClaims: [],
      requiredProofPoints: [],
      requiredProductsOrServices: [],
      requiredApplications: [],
      requiredIndustries: [],
      requiredTechnicalSpecifications: [],
      requiredFaqs: [],
      restrictedMessaging: [],
      conversionGoal: "contact",
      primaryCta: "Request Demo",
      secondaryCta: "View Specs",
      competitorContext: {},
      toneGuidance: "clear",
      evidenceRequirements: [],
      knowledgeRecordReferences: [],
      sourceReferences: [],
      approvedAt: new Date().toISOString(),
      approvedBy: "admin@example.com",
      metadata: {},
      archivedAt: null,
    });

    await pageRepository.updatePage(page.pageId, { currentBriefId: brief.briefId });

    const rejected = await handleUpdatePageBrief(
      makeRequest(`/api/gmp/page-briefs/${brief.briefId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "New purpose" }),
      }),
      brief.briefId,
      { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices },
    );

    expect(rejected.status).toBe(409);

    const superseded = await handleUpdatePageBrief(
      makeRequest(`/api/gmp/page-briefs/${brief.briefId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supersede: true, purpose: "New purpose" }),
      }),
      brief.briefId,
      { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices },
    );

    expect(superseded.status).toBe(201);

    const approval = await handleApprovePageBrief(
      makeRequest(`/api/gmp/page-briefs/${brief.briefId}/approve`, { method: "POST" }),
      brief.briefId,
      { sessionLoader, projectRepository, pageRepository, knowledgeRepository, pageServices },
    );

    expect(approval.status).toBe(200);
  });
});
