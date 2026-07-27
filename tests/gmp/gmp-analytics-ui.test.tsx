import { describe, expect, it, jest } from "@jest/globals";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GmpAnalyticsSourceOperatorControls, GmpAnalyticsCollectionOperatorControls } from "@/components/gmp/gmp-analytics-operator-controls";
import { GmpAnalyticsWorkspace } from "@/components/gmp/gmp-analytics-workspace";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));

jest.mock("@/lib/gmp/analytics-repository", () => ({
  createPrismaGmpAnalyticsRepository: () => ({}),
}));

jest.mock("@/lib/gmp/evidence-repository", () => ({
  createPrismaGmpEvidenceRepository: () => ({}),
}));

jest.mock("@/lib/gmp/recommendation-repository", () => ({
  createPrismaGmpRecommendationRepository: () => ({}),
}));

jest.mock("@/lib/gmp/publishing-repository", () => ({
  createPrismaGmpPublishingRepository: () => ({}),
}));

jest.mock("@/lib/gmp/repository", () => ({
  createPrismaGmpRepository: () => ({}),
}));

jest.mock("@/lib/gmp/analytics-services", () => ({
  createGmpAnalyticsServices: () => ({
    listSources: async () => [{ analyticsSourceId: "src_1", sourceStatus: "ACTIVE", connectionStatus: "HEALTHY", collectionMode: "MANUAL", sourceName: "Fixture", sourceType: "FIXTURE" }],
    listCollections: async () => [{ analyticsCollectionId: "col_1", analyticsSourceId: "src_1", collectionStatus: "PARTIAL", eligibilityVersion: "gmp-analytics-eligibility/v1", blockingIssues: ["test_issue"] }],
    listSnapshots: async () => [],
    listMetricDefinitions: async () => [{ metricDefinitionId: "m1", metricKey: "sessions" }],
    ensureFoundationConfig: async () => ({ compilerVersion: { compilerVersion: "gmp-evidence-compiler/v1" }, attributionRegistryVersion: "attr_v0", recommendationRegistryVersion: "reco_v0" }),
  }),
}));

jest.mock("@/lib/gmp/evidence-services", () => ({
  createGmpEvidenceServices: () => ({
    listSnapshots: async () => [{ evidenceSnapshotId: "evs_1", cadence: "WEEKLY", periodStart: "2026-07-01T00:00:00.000Z", periodEnd: "2026-07-07T23:59:59.000Z", dataQualityStatus: "VALID", evidenceConfidence: "HIGH", sourceObservationCount: 12 }],
    listCompilerRuns: async () => [{ evidenceCompilerRunId: "run_1", triggerType: "MANUAL", cadence: "WEEKLY", createdAt: "2026-07-08T00:00:00.000Z", runStatus: "COMPLETED", qualityStatus: "VALID", confidenceStatus: "HIGH" }],
    listMetrics: async () => [{ evidenceCompiledMetricId: "m_1", canonicalMetricKey: "sessions", compiledValue: 42 }],
    listPublications: async () => [{ evidencePublicationReferenceId: "p_1", canonicalUrl: "https://example.com", publicationIdentity: "pub_1", publicationStatus: "published", correlationQuality: "HIGH", matchedObservationIds: ["obs_1"] }],
    listMetricCatalog: async () => [{ metricDefinitionId: "md_1", displayName: "Sessions", metricKey: "sessions", aggregationMethod: "SUM", valueType: "NUMBER", unit: "count" }],
  }),
}));

jest.mock("@/lib/gmp/recommendation-services", () => ({
  createGmpRecommendationServices: () => ({
    listRecommendations: async () => [],
    listAttribution: async () => [],
    listDecisionSupport: async () => [],
    listRuleCatalog: async () => [],
    getRecommendationDetail: async () => null,
  }),
}));

describe("gmp analytics ui components", () => {
  it("renders source detail controls by permission without exposing credentials", () => {
    const operator = renderToStaticMarkup(
      <GmpAnalyticsSourceOperatorControls
        workspaceId="glw-led-display-warehouse"
        projectId="proj_1"
        sourceId="src_1"
        canValidateSource
        canRunCollection
        canViewCapabilities
        canViewHealth
      />,
    );

    const viewer = renderToStaticMarkup(
      <GmpAnalyticsSourceOperatorControls
        workspaceId="glw-led-display-warehouse"
        projectId="proj_1"
        sourceId="src_1"
        canValidateSource={false}
        canRunCollection={false}
        canViewCapabilities={false}
        canViewHealth={false}
      />,
    );

    expect(operator).toContain("Validate Source");
    expect(operator).toContain("Run Collection");
    expect(operator).toContain("View Detected Capabilities");
    expect(operator).toContain("View Source Health");
    expect(operator).not.toContain("access_token");
    expect(operator).not.toContain("refresh_token");
    expect(viewer).toContain("Validate Source (unauthorized)");
    expect(viewer).toContain("Run Collection (unauthorized)");
  });

  it("renders retry control, retry-disabled state, and timeline access", () => {
    const eligible = renderToStaticMarkup(
      <GmpAnalyticsCollectionOperatorControls
        workspaceId="glw-led-display-warehouse"
        collectionId="col_1"
        canRetryCollection
        retryEligible
      />,
    );

    const ineligible = renderToStaticMarkup(
      <GmpAnalyticsCollectionOperatorControls
        workspaceId="glw-led-display-warehouse"
        collectionId="col_1"
        canRetryCollection
        retryEligible={false}
        retryReason="Collection status COMPLETED is not retryable"
      />,
    );

    const unauthorized = renderToStaticMarkup(
      <GmpAnalyticsCollectionOperatorControls
        workspaceId="glw-led-display-warehouse"
        collectionId="col_1"
        canRetryCollection={false}
        retryEligible={false}
      />,
    );

    expect(eligible).toContain("Retry Collection");
    expect(eligible).toContain("View Timeline API");
    expect(ineligible).toContain("Retry not eligible");
    expect(unauthorized).toContain("Retry control hidden by server authorization policy.");
  });

  it("renders analytics workspace collections and source links using server data", async () => {
    const markup = renderToStaticMarkup(
      await GmpAnalyticsWorkspace({
        projectId: "proj_1",
        mode: "collections",
        permissions: {
          canManageSources: false,
          canRunCollection: false,
          canValidateSource: false,
          canViewCapabilities: true,
          canViewHealth: true,
          canViewCollections: true,
          canViewCollectionDetail: true,
          canRetryCollection: false,
          canViewCollectionTimeline: true,
          canViewConfiguration: true,
          canManageConfiguration: false,
          canViewEvidence: true,
          canViewEvidenceSnapshots: true,
          canViewCompilerRuns: true,
          canRunEvidenceCompiler: true,
          canReplayCompilation: true,
          canViewMetricCatalog: true,
        },
      }),
    );

    expect(markup).toContain("Read-only mode: collection execution is restricted by policy.");
    expect(markup).toContain("View collection detail");
    expect(markup).toContain("test_issue");
  });

  it("renders evidence mode sections from server-derived compiler data", async () => {
    const markup = renderToStaticMarkup(
      await GmpAnalyticsWorkspace({
        projectId: "proj_1",
        mode: "evidence",
        permissions: {
          canManageSources: false,
          canRunCollection: false,
          canValidateSource: false,
          canViewCapabilities: true,
          canViewHealth: true,
          canViewCollections: true,
          canViewCollectionDetail: true,
          canRetryCollection: false,
          canViewCollectionTimeline: true,
          canViewConfiguration: true,
          canManageConfiguration: false,
          canViewEvidence: true,
          canViewEvidenceSnapshots: true,
          canViewCompilerRuns: true,
          canRunEvidenceCompiler: true,
          canReplayCompilation: true,
          canViewMetricCatalog: true,
        },
      }),
    );

    expect(markup).toContain("Evidence compiler execution is enabled");
    expect(markup).toContain("Evidence snapshots: 1");
    expect(markup).toContain("Compiler runs: 1");
    expect(markup).toContain("Metric catalog entries: 1");
  });
});
