import { describe, expect, it } from "@jest/globals";
import { createGmpProject } from "@/lib/gmp/models";
import { createInMemoryGmpRepository } from "@/lib/gmp/repository";
import { createInMemoryGmpAnalyticsRepository } from "@/lib/gmp/analytics-repository";
import { createInMemoryGmpPublishingRepository } from "@/lib/gmp/publishing-repository";
import { createInMemoryGmpEvidenceRepository } from "@/lib/gmp/evidence-repository";
import { createGmpEvidenceServices } from "@/lib/gmp/evidence-services";
import { stableAnalyticsFingerprint } from "@/lib/gmp/analytics-models";

function setup() {
  const project = createGmpProject({
    name: "Evidence Compiler Project",
    workspaceId: "glw-led-display-warehouse",
    ownerActorId: "admin@example.com",
    slug: `evidence-compiler-${Date.now()}`,
  });

  const projectRepository = createInMemoryGmpRepository({ projects: [project] });
  const analyticsRepository = createInMemoryGmpAnalyticsRepository();
  const publishingRepository = createInMemoryGmpPublishingRepository();
  const evidenceRepository = createInMemoryGmpEvidenceRepository();

  const evidenceServices = createGmpEvidenceServices({
    projectRepository,
    analyticsRepository,
    publishingRepository,
    evidenceRepository,
  });

  return {
    project,
    analyticsRepository,
    publishingRepository,
    evidenceServices,
  };
}

describe("gmp evidence compiler services", () => {
  it("compiles immutable evidence snapshots, metrics, and publication correlations", async () => {
    const { project, analyticsRepository, publishingRepository, evidenceServices } = setup();

    const collection = await analyticsRepository.createCollection({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      analyticsSourceId: "src_gsc",
      siteId: "site-1",
      collectionStatus: "COMPLETED",
      requestedPeriodStart: "2026-01-01T00:00:00.000Z",
      requestedPeriodEnd: "2026-12-31T23:59:59.000Z",
      requestedDimensions: ["date", "page"],
      requestedMetrics: ["impressions", "clicks", "ctr", "sessions", "users", "engaged_sessions", "conversions"],
      collectionMode: "MANUAL",
      gopExecutionId: "exec_1",
      attemptNumber: 1,
      parentCollectionId: undefined,
      sourceCursor: undefined,
      nextCursor: undefined,
      idempotencyKey: "idem_1",
      inputFingerprint: "fingerprint_1",
      adapterKey: "fixture.gsc",
      adapterVersion: "v1",
      requestedBy: "admin@example.com",
      startedAt: "2026-01-01T12:00:00.000Z",
      completedAt: "2026-01-01T12:01:00.000Z",
      failedAt: undefined,
      collectionWindowStart: "2026-01-01T00:00:00.000Z",
      collectionWindowEnd: "2026-12-31T23:59:59.000Z",
      eligibilityVersion: "gmp-analytics-eligibility/v1",
      errorCategory: undefined,
      errorSummary: undefined,
      warningCount: 0,
      observationCount: 3,
      rejectedObservationCount: 0,
      partialFailureCount: 0,
      forcedRecollection: false,
      blockingIssues: [],
      warnings: [],
      metadata: {},
    });

    const sourceTimestamp = "2026-01-05T12:00:00.000Z";
    const basePayload = { dimensions: { page: "/products/led", canonicalUrl: "https://example.com/posts/demo", date: "2026-01-05" }, metrics: { sessions: 120 } };
    await analyticsRepository.createObservation({
      projectId: project.projectId,
      analyticsSourceId: "src_gsc",
      analyticsCollectionId: collection.analyticsCollectionId,
      sourceRecordIdentity: "sessions:1",
      observationType: "sessions",
      sourceTimestamp,
      observationPeriodStart: sourceTimestamp,
      observationPeriodEnd: sourceTimestamp,
      dimensions: basePayload.dimensions,
      metrics: { sessions: 120 },
      rawPayloadChecksum: stableAnalyticsFingerprint({ sourceRecordIdentity: "sessions:1", sourceTimestamp, rawPayload: basePayload }),
      rawPayload: basePayload,
      rawPayloadReference: undefined,
      providerBatchId: "batch-1",
      providerCursor: undefined,
      collectionExecutionId: "exec_1",
      dataQualityStatus: "VALID",
      diagnosticSummary: undefined,
      ingestedAt: "2026-01-05T12:05:00.000Z",
      supersededByObservationId: undefined,
      correctedFromObservationId: undefined,
      observedAt: sourceTimestamp,
      observationKey: "sessions",
      dimensionKey: undefined,
      rawValue: 120,
      unit: "count",
      confidenceScore: 0.95,
      metadata: {},
    });

    const clickPayload = { dimensions: { page: "/products/led", canonicalUrl: "https://example.com/posts/demo", date: "2026-01-05" }, metrics: { clicks: 42 } };
    await analyticsRepository.createObservation({
      projectId: project.projectId,
      analyticsSourceId: "src_gsc",
      analyticsCollectionId: collection.analyticsCollectionId,
      sourceRecordIdentity: "clicks:1",
      observationType: "clicks",
      sourceTimestamp,
      observationPeriodStart: sourceTimestamp,
      observationPeriodEnd: sourceTimestamp,
      dimensions: clickPayload.dimensions,
      metrics: { clicks: 42 },
      rawPayloadChecksum: stableAnalyticsFingerprint({ sourceRecordIdentity: "clicks:1", sourceTimestamp, rawPayload: clickPayload }),
      rawPayload: clickPayload,
      rawPayloadReference: undefined,
      providerBatchId: "batch-1",
      providerCursor: undefined,
      collectionExecutionId: "exec_1",
      dataQualityStatus: "VALID",
      diagnosticSummary: undefined,
      ingestedAt: "2026-01-05T12:05:00.000Z",
      supersededByObservationId: undefined,
      correctedFromObservationId: undefined,
      observedAt: sourceTimestamp,
      observationKey: "clicks",
      dimensionKey: undefined,
      rawValue: 42,
      unit: "count",
      confidenceScore: 0.95,
      metadata: {},
    });

    await publishingRepository.createPublicationRecord({
      projectId: project.projectId,
      siteId: "site-1",
      pageId: "page-1",
      publishingPackageId: "pkg-1",
      releaseId: "rel-1",
      destinationId: "dest-1",
      externalObjectType: "post",
      externalObjectId: "remote-1",
      externalRevisionId: "r1",
      externalUrl: "https://example.com/posts/demo",
      publishedStatus: "published",
      publishedAt: "2026-07-01T12:00:00.000Z",
      updatedAt: "2026-07-01T12:00:00.000Z",
      verifiedAt: null,
      remoteContentFingerprint: "remote-fp",
      expectedContentFingerprint: "expected-fp",
      verificationStatus: "PENDING",
      supersedesPublicationRecordId: undefined,
      rolledBackFromRecordId: undefined,
      metadata: {},
    });

    const result = await evidenceServices.recompileEvidence({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      actorId: "admin@example.com",
      periodStart: "2026-01-01T00:00:00.000Z",
      periodEnd: "2026-12-31T23:59:59.000Z",
      cadence: "MONTHLY",
    });

    expect(result.run.runStatus).toBe("COMPLETED");
    expect(result.snapshot.snapshotChecksum).toBeTruthy();
    expect(result.metrics.length).toBeGreaterThan(0);
    expect(result.publications.length).toBeGreaterThan(0);
    expect(result.snapshot.dataQualityStatus).not.toBe("UNRESOLVED");
    expect(result.snapshot.evidenceConfidence).not.toBe("UNKNOWN");

    const detail = await evidenceServices.getSnapshotDetail(result.snapshot.evidenceSnapshotId);
    expect(detail).not.toBeNull();
    expect(detail?.metrics.length).toBe(result.metrics.length);
    expect(detail?.publications.length).toBe(result.publications.length);
  });

  it("replays deterministically with identical input and creates a new immutable snapshot", async () => {
    const { project, analyticsRepository, evidenceServices } = setup();

    const collection = await analyticsRepository.createCollection({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      analyticsSourceId: "src_ga4",
      siteId: "site-1",
      collectionStatus: "COMPLETED",
      requestedPeriodStart: "2026-01-01T00:00:00.000Z",
      requestedPeriodEnd: "2026-12-31T23:59:59.000Z",
      requestedDimensions: ["date"],
      requestedMetrics: ["sessions"],
      collectionMode: "MANUAL",
      gopExecutionId: "exec_2",
      attemptNumber: 1,
      parentCollectionId: undefined,
      sourceCursor: undefined,
      nextCursor: undefined,
      idempotencyKey: "idem_2",
      inputFingerprint: "fingerprint_2",
      adapterKey: "fixture.ga4",
      adapterVersion: "v1",
      requestedBy: "admin@example.com",
      startedAt: "2026-01-02T12:00:00.000Z",
      completedAt: "2026-01-02T12:01:00.000Z",
      failedAt: undefined,
      collectionWindowStart: "2026-01-01T00:00:00.000Z",
      collectionWindowEnd: "2026-12-31T23:59:59.000Z",
      eligibilityVersion: "gmp-analytics-eligibility/v1",
      errorCategory: undefined,
      errorSummary: undefined,
      warningCount: 0,
      observationCount: 1,
      rejectedObservationCount: 0,
      partialFailureCount: 0,
      forcedRecollection: false,
      blockingIssues: [],
      warnings: [],
      metadata: {},
    });

    const sourceTimestamp = "2026-01-06T12:00:00.000Z";
    const payload = { dimensions: { date: "2026-01-06" }, metrics: { sessions: 200 } };
    await analyticsRepository.createObservation({
      projectId: project.projectId,
      analyticsSourceId: "src_ga4",
      analyticsCollectionId: collection.analyticsCollectionId,
      sourceRecordIdentity: "sessions:200",
      observationType: "sessions",
      sourceTimestamp,
      observationPeriodStart: sourceTimestamp,
      observationPeriodEnd: sourceTimestamp,
      dimensions: payload.dimensions,
      metrics: payload.metrics,
      rawPayloadChecksum: stableAnalyticsFingerprint({ sourceRecordIdentity: "sessions:200", sourceTimestamp, rawPayload: payload }),
      rawPayload: payload,
      rawPayloadReference: undefined,
      providerBatchId: "batch-2",
      providerCursor: undefined,
      collectionExecutionId: "exec_2",
      dataQualityStatus: "VALID",
      diagnosticSummary: undefined,
      ingestedAt: "2026-01-06T12:05:00.000Z",
      supersededByObservationId: undefined,
      correctedFromObservationId: undefined,
      observedAt: sourceTimestamp,
      observationKey: "sessions",
      dimensionKey: undefined,
      rawValue: 200,
      unit: "count",
      confidenceScore: 0.98,
      metadata: {},
    });

    const periodStart = "2026-01-01T00:00:00.000Z";
    const periodEnd = "2026-12-31T23:59:59.000Z";

    const first = await evidenceServices.recompileEvidence({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      actorId: "admin@example.com",
      periodStart,
      periodEnd,
      cadence: "DAILY",
    });

    const second = await evidenceServices.recompileEvidence({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      actorId: "admin@example.com",
      periodStart,
      periodEnd,
      cadence: "DAILY",
      replayOfRunId: first.run.evidenceCompilerRunId,
    });

    expect(second.replayDeterministicMatch).toBe(true);
    expect(second.snapshot.snapshotChecksum).toBe(first.snapshot.snapshotChecksum);
    expect(second.snapshot.evidenceSnapshotId).not.toBe(first.snapshot.evidenceSnapshotId);

    const snapshots = await evidenceServices.listSnapshots(project.projectId);
    expect(snapshots.length).toBeGreaterThanOrEqual(2);
  });
});
