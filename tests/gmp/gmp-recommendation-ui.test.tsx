import { describe, expect, it, jest } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { GmpAnalyticsWorkspace } from "@/components/gmp/gmp-analytics-workspace";

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
    listSources: async () => [],
    listCollections: async () => [],
    listSnapshots: async () => [],
    listMetricDefinitions: async () => [],
    ensureFoundationConfig: async () => ({
      compilerVersion: { compilerVersion: "gmp-evidence-compiler/v1" },
      attributionRegistryVersion: "gmp-attribution-registry/v1",
      recommendationRegistryVersion: "gmp-recommendation-registry/v1",
    }),
  }),
}));

jest.mock("@/lib/gmp/evidence-services", () => ({
  createGmpEvidenceServices: () => ({
    listSnapshots: async () => [],
    listCompilerRuns: async () => [],
    listMetrics: async () => [],
    listPublications: async () => [],
    listMetricCatalog: async () => [],
  }),
}));

jest.mock("@/lib/gmp/recommendation-services", () => ({
  createGmpRecommendationServices: () => ({
    listRecommendations: async () => [
      {
        recommendationId: "gmprec_1",
        ruleId: "improve_declining_ctr",
        category: "performance",
        lifecycleState: "NEW",
        severity: "HIGH",
        priority: "P1",
        confidence: "LOW",
        explanation: "Organic CTR below threshold.",
        recommendedAction: "Review snippets.",
        evidenceSnapshotId: "gmpevs_1",
      },
    ],
    listAttribution: async () => [
      {
        analysis: {
          attributionAnalysisId: "gmpattr_1",
          attributionVersion: "gmp-attribution-engine/v1",
          evidenceSnapshotId: "gmpevs_1",
          attributionWindowDays: 30,
        },
        results: [{ attributionResultId: "gmpares_1" }],
      },
    ],
    listDecisionSupport: async () => [
      {
        decisionSupportSummaryId: "gmpdss_1",
        summaryType: "HEALTH_SUMMARY",
        summaryKey: "recommendation_health",
        summaryChecksum: "checksum_1",
      },
    ],
    listRuleCatalog: async () => [
      {
        ruleId: "improve_declining_ctr",
        ruleVersion: "1.0.0",
        registryVersion: "gmp-recommendation-rule-catalog/v1",
        description: "Flag low ctr",
      },
    ],
    getRecommendationDetail: async () => ({
      recommendation: {
        recommendationId: "gmprec_1",
        ruleId: "improve_declining_ctr",
        ruleVersion: "1.0.0",
        severity: "HIGH",
        priority: "P1",
        confidence: "LOW",
        explanation: "Organic CTR below threshold.",
        recommendedAction: "Review snippets.",
        evidenceSnapshotId: "gmpevs_1",
      },
      lifecycle: [{ recommendationLifecycleEventId: "life_1" }],
      run: null,
      attribution: [],
    }),
  }),
}));

const permissions = {
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
  canViewRecommendations: true,
  canReviewRecommendations: true,
  canDismissRecommendations: true,
  canReplayRecommendationEngine: true,
  canViewAttribution: true,
  canViewRuleCatalog: true,
  canViewDecisionSupport: true,
};

describe("gmp recommendation ui", () => {
  it("renders recommendations mode with severity priority confidence and detail link", async () => {
    const markup = renderToStaticMarkup(await GmpAnalyticsWorkspace({ projectId: "proj_1", mode: "recommendations", permissions }));

    expect(markup).toContain("Recommendation replay execution is enabled");
    expect(markup).toContain("improve_declining_ctr");
    expect(markup).toContain("HIGH");
    expect(markup).toContain("P1");
    expect(markup).toContain("LOW");
    expect(markup).toContain("View recommendation detail");
  });

  it("renders attribution, decision support, and rule catalog sections", async () => {
    const attributionMarkup = renderToStaticMarkup(await GmpAnalyticsWorkspace({ projectId: "proj_1", mode: "attribution", permissions }));
    const decisionMarkup = renderToStaticMarkup(await GmpAnalyticsWorkspace({ projectId: "proj_1", mode: "decision-support", permissions }));
    const catalogMarkup = renderToStaticMarkup(await GmpAnalyticsWorkspace({ projectId: "proj_1", mode: "rule-catalog", permissions }));

    expect(attributionMarkup).toContain("gmpattr_1");
    expect(decisionMarkup).toContain("HEALTH_SUMMARY");
    expect(catalogMarkup).toContain("gmp-recommendation-rule-catalog/v1");
  });

  it("renders recommendation detail with lineage fields", async () => {
    const markup = renderToStaticMarkup(await GmpAnalyticsWorkspace({
      projectId: "proj_1",
      mode: "recommendation-detail",
      recommendationId: "gmprec_1",
      permissions,
    }));

    expect(markup).toContain("Recommendation gmprec_1");
    expect(markup).toContain("Rule version: 1.0.0");
    expect(markup).toContain("Snapshot lineage: gmpevs_1");
    expect(markup).toContain("Lifecycle events: 1");
  });
});
