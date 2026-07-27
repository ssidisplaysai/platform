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
import { createInMemoryGmpEvidenceRepository } from "@/lib/gmp/evidence-repository";
import { createInMemoryGmpRecommendationRepository } from "@/lib/gmp/recommendation-repository";
import { createGmpRecommendationServices } from "@/lib/gmp/recommendation-services";
import {
  handleDecisionSupport,
  handleDismissRecommendation,
  handleGetRecommendation,
  handleListAttribution,
  handleListRecommendationCatalog,
  handleListRecommendations,
  handleRecommendationHealth,
  handleReplayRecommendations,
  handleReviewRecommendation,
} from "@/lib/gmp/recommendation-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const viewerSessionLoader = async () => ({ email: "viewer@example.com", expiresAt: Date.now() + 100000 });
const missingSessionLoader = async () => null;

async function seedRecommendationApiContext() {
  const project = createGmpProject({
    name: "Recommendation API Project",
    workspaceId: "glw-led-display-warehouse",
    ownerActorId: "admin@example.com",
    slug: `recommendation-api-project-${Date.now()}`,
  });

  const foreignProject = createGmpProject({
    name: "Foreign Recommendation Project",
    workspaceId: "foreign-workspace",
    ownerActorId: "admin@example.com",
    slug: `recommendation-api-foreign-${Date.now()}`,
  });

  const evidenceSnapshotId = "gmpevs_api_seed_1";
  const evidenceRepository = createInMemoryGmpEvidenceRepository({
    snapshots: [
      {
        evidenceSnapshotId,
        performanceSnapshotId: "gmpsnap_api_1",
        workspaceId: project.workspaceId,
        projectId: project.projectId,
        siteId: "site-1",
        cadence: "WEEKLY",
        periodStart: "2026-07-01T00:00:00.000Z",
        periodEnd: "2026-07-07T23:59:59.000Z",
        compilerVersion: "gmp-evidence-compiler/v1",
        normalizationVersion: "gmp-evidence-normalization/v1",
        metricCatalogVersion: "gmp-evidence-metric-catalog/v1",
        correlationVersion: "gmp-evidence-correlation/v1",
        snapshotVersion: "gmp-evidence-snapshot/v1",
        validationVersion: "gmp-evidence-validation/v1",
        dataQualityStatus: "PARTIAL",
        evidenceConfidence: "LOW",
        snapshotChecksum: "api-seed-checksum",
        sourceObservationCount: 9,
        rejectedObservationCount: 1,
        metadata: {},
        createdAt: "2026-07-08T00:00:00.000Z",
      },
    ],
    compiledMetrics: [
      {
        evidenceCompiledMetricId: "gmpecm_api_1",
        evidenceSnapshotId,
        projectId: project.projectId,
        siteId: "site-1",
        metricDefinitionId: "md_api_1",
        canonicalMetricKey: "organic_ctr",
        displayName: "Organic CTR",
        unit: "ratio",
        valueType: "PERCENT",
        aggregationMethod: "AVERAGE",
        precisionScale: 6,
        compiledValue: 0.01,
        dataQualityStatus: "PARTIAL",
        evidenceConfidence: "LOW",
        compilerVersion: "gmp-evidence-compiler/v1",
        sourceObservationIds: ["obs_api_1"],
        lineageFingerprint: "lineage_api_1",
        metadata: {},
        createdAt: "2026-07-08T00:00:00.000Z",
      },
    ],
    publicationReferences: [
      {
        evidencePublicationReferenceId: "gmpepr_api_1",
        evidenceSnapshotId,
        projectId: project.projectId,
        siteId: "site-1",
        publicationRecordId: "pub_api_1",
        publicationIdentity: "remote-api-1",
        canonicalUrl: "https://example.com/api",
        publicationStatus: "draft",
        publicationTimestamp: "2026-01-01T00:00:00.000Z",
        correlationQuality: "LOW",
        matchedObservationIds: ["obs_api_1"],
        lineageFingerprint: "lineage_pub_api_1",
        metadata: {},
        createdAt: "2026-07-08T00:00:00.000Z",
      },
    ],
  });

  const projectRepository = createInMemoryGmpRepository({ projects: [project, foreignProject] });
  const recommendationRepository = createInMemoryGmpRecommendationRepository();
  const recommendationServices = createGmpRecommendationServices({
    projectRepository,
    evidenceRepository,
    recommendationRepository,
  });

  return { project, foreignProject, evidenceSnapshotId, projectRepository, recommendationRepository, recommendationServices };
}

describe("gmp recommendation api", () => {
  it("enforces authentication and default-deny mutation actions", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const seeded = await seedRecommendationApiContext();

    const unauthenticated = await handleListRecommendations(
      makeRequest(`/api/gmp/recommendations?projectId=${seeded.project.projectId}`),
      { sessionLoader: missingSessionLoader as never, ...seeded },
    );
    expect(unauthenticated.status).toBe(401);

    const viewerDenied = await handleReplayRecommendations(
      makeRequest("/api/gmp/recommendations/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: seeded.project.projectId,
          evidenceSnapshotId: seeded.evidenceSnapshotId,
        }),
      }),
      { sessionLoader: viewerSessionLoader, ...seeded },
    );
    expect(viewerDenied.status).toBe(403);
  });

  it("supports replay, read endpoints, lifecycle review, and workspace isolation", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const seeded = await seedRecommendationApiContext();
    const deps = { sessionLoader: adminSessionLoader, ...seeded };

    const foreignRead = await handleListRecommendations(
      makeRequest(`/api/gmp/recommendations?workspaceId=glw-led-display-warehouse&projectId=${seeded.foreignProject.projectId}`),
      deps,
    );
    expect(foreignRead.status).toBe(404);

    const replay = await handleReplayRecommendations(
      makeRequest("/api/gmp/recommendations/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: seeded.project.projectId,
          evidenceSnapshotId: seeded.evidenceSnapshotId,
        }),
      }),
      deps,
    );
    expect(replay.status).toBe(201);

    const recommendations = await handleListRecommendations(
      makeRequest(`/api/gmp/recommendations?projectId=${seeded.project.projectId}`),
      deps,
    );
    expect(recommendations.status).toBe(200);
    const recommendationPayload = await recommendations.json() as { recommendations: Array<{ recommendationId: string }> };
    expect(recommendationPayload.recommendations.length).toBeGreaterThan(0);

    const recommendationId = recommendationPayload.recommendations[0].recommendationId;

    const detail = await handleGetRecommendation(
      makeRequest(`/api/gmp/recommendations/${recommendationId}`),
      recommendationId,
      deps,
    );
    expect(detail.status).toBe(200);

    const catalog = await handleListRecommendationCatalog(
      makeRequest(`/api/gmp/recommendations/catalog?projectId=${seeded.project.projectId}`),
      deps,
    );
    expect(catalog.status).toBe(200);

    const attribution = await handleListAttribution(
      makeRequest(`/api/gmp/attribution?projectId=${seeded.project.projectId}`),
      deps,
    );
    expect(attribution.status).toBe(200);

    const decision = await handleDecisionSupport(
      makeRequest(`/api/gmp/decision-support?projectId=${seeded.project.projectId}`),
      deps,
    );
    expect(decision.status).toBe(200);

    const health = await handleRecommendationHealth(
      makeRequest(`/api/gmp/recommendations/health?projectId=${seeded.project.projectId}`),
      deps,
    );
    expect(health.status).toBe(200);

    const reviewed = await handleReviewRecommendation(
      makeRequest("/api/gmp/recommendations/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: seeded.project.projectId,
          recommendationId,
          state: "REVIEWED",
          reason: "Reviewed by operator",
        }),
      }),
      deps,
    );
    expect(reviewed.status).toBe(201);

    const dismissed = await handleDismissRecommendation(
      makeRequest("/api/gmp/recommendations/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: seeded.project.projectId,
          recommendationId,
          reason: "Dismissed due to scope",
        }),
      }),
      deps,
    );
    expect(dismissed.status).toBe(201);
  });
});
