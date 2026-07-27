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
import { createGmpKnowledgeServices } from "@/lib/gmp/knowledge-services";
import {
  handleApproveRecord,
  handleAssembleContext,
  handleCreateEvidenceLink,
  handleCreateKnowledgeRecord,
  handleCreateKnowledgeSource,
  handleDeleteKnowledgeRecord,
  handleGetKnowledgeRecord,
  handleGetKnowledgeRecordVersions,
  handleGetKnowledgeWorkspace,
  handleListKnowledgeConflicts,
  handleListKnowledgeRecords,
  handleListKnowledgeSources,
  handleRejectRecord,
  handleRunCompleteness,
  handleSubmitRecordForReview,
  handleUpdateKnowledgeRecord,
} from "@/lib/gmp/knowledge-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const sessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });

describe("gmp knowledge api", () => {
  it("creates workspace and records with workspace isolation", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const project = createGmpProject({
      name: "API Project",
      workspaceId: "glw-led-display-warehouse",
      ownerActorId: "admin@example.com",
      slug: "api-project",
    });

    const projectRepository = createInMemoryGmpRepository({ projects: [project] });
    const knowledgeRepository = createInMemoryGmpKnowledgeRepository();
    const knowledgeServices = createGmpKnowledgeServices({ projectRepository, knowledgeRepository });

    const workspaceResponse = await handleGetKnowledgeWorkspace(makeRequest(`/api/gmp/projects/${project.projectId}/knowledge`), project.projectId, {
      sessionLoader,
      projectRepository,
      knowledgeRepository,
      knowledgeServices,
    });
    expect(workspaceResponse.status).toBe(200);

    const createRecordResponse = await handleCreateKnowledgeRecord(
      makeRequest(`/api/gmp/projects/${project.projectId}/knowledge/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: "company_identity",
          recordType: "profile",
          canonicalKey: "company_profile",
          title: "Company Profile",
          structuredValue: { name: "Acme" },
        }),
      }),
      project.projectId,
      {
        sessionLoader,
        projectRepository,
        knowledgeRepository,
        knowledgeServices,
      },
    );

    expect(createRecordResponse.status).toBe(201);

    const listResponse = await handleListKnowledgeRecords(makeRequest(`/api/gmp/projects/${project.projectId}/knowledge/records?domain=company_identity`), project.projectId, {
      sessionLoader,
      projectRepository,
      knowledgeRepository,
      knowledgeServices,
    });

    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json() as { records: Array<{ domain: string }> };
    expect(listPayload.records.length).toBe(1);
    expect(listPayload.records[0].domain).toBe("company_identity");

    const isolatedProject = createGmpProject({
      name: "Isolated",
      workspaceId: "workspace-2",
      ownerActorId: "admin@example.com",
      slug: "isolated",
    });
    await projectRepository.createProject(isolatedProject);

    const isolationResponse = await handleGetKnowledgeWorkspace(
      makeRequest(`/api/gmp/projects/${isolatedProject.projectId}/knowledge`),
      isolatedProject.projectId,
      {
        sessionLoader,
        projectRepository,
        knowledgeRepository,
        knowledgeServices,
      },
    );
    expect(isolationResponse.status).toBe(404);
  });

  it("handles review, approval, rejection, version history, and approved overwrite protection", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const project = createGmpProject({
      name: "Review Project",
      workspaceId: "glw-led-display-warehouse",
      ownerActorId: "admin@example.com",
      slug: "review-project",
    });

    const projectRepository = createInMemoryGmpRepository({ projects: [project] });
    const knowledgeRepository = createInMemoryGmpKnowledgeRepository();
    const knowledgeServices = createGmpKnowledgeServices({ projectRepository, knowledgeRepository });

    const created = await handleCreateKnowledgeRecord(
      makeRequest(`/api/gmp/projects/${project.projectId}/knowledge/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: "brand",
          recordType: "voice",
          canonicalKey: "brand_voice",
          title: "Brand Voice",
          structuredValue: { tone: "expert" },
        }),
      }),
      project.projectId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );

    const payload = await created.json() as { record: { knowledgeRecordId: string } };
    const recordId = payload.record.knowledgeRecordId;

    const reviewResponse = await handleSubmitRecordForReview(
      makeRequest(`/api/gmp/knowledge/records/${recordId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "review" }),
      }),
      recordId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(reviewResponse.status).toBe(200);

    const approveResponse = await handleApproveRecord(
      makeRequest(`/api/gmp/knowledge/records/${recordId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "approve" }),
      }),
      recordId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(approveResponse.status).toBe(200);

    const overwriteResponse = await handleUpdateKnowledgeRecord(
      makeRequest(`/api/gmp/knowledge/records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Should Fail",
        }),
      }),
      recordId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(overwriteResponse.status).toBe(409);

    const supersedeResponse = await handleUpdateKnowledgeRecord(
      makeRequest(`/api/gmp/knowledge/records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Superseding Draft",
          forceSupersede: true,
          changeReason: "new proof",
        }),
      }),
      recordId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(supersedeResponse.status).toBe(200);

    const supersededPayload = await supersedeResponse.json() as { record: { knowledgeRecordId: string } };
    const versionsResponse = await handleGetKnowledgeRecordVersions(
      makeRequest(`/api/gmp/knowledge/records/${supersededPayload.record.knowledgeRecordId}/versions`),
      supersededPayload.record.knowledgeRecordId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(versionsResponse.status).toBe(200);

    const rejectResponse = await handleRejectRecord(
      makeRequest(`/api/gmp/knowledge/records/${supersededPayload.record.knowledgeRecordId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "reject" }),
      }),
      supersededPayload.record.knowledgeRecordId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(rejectResponse.status).toBe(200);

    const archiveResponse = await handleDeleteKnowledgeRecord(
      makeRequest(`/api/gmp/knowledge/records/${supersededPayload.record.knowledgeRecordId}`, { method: "DELETE" }),
      supersededPayload.record.knowledgeRecordId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(archiveResponse.status).toBe(200);
  });

  it("supports source registration, evidence links, conflict listing, completeness runs, and context assembly", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const project = createGmpProject({
      name: "Ops Project",
      workspaceId: "glw-led-display-warehouse",
      ownerActorId: "admin@example.com",
      slug: "ops-project",
    });

    const projectRepository = createInMemoryGmpRepository({ projects: [project] });
    const knowledgeRepository = createInMemoryGmpKnowledgeRepository();
    const knowledgeServices = createGmpKnowledgeServices({ projectRepository, knowledgeRepository });

    const createFirst = await handleCreateKnowledgeRecord(
      makeRequest(`/api/gmp/projects/${project.projectId}/knowledge/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: "claims",
          recordType: "claim",
          canonicalKey: "claim_led_lifespan",
          title: "Claim 1",
          structuredValue: { years: 5 },
          normalizedValue: { years: 5 },
        }),
      }),
      project.projectId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    const firstRecord = (await createFirst.json() as { record: { knowledgeRecordId: string } }).record;

    const createSecond = await handleCreateKnowledgeRecord(
      makeRequest(`/api/gmp/projects/${project.projectId}/knowledge/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: "claims",
          recordType: "claim",
          canonicalKey: "claim_led_lifespan_2",
          title: "Claim 2",
          structuredValue: { years: 10 },
          normalizedValue: { years: 10 },
        }),
      }),
      project.projectId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    const secondRecord = (await createSecond.json() as { record: { knowledgeRecordId: string } }).record;

    await handleUpdateKnowledgeRecord(
      makeRequest(`/api/gmp/knowledge/records/${secondRecord.knowledgeRecordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonicalKey: "claim_led_lifespan",
        }),
      }),
      secondRecord.knowledgeRecordId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );

    const sourceResponse = await handleCreateKnowledgeSource(
      makeRequest(`/api/gmp/projects/${project.projectId}/knowledge/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "DOCUMENT", displayName: "Warranty Sheet" }),
      }),
      project.projectId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(sourceResponse.status).toBe(201);

    const sourcePayload = await sourceResponse.json() as { source: { sourceId: string } };

    const evidenceResponse = await handleCreateEvidenceLink(
      makeRequest(`/api/gmp/knowledge/records/${firstRecord.knowledgeRecordId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: sourcePayload.source.sourceId, evidenceSummary: "Warranty 5 years" }),
      }),
      firstRecord.knowledgeRecordId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(evidenceResponse.status).toBe(201);

    const completenessRun = await handleRunCompleteness(
      makeRequest(`/api/gmp/projects/${project.projectId}/knowledge/completeness/run`, { method: "POST" }),
      project.projectId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(completenessRun.status).toBe(201);

    const conflictsResponse = await handleListKnowledgeConflicts(
      makeRequest(`/api/gmp/projects/${project.projectId}/knowledge/conflicts`),
      project.projectId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(conflictsResponse.status).toBe(200);

    const contextApproved = await handleAssembleContext(
      makeRequest(`/api/gmp/projects/${project.projectId}/knowledge/context/assemble`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationType: "PAGE" }),
      }),
      project.projectId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(contextApproved.status).toBe(201);

    const contextPreview = await handleAssembleContext(
      makeRequest(`/api/gmp/projects/${project.projectId}/knowledge/context/assemble`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationType: "PAGE", previewMode: true }),
      }),
      project.projectId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(contextPreview.status).toBe(201);

    const recordsResponse = await handleListKnowledgeRecords(
      makeRequest(`/api/gmp/projects/${project.projectId}/knowledge/records`),
      project.projectId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(recordsResponse.status).toBe(200);

    const sourcesResponse = await handleListKnowledgeSources(
      makeRequest(`/api/gmp/projects/${project.projectId}/knowledge/sources`),
      project.projectId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(sourcesResponse.status).toBe(200);

    const recordResponse = await handleGetKnowledgeRecord(
      makeRequest(`/api/gmp/knowledge/records/${firstRecord.knowledgeRecordId}`),
      firstRecord.knowledgeRecordId,
      { sessionLoader, projectRepository, knowledgeRepository, knowledgeServices },
    );
    expect(recordResponse.status).toBe(200);
  });

  it("returns unauthorized when session is missing", async () => {
    const project = createGmpProject({
      name: "Unauthorized Project",
      workspaceId: "glw-led-display-warehouse",
      ownerActorId: "admin@example.com",
      slug: "unauthorized-project",
    });

    const projectRepository = createInMemoryGmpRepository({ projects: [project] });
    const knowledgeRepository = createInMemoryGmpKnowledgeRepository();

    const response = await handleGetKnowledgeWorkspace(
      makeRequest(`/api/gmp/projects/${project.projectId}/knowledge`),
      project.projectId,
      {
        sessionLoader: async () => null,
        projectRepository,
        knowledgeRepository,
        knowledgeServices: createGmpKnowledgeServices({ projectRepository, knowledgeRepository }),
      },
    );

    expect(response.status).toBe(401);
  });
});
