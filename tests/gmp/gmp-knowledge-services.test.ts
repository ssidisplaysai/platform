import { describe, expect, it } from "@jest/globals";
import { createGmpProject } from "@/lib/gmp/models";
import { createInMemoryGmpRepository } from "@/lib/gmp/repository";
import { createInMemoryGmpKnowledgeRepository } from "@/lib/gmp/knowledge-repository";
import { createGmpKnowledgeServices } from "@/lib/gmp/knowledge-services";

describe("gmp knowledge services", () => {
  it("creates workspace, runs deterministic completeness, and assembles deterministic approved context", async () => {
    const project = createGmpProject({
      name: "Knowledge Project",
      workspaceId: "glw-led-display-warehouse",
      ownerActorId: "admin@example.com",
      slug: "knowledge-project",
    });

    const projectRepository = createInMemoryGmpRepository({ projects: [project] });
    const knowledgeRepository = createInMemoryGmpKnowledgeRepository();
    const services = createGmpKnowledgeServices({ projectRepository, knowledgeRepository });

    const workspace = await services.ensureWorkspace(project.projectId);
    expect(workspace.projectId).toBe(project.projectId);

    const recordA = await knowledgeRepository.createRecord({
      projectId: project.projectId,
      knowledgeWorkspaceId: workspace.knowledgeWorkspaceId,
      domain: "company_identity",
      recordType: "profile",
      canonicalKey: "company_profile",
      title: "Company Profile",
      summary: "Primary company profile",
      structuredValue: { name: "Acme" },
      normalizedValue: { name: "acme" },
      status: "DRAFT",
      confidence: 80,
      priority: 50,
      effectiveFrom: null,
      effectiveUntil: null,
      sourceCount: 0,
      conflictState: "NONE",
      reviewState: "DRAFT",
      parentRecordId: null,
      supersededByRecordId: null,
      archivedAt: null,
      metadata: {},
    });

    const recordB = await knowledgeRepository.createRecord({
      projectId: project.projectId,
      knowledgeWorkspaceId: workspace.knowledgeWorkspaceId,
      domain: "brand",
      recordType: "voice",
      canonicalKey: "brand_voice",
      title: "Brand Voice",
      summary: "Brand voice guidance",
      structuredValue: { voice: "helpful" },
      normalizedValue: { voice: "helpful" },
      status: "DRAFT",
      confidence: 80,
      priority: 50,
      effectiveFrom: null,
      effectiveUntil: null,
      sourceCount: 0,
      conflictState: "NONE",
      reviewState: "DRAFT",
      parentRecordId: null,
      supersededByRecordId: null,
      archivedAt: null,
      metadata: {},
    });

    await services.submitRecordForReview(recordA.knowledgeRecordId, "admin@example.com");
    await services.approveRecord(recordA.knowledgeRecordId, "admin@example.com");

    const completeFirst = await services.runCompletenessAssessment(project.projectId, "admin@example.com");
    const completeSecond = await services.runCompletenessAssessment(project.projectId, "admin@example.com");

    expect(completeFirst.overallScore).toBe(completeSecond.overallScore);
    expect(completeFirst.missingCriticalFields).toEqual(completeSecond.missingCriticalFields);

    await services.submitRecordForReview(recordB.knowledgeRecordId, "admin@example.com");
    await services.approveRecord(recordB.knowledgeRecordId, "admin@example.com");

    const assembledOne = await services.assembleContext({
      projectId: project.projectId,
      actorId: "admin@example.com",
      operationType: "PAGE",
      previewMode: false,
    });

    const assembledTwo = await services.assembleContext({
      projectId: project.projectId,
      actorId: "admin@example.com",
      operationType: "PAGE",
      previewMode: false,
    });

    const contextOne = assembledOne.assembledContext as { knowledgeDomains?: Record<string, unknown> };
    const contextTwo = assembledTwo.assembledContext as { knowledgeDomains?: Record<string, unknown> };

    expect(contextOne.knowledgeDomains).toEqual(contextTwo.knowledgeDomains);
    expect(assembledOne.recordVersions).toEqual(assembledTwo.recordVersions);
    expect(assembledOne.gopExecutionId).toBeTruthy();
  });

  it("detects conflicts and resolves them deterministically", async () => {
    const project = createGmpProject({
      name: "Conflict Project",
      workspaceId: "glw-led-display-warehouse",
      ownerActorId: "admin@example.com",
      slug: "conflict-project",
    });

    const projectRepository = createInMemoryGmpRepository({ projects: [project] });
    const knowledgeRepository = createInMemoryGmpKnowledgeRepository();
    const services = createGmpKnowledgeServices({ projectRepository, knowledgeRepository });
    const workspace = await services.ensureWorkspace(project.projectId);

    const first = await knowledgeRepository.createRecord({
      projectId: project.projectId,
      knowledgeWorkspaceId: workspace.knowledgeWorkspaceId,
      domain: "claims",
      recordType: "claim",
      canonicalKey: "claim_lighting_lifespan",
      title: "Lifespan Claim A",
      summary: "A",
      structuredValue: { years: 5 },
      normalizedValue: { years: 5 },
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

    await knowledgeRepository.createRecord({
      projectId: project.projectId,
      knowledgeWorkspaceId: workspace.knowledgeWorkspaceId,
      domain: "claims",
      recordType: "claim",
      canonicalKey: "claim_lighting_lifespan",
      title: "Lifespan Claim B",
      summary: "B",
      structuredValue: { years: 10 },
      normalizedValue: { years: 10 },
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

    const conflicts = await services.runConflictScan(project.projectId, "admin@example.com");
    expect(conflicts.length).toBe(1);

    const resolved = await knowledgeRepository.resolveConflict(conflicts[0].knowledgeConflictId, {
      selectedRecordId: first.knowledgeRecordId,
      resolutionNotes: "Select record A",
      resolvedBy: "admin@example.com",
    });

    expect(resolved?.resolutionStatus).toBe("RESOLVED");
    expect(resolved?.selectedRecordId).toBe(first.knowledgeRecordId);
  });

  it("supports preview mode context assembly with draft records", async () => {
    const project = createGmpProject({
      name: "Preview Project",
      workspaceId: "glw-led-display-warehouse",
      ownerActorId: "admin@example.com",
      slug: "preview-project",
    });

    const projectRepository = createInMemoryGmpRepository({ projects: [project] });
    const knowledgeRepository = createInMemoryGmpKnowledgeRepository();
    const services = createGmpKnowledgeServices({ projectRepository, knowledgeRepository });
    const workspace = await services.ensureWorkspace(project.projectId);

    const draftRecord = await knowledgeRepository.createRecord({
      projectId: project.projectId,
      knowledgeWorkspaceId: workspace.knowledgeWorkspaceId,
      domain: "seo_topics",
      recordType: "topic",
      canonicalKey: "primary_topic",
      title: "Draft Topic",
      summary: "Draft only",
      structuredValue: { topic: "led strip lighting" },
      normalizedValue: { topic: "led strip lighting" },
      status: "DRAFT",
      confidence: 60,
      priority: 40,
      effectiveFrom: null,
      effectiveUntil: null,
      sourceCount: 0,
      conflictState: "NONE",
      reviewState: "DRAFT",
      parentRecordId: null,
      supersededByRecordId: null,
      archivedAt: null,
      metadata: {},
    });

    const approvedContext = await services.assembleContext({
      projectId: project.projectId,
      actorId: "admin@example.com",
      operationType: "SEO_OPERATION",
      previewMode: false,
    });

    const previewContext = await services.assembleContext({
      projectId: project.projectId,
      actorId: "admin@example.com",
      operationType: "SEO_OPERATION",
      previewMode: true,
    });

    const approvedDomains = (approvedContext.assembledContext.knowledgeDomains as Record<string, unknown>) ?? {};
    const previewDomains = (previewContext.assembledContext.knowledgeDomains as Record<string, unknown>) ?? {};

    expect(approvedDomains.seo_topics).toBeUndefined();
    expect(previewDomains.seo_topics).toBeDefined();
    expect(previewContext.recordVersions[draftRecord.knowledgeRecordId]).toBeGreaterThan(0);
  });
});
