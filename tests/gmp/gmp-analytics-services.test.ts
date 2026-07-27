import { describe, expect, it } from "@jest/globals";
import { createGmpProject } from "@/lib/gmp/models";
import { createInMemoryGmpRepository } from "@/lib/gmp/repository";
import { createInMemoryGmpAnalyticsRepository } from "@/lib/gmp/analytics-repository";
import { createGmpAnalyticsServices } from "@/lib/gmp/analytics-services";
import type { GmpAnalyticsSourceAdapter } from "@/lib/gmp/analytics-adapters";

function setup(projectCount = 1) {
  const projects = Array.from({ length: projectCount }, (_, index) => createGmpProject({
    name: `Analytics Project ${index + 1}`,
    workspaceId: "glw-led-display-warehouse",
    ownerActorId: "admin@example.com",
    slug: `analytics-project-${index + 1}-${Date.now()}-${index}`,
  }));

  const projectRepository = createInMemoryGmpRepository({ projects });
  const analyticsRepository = createInMemoryGmpAnalyticsRepository();
  const services = createGmpAnalyticsServices({ projectRepository, analyticsRepository });

  return { projects, projectRepository, analyticsRepository, services };
}

describe("gmp analytics services", () => {
  it("blocks collection when required outputs are missing", async () => {
    const { projects, services } = setup();
    const project = projects[0]!;

    const source = await services.createSource({
      projectId: project.projectId,
      sourceType: "FIXTURE",
      sourceName: "Fixture Source",
      capabilities: {
        sessions: true,
        conversions: true,
        revenue: false,
      },
    });

    const eligibility = await services.evaluateCollectionEligibility({
      projectId: project.projectId,
      analyticsSourceId: source!.analyticsSourceId,
      requestedMetrics: ["sessions", "conversions", "revenue"],
    });

    expect(eligibility?.eligible).toBe(false);
    expect(eligibility?.missingOutputs).toContain("revenue");

    const run = await services.runCollection({
      projectId: project.projectId,
      analyticsSourceId: source!.analyticsSourceId,
      actorId: "admin@example.com",
    });

    expect(run.collection.collectionStatus).toBe("BLOCKED");
    expect(run.observationsCreated).toBe(0);
    expect(run.normalizedMetricsCreated).toBe(0);
  });

  it("evaluates eligibility success and stable fingerprint", async () => {
    const { projects, services } = setup();
    const project = projects[0]!;

    const source = await services.createSource({
      projectId: project.projectId,
      sourceType: "FIXTURE",
      sourceName: "Fixture Source",
      capabilities: {
        sessions: true,
        conversions: true,
        revenue: true,
      },
    });

    const input = {
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      analyticsSourceId: source!.analyticsSourceId,
      collectionMode: "MANUAL" as const,
      requestedDimensions: ["date"],
      requestedMetrics: ["sessions", "conversions", "revenue"],
      periodStart: "2026-07-01T00:00:00.000Z",
      periodEnd: "2026-07-02T00:00:00.000Z",
    };

    const first = await services.evaluateCollectionEligibility(input);
    const second = await services.evaluateCollectionEligibility(input);

    expect(first?.eligible).toBe(true);
    expect(first?.inputFingerprint).toBe(second?.inputFingerprint);
  });

  it("reuses equivalent collection idempotently and links GOP execution", async () => {
    const { projects, services } = setup();
    const project = projects[0]!;

    const source = await services.createSource({
      projectId: project.projectId,
      sourceType: "FIXTURE",
      sourceName: "Fixture Source",
    });

    const first = await services.requestCollection({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      analyticsSourceId: source!.analyticsSourceId,
      actorId: "admin@example.com",
      collectionMode: "MANUAL",
      requestedDimensions: [],
      requestedMetrics: [],
    });

    const second = await services.requestCollection({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      analyticsSourceId: source!.analyticsSourceId,
      actorId: "admin@example.com",
      collectionMode: "MANUAL",
      requestedDimensions: [],
      requestedMetrics: [],
    });

    expect(first.collection.gopExecutionId).toBeTruthy();
    expect(["REUSED_ACTIVE", "REUSED_COMPLETED"]).toContain(second.idempotencyBehavior);
    expect(second.collection.analyticsCollectionId).toBe(first.collection.analyticsCollectionId);
  });

  it("preserves immutable observation dedupe and timeline ordering/version", async () => {
    const { projects, services } = setup();
    const project = projects[0]!;

    const source = await services.createSource({
      projectId: project.projectId,
      sourceType: "FIXTURE",
      sourceName: "Fixture Source",
    });

    const first = await services.requestCollection({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      analyticsSourceId: source!.analyticsSourceId,
      actorId: "admin@example.com",
      collectionMode: "MANUAL",
      requestedDimensions: [],
      requestedMetrics: [],
      forcedRecollection: true,
    });

    const second = await services.requestCollection({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      analyticsSourceId: source!.analyticsSourceId,
      actorId: "admin@example.com",
      collectionMode: "MANUAL",
      requestedDimensions: [],
      requestedMetrics: [],
      forcedRecollection: true,
    });

    expect(second.collection.observationCount).toBeLessThanOrEqual(first.collection.observationCount);

    const timeline = await services.getCollectionTimeline({ collectionId: first.collection.analyticsCollectionId, limit: 50 });
    expect(timeline?.contractVersion).toBe("gmp-analytics-timeline/v1");
    expect(timeline?.events.length).toBeGreaterThan(0);

    for (let index = 1; index < (timeline?.events.length ?? 0); index += 1) {
      const previous = timeline!.events[index - 1]!;
      const current = timeline!.events[index]!;
      expect(previous.occurredAt.localeCompare(current.occurredAt)).toBeLessThanOrEqual(0);
    }
    expect((timeline?.events ?? []).every((event) => event.eventVersion === "gmp-analytics-collection-event/v1")).toBe(true);
  });

  it("creates retry lineage and exposes retry eligibility", async () => {
    const { projects, services } = setup();
    const project = projects[0]!;

    const source = await services.createSource({
      projectId: project.projectId,
      sourceType: "GOOGLE_SEARCH_CONSOLE",
      sourceName: "GSC Fixture",
      credentialsReference: "env:GMP_FAKE_ANALYTICS_TOKEN",
      configuration: { scenario: "timeout" },
    });
    process.env.GMP_FAKE_ANALYTICS_TOKEN = "value";

    const failed = await services.requestCollection({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      analyticsSourceId: source!.analyticsSourceId,
      actorId: "admin@example.com",
      collectionMode: "MANUAL",
      requestedDimensions: [],
      requestedMetrics: [],
    });

    expect(["FAILED", "PARTIAL"]).toContain(failed.collection.collectionStatus);

    const retried = await services.retryCollection({
      workspaceId: project.workspaceId,
      collectionId: failed.collection.analyticsCollectionId,
      actorId: "admin@example.com",
      mode: "resume",
    });

    expect(retried).not.toBeNull();
    expect(retried?.collection.parentCollectionId).toBe(failed.collection.analyticsCollectionId);

    const detail = await services.getCollectionDetail(retried!.collection.analyticsCollectionId);
    expect(detail?.collection.attemptNumber).toBeGreaterThan(1);
    expect(typeof detail?.retryEligibility.eligible).toBe("boolean");
  });

  it("supports mixed valid and invalid observations with rejection accounting", async () => {
    const { projects, projectRepository, analyticsRepository } = setup();
    const project = projects[0]!;

    const customAdapter: GmpAnalyticsSourceAdapter = {
      adapterKey: "fixture.mixed",
      adapterVersion: "v1",
      sourceType: "CUSTOM",
      requiredOutputs: ["signal"],
      async describeSource(source) {
        return {
          adapterKey: this.adapterKey,
          adapterVersion: this.adapterVersion,
          sourceType: source.sourceType,
          displayName: "Mixed Fixture",
          requiredCredentials: false,
        };
      },
      async validateConnection() {
        return { ok: true, blockingIssues: [], warnings: [], adapterVersion: this.adapterVersion, validatedAt: new Date().toISOString() };
      },
      async detectCapabilities() {
        return { capabilities: ["signal"], adapterVersion: this.adapterVersion, detectedAt: new Date().toISOString(), warnings: [] };
      },
      async checkHealth() {
        return { status: "HEALTHY", latencyMs: 1, checkedAt: new Date().toISOString(), notes: [] };
      },
      async collect({ source }) {
        const ts = "2026-07-01T12:00:00.000Z";
        return {
          complete: true,
          partial: false,
          warnings: [],
          observations: [
            {
              sourceRecordIdentity: `ok:${source.analyticsSourceId}`,
              observationType: "signal",
              sourceTimestamp: ts,
              dimensions: { path: "/ok" },
              metrics: { signal: 12 },
              rawPayload: { path: "/ok", signal: 12 },
              observationKey: "signal",
              rawValue: 12,
              unit: "count",
            },
            {
              sourceRecordIdentity: `bad:${source.analyticsSourceId}`,
              observationType: "signal",
              sourceTimestamp: ts,
              dimensions: { path: "/bad" },
              metrics: { signal: 8 },
              rawPayload: { access_token: "SHOULD_NOT_PERSIST", signal: 8 },
              observationKey: "signal",
              rawValue: 8,
              unit: "count",
            },
          ],
        };
      },
      normalizeCursor(cursor) {
        return cursor ?? { page: 1 };
      },
      classifyError() {
        return {
          category: "UNKNOWN",
          summary: "unknown",
          retryable: false,
          recommendedAction: "inspect",
          adapterKey: this.adapterKey,
          adapterVersion: this.adapterVersion,
          redacted: true,
        };
      },
      redactDiagnostic(value) {
        return JSON.stringify(value);
      },
    };

    const services = createGmpAnalyticsServices({ projectRepository, analyticsRepository, sourceAdapter: customAdapter });

    const source = await services.createSource({
      projectId: project.projectId,
      sourceType: "CUSTOM",
      sourceName: "Mixed Fixture",
      adapterKey: customAdapter.adapterKey,
      adapterVersion: customAdapter.adapterVersion,
      capabilities: { signal: true },
    });

    const run = await services.requestCollection({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      analyticsSourceId: source!.analyticsSourceId,
      actorId: "admin@example.com",
      collectionMode: "MANUAL",
      requestedDimensions: [],
      requestedMetrics: ["signal"],
    });

    expect(run.collection.observationCount).toBe(1);
    expect(run.collection.rejectedObservationCount).toBe(1);
  });

  it("returns server-derived source health and enforces scope isolation", async () => {
    const { projects, services } = setup(2);
    const projectA = projects[0]!;
    const projectB = projects[1]!;

    const source = await services.createSource({
      projectId: projectA.projectId,
      sourceType: "GOOGLE_SEARCH_CONSOLE",
      sourceName: "GSC Fixture",
      credentialsReference: "env:GMP_MISSING_TOKEN",
    });

    const health = await services.getSourceHealth(source!.analyticsSourceId);
    expect(health?.credentialReferenceHealth).toBe("BLOCKED");

    const isolated = await services.evaluateCollectionEligibility({
      projectId: projectB.projectId,
      analyticsSourceId: source!.analyticsSourceId,
      requestedMetrics: [],
      requestedDimensions: [],
    });
    expect(isolated).toBeNull();
  });

  it("collects metrics and creates immutable snapshot lineage", async () => {
    const { projects, services } = setup();
    const project = projects[0]!;

    const source = await services.createSource({
      projectId: project.projectId,
      sourceType: "FIXTURE",
      sourceName: "Fixture Source",
    });

    const run = await services.runCollection({
      projectId: project.projectId,
      analyticsSourceId: source!.analyticsSourceId,
      actorId: "admin@example.com",
    });

    expect(run.collection.collectionStatus).toBe("COMPLETED");
    expect(run.observationsCreated).toBeGreaterThan(0);
    expect(run.normalizedMetricsCreated).toBeGreaterThan(0);

    const snapshot = await services.createSnapshotFromCollection({
      projectId: project.projectId,
      analyticsCollectionId: run.collection.analyticsCollectionId,
      snapshotLabel: "Daily Performance",
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.snapshot.metadata?.immutable).toBe(true);
    expect(snapshot?.metrics.length).toBeGreaterThan(0);
    expect(snapshot?.lineage.length).toBe(1);

    const detail = await services.getSnapshotDetail(snapshot!.snapshot.performanceSnapshotId);
    expect(detail?.snapshot.snapshotLabel).toBe("Daily Performance");
    expect(detail?.lineage.length).toBeGreaterThan(0);
  });
});
