import { describe, expect, it } from "@jest/globals";
import { jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "mocked.session.token" }),
    set: () => undefined,
    delete: () => undefined,
  }),
}), { virtual: true });

import {
  createGmpProject,
} from "@/lib/gmp/models";
import {
  handleArchiveConnection,
  handleCreateConnection,
  handleCreateProject,
  handleCreateSite,
  handleGetProject,
  handleListConnections,
  handleListProjects,
  handleProjectDashboard,
  handleUpdateSite,
} from "@/lib/gmp/api";
import { createInMemoryGmpRepository } from "@/lib/gmp/repository";
import { createInMemoryGmpKnowledgeRepository } from "@/lib/gmp/knowledge-repository";
import { createInMemoryGmpPageRepository } from "@/lib/gmp/page-repository";

type Session = { email: string; expiresAt: number };

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

function adminSessionLoader(): Promise<Session> {
  return Promise.resolve({
    email: "admin@example.com",
    expiresAt: Date.now() + 60_000,
  });
}

describe("gmp api", () => {
  it("returns unauthorized when session is missing", async () => {
    const repository = createInMemoryGmpRepository();

    const response = await handleListProjects(makeRequest("/api/gmp/projects"), {
      repository,
      sessionLoader: async () => null,
    });

    expect(response.status).toBe(401);
  });

  it("creates and lists projects in the default workspace", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const repository = createInMemoryGmpRepository();

    const createResponse = await handleCreateProject(
      makeRequest("/api/gmp/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Acme Corporate Marketing",
          slug: "acme-corp",
          organization: "Acme",
        }),
      }),
      { repository, sessionLoader: adminSessionLoader },
    );

    expect(createResponse.status).toBe(201);
    const createPayload = await createResponse.json() as { project: { projectId: string; workspaceId: string } };
    expect(createPayload.project.workspaceId).toBe("glw-led-display-warehouse");

    const listResponse = await handleListProjects(makeRequest("/api/gmp/projects"), {
      repository,
      sessionLoader: adminSessionLoader,
    });

    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json() as { projects: Array<{ projectId: string; slug: string }> };
    expect(listPayload.projects.length).toBe(1);
    expect(listPayload.projects[0]?.projectId).toBe(createPayload.project.projectId);
  });

  it("enforces workspace isolation on project detail", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const repository = createInMemoryGmpRepository();
    const foreignProject = createGmpProject({
      name: "Foreign Workspace Project",
      slug: "foreign-workspace-project",
      workspaceId: "workspace-a",
      ownerActorId: "admin@example.com",
    });
    await repository.createProject(foreignProject);

    const getWrongWorkspace = await handleGetProject(
      makeRequest("/api/gmp/projects/1"),
      foreignProject.projectId,
      { repository, sessionLoader: adminSessionLoader },
    );

    expect(getWrongWorkspace.status).toBe(404);
  });

  it("creates, updates, and lists site connections", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const repository = createInMemoryGmpRepository();

    const projectResponse = await handleCreateProject(
      makeRequest("/api/gmp/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Site Ops Project", slug: "site-ops-project" }),
      }),
      { repository, sessionLoader: adminSessionLoader },
    );

    const project = await projectResponse.json() as { project: { projectId: string } };

    const siteResponse = await handleCreateSite(
      makeRequest(`/api/gmp/projects/${project.project.projectId}/sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Main Production Site",
          primaryDomain: "example.com",
          environment: "production",
          publishingPlatform: "wordpress",
        }),
      }),
      project.project.projectId,
      { repository, sessionLoader: adminSessionLoader },
    );

    expect(siteResponse.status).toBe(201);
    const sitePayload = await siteResponse.json() as { site: { siteId: string } };

    const updateSiteResponse = await handleUpdateSite(
      makeRequest(`/api/gmp/sites/${sitePayload.site.siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "staging",
          publishingPlatform: "shopify",
          connectionStatus: "DEGRADED",
        }),
      }),
      sitePayload.site.siteId,
      { repository, sessionLoader: adminSessionLoader },
    );

    expect(updateSiteResponse.status).toBe(200);
    const updatedSitePayload = await updateSiteResponse.json() as { site: { environment: string; publishingPlatform: string; connectionStatus: string } };
    expect(updatedSitePayload.site.environment).toBe("staging");
    expect(updatedSitePayload.site.publishingPlatform).toBe("shopify");
    expect(updatedSitePayload.site.connectionStatus).toBe("DEGRADED");

    const createConnectionResponse = await handleCreateConnection(
      makeRequest(`/api/gmp/sites/${sitePayload.site.siteId}/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "shopify",
          environment: "staging",
          authenticationMethod: "token",
          publishingCapabilities: ["draft", "publish"],
        }),
      }),
      sitePayload.site.siteId,
      { repository, sessionLoader: adminSessionLoader },
    );

    expect(createConnectionResponse.status).toBe(201);
    const createConnectionPayload = await createConnectionResponse.json() as { connection: { connectionId: string } };

    const listConnectionsResponse = await handleListConnections(
      makeRequest(`/api/gmp/sites/${sitePayload.site.siteId}/connections`),
      sitePayload.site.siteId,
      { repository, sessionLoader: adminSessionLoader },
    );

    expect(listConnectionsResponse.status).toBe(200);
    const listPayload = await listConnectionsResponse.json() as { connections: Array<{ connectionId: string }> };
    expect(listPayload.connections.length).toBe(1);
    expect(listPayload.connections[0]?.connectionId).toBe(createConnectionPayload.connection.connectionId);

    const archiveResponse = await handleArchiveConnection(
      makeRequest(`/api/gmp/connections/${createConnectionPayload.connection.connectionId}`, { method: "DELETE" }),
      createConnectionPayload.connection.connectionId,
      { repository, sessionLoader: adminSessionLoader },
    );

    expect(archiveResponse.status).toBe(200);
    const archivePayload = await archiveResponse.json() as { connection: { connectionStatus: string; archivedAt: string | null } };
    expect(archivePayload.connection.connectionStatus).toBe("OFFLINE");
    expect(archivePayload.connection.archivedAt).not.toBeNull();
  });

  it("returns project dashboard payload", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const repository = createInMemoryGmpRepository();
    const knowledgeRepository = createInMemoryGmpKnowledgeRepository();
    const pageRepository = createInMemoryGmpPageRepository();

    const projectResponse = await handleCreateProject(
      makeRequest("/api/gmp/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Dashboard Project", slug: "dashboard-project" }),
      }),
      { repository, sessionLoader: adminSessionLoader },
    );

    const project = await projectResponse.json() as { project: { projectId: string } };

    const dashboardResponse = await handleProjectDashboard(
      makeRequest(`/api/gmp/projects/${project.project.projectId}/dashboard`),
      project.project.projectId,
      { repository, knowledgeRepository, pageRepository, sessionLoader: adminSessionLoader },
    );

    expect(dashboardResponse.status).toBe(200);
    const payload = await dashboardResponse.json() as {
      project: { projectId: string };
      executionSummary: { running: number; completed: number; failed: number };
      runtimeHealth: { status: string };
      queueStatus: { depth: number };
    };

    expect(payload.project.projectId).toBe(project.project.projectId);
    expect(typeof payload.executionSummary.running).toBe("number");
    expect(typeof payload.executionSummary.completed).toBe("number");
    expect(typeof payload.executionSummary.failed).toBe("number");
    expect(typeof payload.runtimeHealth.status).toBe("string");
    expect(typeof payload.queueStatus.depth).toBe("number");
  });
});
