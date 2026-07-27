import { describe, expect, it } from "@jest/globals";
import { createGmpProject } from "@/lib/gmp/models";
import { createInMemoryGmpRepository } from "@/lib/gmp/repository";
import { createInMemoryGmpEvidenceRepository } from "@/lib/gmp/evidence-repository";
import { createInMemoryGmpRecommendationRepository } from "@/lib/gmp/recommendation-repository";
import { createGmpRecommendationServices } from "@/lib/gmp/recommendation-services";

function setup() {
  const project = createGmpProject({
    name: "Recommendation Engine Project",
    workspaceId: "glw-led-display-warehouse",
    ownerActorId: "admin@example.com",
    slug: `recommendation-engine-${Date.now()}`,
  });

  const evidenceSnapshotId = "gmpevs_seed_1";
  const evidenceRepository = createInMemoryGmpEvidenceRepository({
    snapshots: [
      {
        evidenceSnapshotId,
        performanceSnapshotId: "gmpsnap_1",
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
        snapshotChecksum: "seed-checksum",
        sourceObservationCount: 12,
        rejectedObservationCount: 2,
        metadata: {},
        createdAt: "2026-07-08T00:00:00.000Z",
      },
    ],
    compiledMetrics: [
      {
        evidenceCompiledMetricId: "gmpecm_1",
        evidenceSnapshotId,
        projectId: project.projectId,
        siteId: "site-1",
        metricDefinitionId: "md_1",
        canonicalMetricKey: "organic_ctr",
        displayName: "Organic CTR",
        unit: "ratio",
        valueType: "PERCENT",
        aggregationMethod: "AVERAGE",
        precisionScale: 6,
        compiledValue: 0.012,
        dataQualityStatus: "PARTIAL",
        evidenceConfidence: "LOW",
        compilerVersion: "gmp-evidence-compiler/v1",
        sourceObservationIds: ["obs_1"],
        lineageFingerprint: "lineage_1",
        metadata: {},
        createdAt: "2026-07-08T00:00:00.000Z",
      },
      {
        evidenceCompiledMetricId: "gmpecm_2",
        evidenceSnapshotId,
        projectId: project.projectId,
        siteId: "site-1",
        metricDefinitionId: "md_2",
        canonicalMetricKey: "average_position",
        displayName: "Average Position",
        unit: "position",
        valueType: "NUMBER",
        aggregationMethod: "AVERAGE",
        precisionScale: 2,
        compiledValue: 23,
        dataQualityStatus: "PARTIAL",
        evidenceConfidence: "LOW",
        compilerVersion: "gmp-evidence-compiler/v1",
        sourceObservationIds: ["obs_2"],
        lineageFingerprint: "lineage_2",
        metadata: {},
        createdAt: "2026-07-08T00:00:00.000Z",
      },
      {
        evidenceCompiledMetricId: "gmpecm_3",
        evidenceSnapshotId,
        projectId: project.projectId,
        siteId: "site-1",
        metricDefinitionId: "md_3",
        canonicalMetricKey: "sessions",
        displayName: "Sessions",
        unit: "count",
        valueType: "NUMBER",
        aggregationMethod: "SUM",
        precisionScale: 0,
        compiledValue: 100,
        dataQualityStatus: "PARTIAL",
        evidenceConfidence: "LOW",
        compilerVersion: "gmp-evidence-compiler/v1",
        sourceObservationIds: ["obs_3"],
        lineageFingerprint: "lineage_3",
        metadata: {},
        createdAt: "2026-07-08T00:00:00.000Z",
      },
    ],
    publicationReferences: [
      {
        evidencePublicationReferenceId: "gmpepr_1",
        evidenceSnapshotId,
        projectId: project.projectId,
        siteId: "site-1",
        publicationRecordId: "pub_1",
        publicationIdentity: "remote-1",
        canonicalUrl: "https://example.com/a",
        publicationStatus: "draft",
        publicationTimestamp: "2026-01-01T00:00:00.000Z",
        correlationQuality: "LOW",
        matchedObservationIds: ["obs_1"],
        lineageFingerprint: "lineage_pub_1",
        metadata: {},
        createdAt: "2026-07-08T00:00:00.000Z",
      },
    ],
  });

  const projectRepository = createInMemoryGmpRepository({ projects: [project] });
  const recommendationRepository = createInMemoryGmpRecommendationRepository();
  const services = createGmpRecommendationServices({
    projectRepository,
    evidenceRepository,
    recommendationRepository,
  });

  return { project, services, evidenceSnapshotId };
}

describe("gmp recommendation services", () => {
  it("compiles deterministic recommendations from evidence snapshots only", async () => {
    const { project, services, evidenceSnapshotId } = setup();

    const compiled = await services.compileRecommendations({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      actorId: "admin@example.com",
      evidenceSnapshotId,
    });

    expect(compiled.run.runStatus).toBe("COMPLETED");
    expect(compiled.attribution.length).toBeGreaterThan(0);
    expect(compiled.recommendations.length).toBeGreaterThan(0);
    expect(compiled.recommendations.every((entry) => entry.evidenceSnapshotId === evidenceSnapshotId)).toBe(true);

    const decisionSupport = await services.listDecisionSupport({ projectId: project.projectId, evidenceSnapshotId });
    expect(decisionSupport.length).toBeGreaterThan(0);
  });

  it("replays recommendations deterministically with identical versions and snapshot", async () => {
    const { project, services, evidenceSnapshotId } = setup();

    const first = await services.compileRecommendations({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      actorId: "admin@example.com",
      evidenceSnapshotId,
    });

    const replay = await services.replayRecommendations({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      actorId: "admin@example.com",
      evidenceSnapshotId,
      ruleCatalogVersion: first.run.ruleCatalogVersion,
      attributionVersion: first.run.attributionVersion,
      replayOfRunId: first.run.recommendationRunId,
    });

    expect(replay.run.runStatus).toBe("COMPLETED");
    expect(replay.replayDeterministicMatch).toBe(true);
    expect(replay.recommendationCount).toBe(first.recommendations.length);
  });

  it("records append-only lifecycle transitions", async () => {
    const { project, services, evidenceSnapshotId } = setup();

    const compiled = await services.compileRecommendations({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      actorId: "admin@example.com",
      evidenceSnapshotId,
    });

    const recommendation = compiled.recommendations[0];
    expect(recommendation).toBeDefined();

    const reviewed = await services.reviewRecommendation({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      recommendationId: recommendation.recommendationId,
      actorId: "operator@example.com",
      state: "REVIEWED",
      reason: "Manual review completed.",
    });

    const dismissed = await services.dismissRecommendation({
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      recommendationId: recommendation.recommendationId,
      actorId: "operator@example.com",
      reason: "Out of campaign scope.",
    });

    const detail = await services.getRecommendationDetail(recommendation.recommendationId);
    expect(reviewed.lifecycleState).toBe("REVIEWED");
    expect(dismissed.lifecycleState).toBe("DISMISSED");
    expect(detail?.lifecycle.length).toBeGreaterThanOrEqual(3);
  });
});
