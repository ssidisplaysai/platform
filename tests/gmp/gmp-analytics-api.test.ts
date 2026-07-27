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
import { createGmpAnalyticsServices } from "@/lib/gmp/analytics-services";
import {
  handleCreateAnalyticsCollection,
  handleCreateAnalyticsSource,
  handleGetAnalyticsCollection,
  handleGetAnalyticsCollectionTimeline,
  handleGetAnalyticsSnapshot,
  handleGetAnalyticsSourceCapabilities,
  handleGetAnalyticsSource,
  handleGetAnalyticsSourceHealth,
  handleRetryAnalyticsCollection,
  handleValidateAnalyticsSource,
  handleListAnalyticsCollections,
  handleListAnalyticsSnapshots,
  handleListAnalyticsSources,
} from "@/lib/gmp/analytics-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const viewerSessionLoader = async () => ({ email: "viewer@example.com", expiresAt: Date.now() + 100000 });
const missingSessionLoader = async () => null;

async function seedAnalyticsApiContext() {
  const project = createGmpProject({
    name: "Analytics API Project",
    workspaceId: "glw-led-display-warehouse",
    ownerActorId: "admin@example.com",
    slug: `analytics-api-project-${Date.now()}`,
  });

  const foreignProject = createGmpProject({
    name: "Foreign Workspace Project",
    workspaceId: "foreign-workspace",
    ownerActorId: "admin@example.com",
    slug: `analytics-api-foreign-${Date.now()}`,
  });

  const projectRepository = createInMemoryGmpRepository({ projects: [project, foreignProject] });
  const analyticsRepository = createInMemoryGmpAnalyticsRepository();
  const analyticsServices = createGmpAnalyticsServices({ projectRepository, analyticsRepository });

  return { project, foreignProject, projectRepository, analyticsRepository, analyticsServices };
}

describe("gmp analytics api", () => {
  it("enforces authentication and default deny", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const seeded = await seedAnalyticsApiContext();

    const unauthenticated = await handleListAnalyticsSources(
      makeRequest(`/api/gmp/analytics/sources?projectId=${seeded.project.projectId}`),
      { sessionLoader: missingSessionLoader as never, ...seeded },
    );
    expect(unauthenticated.status).toBe(401);

    const viewerDenied = await handleCreateAnalyticsSource(
      makeRequest("/api/gmp/analytics/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: seeded.project.projectId, sourceType: "FIXTURE", sourceName: "Denied" }),
      }),
      { sessionLoader: viewerSessionLoader, ...seeded },
    );
    expect(viewerDenied.status).toBe(403);
  });

  it("enforces workspace/project isolation and non-disclosing not-found behavior", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const seeded = await seedAnalyticsApiContext();
    const deps = { sessionLoader: adminSessionLoader, ...seeded };

    const foreignProjectRead = await handleListAnalyticsSources(
      makeRequest(`/api/gmp/analytics/sources?workspaceId=glw-led-display-warehouse&projectId=${seeded.foreignProject.projectId}`),
      deps,
    );
    expect(foreignProjectRead.status).toBe(404);

    const unknownSource = await handleGetAnalyticsSource(
      makeRequest("/api/gmp/analytics/sources/does-not-exist"),
      "does-not-exist",
      deps,
    );
    expect(unknownSource.status).toBe(404);
    expect((await unknownSource.json() as { error: string }).error).toContain("not found");
  });

  it("creates, validates, inspects source diagnostics, and redacts secrets", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    process.env.GMP_TEST_ANALYTICS_SECRET = "super-secret-token";
    const seeded = await seedAnalyticsApiContext();
    const deps = { sessionLoader: adminSessionLoader, ...seeded };

    const create = await handleCreateAnalyticsSource(
      makeRequest("/api/gmp/analytics/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: seeded.project.projectId,
          sourceType: "GOOGLE_ANALYTICS_4",
          sourceName: "GA4 Fixture",
          credentialsReference: "env:GMP_TEST_ANALYTICS_SECRET",
          configuration: {
            service_account: "sensitive",
            note: "kept",
          },
        }),
      }),
      deps,
    );
    expect(create.status).toBe(201);

    const sourceId = (await create.json() as { source: { analyticsSourceId: string } }).source.analyticsSourceId;

    const validate = await handleValidateAnalyticsSource(
      makeRequest(`/api/gmp/analytics/sources/${sourceId}/validate`, { method: "POST" }),
      sourceId,
      deps,
    );
    expect(validate.status).toBe(200);

    const capabilities = await handleGetAnalyticsSourceCapabilities(
      makeRequest(`/api/gmp/analytics/sources/${sourceId}/capabilities`),
      sourceId,
      deps,
    );
    expect(capabilities.status).toBe(200);

    const health = await handleGetAnalyticsSourceHealth(
      makeRequest(`/api/gmp/analytics/sources/${sourceId}/health`),
      sourceId,
      deps,
    );
    expect(health.status).toBe(200);

    const healthPayload = await health.json() as { health: Record<string, unknown> };
    const healthText = JSON.stringify(healthPayload);
    expect(healthText).not.toContain("super-secret-token");
    expect(healthText).not.toContain("service_account");
  });

  it("creates collection, returns typed timeline page, and supports bounded retrieval", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const seeded = await seedAnalyticsApiContext();
    const deps = { sessionLoader: adminSessionLoader, ...seeded };

    const sourceResponse = await handleCreateAnalyticsSource(
      makeRequest("/api/gmp/analytics/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: seeded.project.projectId, sourceType: "FIXTURE", sourceName: "Fixture Source" }),
      }),
      deps,
    );
    const sourceId = (await sourceResponse.json() as { source: { analyticsSourceId: string } }).source.analyticsSourceId;

    const collect = await handleCreateAnalyticsCollection(
      makeRequest("/api/gmp/analytics/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: seeded.project.projectId,
          analyticsSourceId: sourceId,
          requestedMetrics: [],
          requestedDimensions: [],
          collectionMode: "MANUAL",
        }),
      }),
      deps,
    );

    expect(collect.status).toBe(201);
    const collectPayload = await collect.json() as { collection: { analyticsCollectionId: string; collectionStatus: string }; snapshot: { snapshot: { performanceSnapshotId: string } } | null };
    const collectionId = collectPayload.collection.analyticsCollectionId;
    expect(["COMPLETED", "COMPLETED_WITH_WARNINGS", "PARTIAL", "FAILED"]).toContain(collectPayload.collection.collectionStatus);

    const detail = await handleGetAnalyticsCollection(
      makeRequest(`/api/gmp/analytics/collections/${collectionId}`),
      collectionId,
      deps,
    );
    expect(detail.status).toBe(200);

    const timeline = await handleGetAnalyticsCollectionTimeline(
      makeRequest(`/api/gmp/analytics/collections/${collectionId}/timeline?limit=5`),
      collectionId,
      deps,
    );
    expect(timeline.status).toBe(200);

    const timelinePayload = await timeline.json() as {
      contractVersion: string;
      events: Array<{ eventVersion: string; timelineContractVersion?: string; eventType: string }>;
      nextCursor?: { occurredAt: string; analyticsCollectionEventId: string };
    };
    expect(timelinePayload.contractVersion).toBe("gmp-analytics-timeline/v1");
    expect(timelinePayload.events.length).toBeLessThanOrEqual(5);
    expect(timelinePayload.events.every((event) => event.eventVersion === "gmp-analytics-collection-event/v1")).toBe(true);
    expect(timelinePayload.events.every((event) => event.timelineContractVersion === "gmp-analytics-timeline/v1")).toBe(true);

    if (timelinePayload.nextCursor) {
      const nextPage = await handleGetAnalyticsCollectionTimeline(
        makeRequest(`/api/gmp/analytics/collections/${collectionId}/timeline?limit=5&afterOccurredAt=${encodeURIComponent(timelinePayload.nextCursor.occurredAt)}&afterEventId=${encodeURIComponent(timelinePayload.nextCursor.analyticsCollectionEventId)}`),
        collectionId,
        deps,
      );
      expect(nextPage.status).toBe(200);
    }

    if (collectPayload.snapshot) {
      const snapshotDetail = await handleGetAnalyticsSnapshot(
        makeRequest(`/api/gmp/analytics/snapshots/${collectPayload.snapshot.snapshot.performanceSnapshotId}`),
        collectPayload.snapshot.snapshot.performanceSnapshotId,
        deps,
      );
      expect(snapshotDetail.status).toBe(200);
    }
  });

  it("supports retry rejection and allowed retry paths with safe responses", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    process.env.GMP_RETRY_SECRET = "retry-secret";
    const seeded = await seedAnalyticsApiContext();
    const deps = { sessionLoader: adminSessionLoader, ...seeded };

    const sourceResponse = await handleCreateAnalyticsSource(
      makeRequest("/api/gmp/analytics/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: seeded.project.projectId,
          sourceType: "GOOGLE_SEARCH_CONSOLE",
          sourceName: "GSC Fixture",
          credentialsReference: "env:GMP_RETRY_SECRET",
          configuration: { scenario: "timeout" },
        }),
      }),
      deps,
    );
    const sourceId = (await sourceResponse.json() as { source: { analyticsSourceId: string } }).source.analyticsSourceId;

    const failedCollection = await handleCreateAnalyticsCollection(
      makeRequest("/api/gmp/analytics/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: seeded.project.projectId, analyticsSourceId: sourceId, collectionMode: "MANUAL" }),
      }),
      deps,
    );
    const failedPayload = await failedCollection.json() as { collection: { analyticsCollectionId: string; collectionStatus: string } };

    const retry = await handleRetryAnalyticsCollection(
      makeRequest(`/api/gmp/analytics/collections/${failedPayload.collection.analyticsCollectionId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "resume" }),
      }),
      failedPayload.collection.analyticsCollectionId,
      deps,
    );

    expect([201, 409]).toContain(retry.status);

    const nonRetryableSource = await handleCreateAnalyticsSource(
      makeRequest("/api/gmp/analytics/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: seeded.project.projectId, sourceType: "FIXTURE", sourceName: "Fixture Source" }),
      }),
      deps,
    );
    const nonRetryableSourceId = (await nonRetryableSource.json() as { source: { analyticsSourceId: string } }).source.analyticsSourceId;

    const completedCollection = await handleCreateAnalyticsCollection(
      makeRequest("/api/gmp/analytics/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: seeded.project.projectId, analyticsSourceId: nonRetryableSourceId, collectionMode: "MANUAL" }),
      }),
      deps,
    );
    const completedPayload = await completedCollection.json() as { collection: { analyticsCollectionId: string; collectionStatus: string } };

    if (completedPayload.collection.collectionStatus === "COMPLETED") {
      const blockedRetry = await handleRetryAnalyticsCollection(
        makeRequest(`/api/gmp/analytics/collections/${completedPayload.collection.analyticsCollectionId}/retry`, { method: "POST" }),
        completedPayload.collection.analyticsCollectionId,
        deps,
      );
      expect(blockedRetry.status).toBe(409);
    }
  });

  it("keeps existing list endpoints operational", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const seeded = await seedAnalyticsApiContext();
    const deps = { sessionLoader: adminSessionLoader, ...seeded };

    const listSources = await handleListAnalyticsSources(
      makeRequest(`/api/gmp/analytics/sources?projectId=${seeded.project.projectId}`),
      deps,
    );
    expect(listSources.status).toBe(200);

    const listCollections = await handleListAnalyticsCollections(
      makeRequest(`/api/gmp/analytics/collections?projectId=${seeded.project.projectId}`),
      deps,
    );
    expect(listCollections.status).toBe(200);

    const listSnapshots = await handleListAnalyticsSnapshots(
      makeRequest(`/api/gmp/analytics/snapshots?projectId=${seeded.project.projectId}`),
      deps,
    );
    expect(listSnapshots.status).toBe(200);
  });
});
