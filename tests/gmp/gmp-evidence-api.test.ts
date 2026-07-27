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
import { createInMemoryGmpAnalyticsRepository } from "@/lib/gmp/analytics-repository";
import { createInMemoryGmpPublishingRepository } from "@/lib/gmp/publishing-repository";
import { createInMemoryGmpEvidenceRepository } from "@/lib/gmp/evidence-repository";
import { createGmpEvidenceServices } from "@/lib/gmp/evidence-services";
import {
  handleGetEvidenceSnapshot,
  handleListEvidenceMetrics,
  handleListEvidencePublications,
  handleListEvidenceSnapshots,
  handleRecompileEvidence,
} from "@/lib/gmp/evidence-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const viewerSessionLoader = async () => ({ email: "viewer@example.com", expiresAt: Date.now() + 100000 });
const missingSessionLoader = async () => null;

async function seedEvidenceApiContext() {
  const project = createGmpProject({
    name: "Evidence API Project",
    workspaceId: "glw-led-display-warehouse",
    ownerActorId: "admin@example.com",
    slug: `evidence-api-project-${Date.now()}`,
  });

  const foreignProject = createGmpProject({
    name: "Foreign Evidence Project",
    workspaceId: "foreign-workspace",
    ownerActorId: "admin@example.com",
    slug: `evidence-api-foreign-${Date.now()}`,
  });

  const projectRepository = createInMemoryGmpRepository({ projects: [project, foreignProject] });
  const analyticsRepository = createInMemoryGmpAnalyticsRepository();
  const publishingRepository = createInMemoryGmpPublishingRepository();
  const evidenceRepository = createInMemoryGmpEvidenceRepository();
  const evidenceServices = createGmpEvidenceServices({
    projectRepository,
    analyticsRepository,
    publishingRepository,
    evidenceRepository,
  });

  return { project, foreignProject, projectRepository, evidenceRepository, evidenceServices };
}

describe("gmp evidence api", () => {
  it("enforces authentication and default-deny compiler execution", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const seeded = await seedEvidenceApiContext();

    const unauthenticated = await handleListEvidenceSnapshots(
      makeRequest(`/api/gmp/evidence/snapshots?projectId=${seeded.project.projectId}`),
      { sessionLoader: missingSessionLoader as never, ...seeded },
    );
    expect(unauthenticated.status).toBe(401);

    const denied = await handleRecompileEvidence(
      makeRequest("/api/gmp/evidence/recompile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: seeded.project.projectId }),
      }),
      { sessionLoader: viewerSessionLoader, ...seeded },
    );
    expect(denied.status).toBe(403);
  });

  it("enforces workspace isolation and supports snapshot/metrics/publications endpoints", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const seeded = await seedEvidenceApiContext();
    const deps = { sessionLoader: adminSessionLoader, ...seeded };

    const foreignRead = await handleListEvidenceSnapshots(
      makeRequest(`/api/gmp/evidence/snapshots?workspaceId=glw-led-display-warehouse&projectId=${seeded.foreignProject.projectId}`),
      deps,
    );
    expect(foreignRead.status).toBe(404);

    const compile = await handleRecompileEvidence(
      makeRequest("/api/gmp/evidence/recompile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: seeded.project.projectId,
          periodStart: "2026-07-01T00:00:00.000Z",
          periodEnd: "2026-07-07T23:59:59.000Z",
          cadence: "WEEKLY",
        }),
      }),
      deps,
    );

    expect(compile.status).toBe(201);
    const compilePayload = await compile.json() as { snapshot: { evidenceSnapshotId: string } };

    const snapshots = await handleListEvidenceSnapshots(
      makeRequest(`/api/gmp/evidence/snapshots?projectId=${seeded.project.projectId}`),
      deps,
    );
    expect(snapshots.status).toBe(200);

    const metrics = await handleListEvidenceMetrics(
      makeRequest(`/api/gmp/evidence/metrics?projectId=${seeded.project.projectId}&snapshotId=${compilePayload.snapshot.evidenceSnapshotId}`),
      deps,
    );
    expect(metrics.status).toBe(200);

    const publications = await handleListEvidencePublications(
      makeRequest(`/api/gmp/evidence/publications?projectId=${seeded.project.projectId}&snapshotId=${compilePayload.snapshot.evidenceSnapshotId}`),
      deps,
    );
    expect(publications.status).toBe(200);

    const snapshotDetail = await handleGetEvidenceSnapshot(
      makeRequest(`/api/gmp/evidence/snapshots/${compilePayload.snapshot.evidenceSnapshotId}`),
      compilePayload.snapshot.evidenceSnapshotId,
      deps,
    );
    expect(snapshotDetail.status).toBe(200);
  });
});
