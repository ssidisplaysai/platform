import { describe, expect, it, jest } from "@jest/globals";
import { renderToString } from "react-dom/server";

jest.mock("@/lib/gba/sales-repository", () => ({
  createPrismaSalesRepository: jest.fn(() => ({})),
}));

jest.mock("@/lib/gba/sales-runtime", () => ({
  createSalesRuntimeService: jest.fn(() => ({
    getDashboard: async () => ({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      totalPipelineValue: { key: "pipeline_total", label: "Total Pipeline", value: 120000, unit: "USD", trend: 0.2, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      weightedForecast: { key: "weighted_forecast", label: "Weighted Forecast", value: 76000, unit: "USD", trend: 0.1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      winRate: { key: "win_rate", label: "Win Rate", value: 58, unit: "%", trend: 1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      cycleTimeDays: { key: "cycle_time", label: "Cycle Time", value: 31, unit: "days", trend: -0.5, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      accountRiskScore: { key: "account_risk", label: "Account Risk", value: 22, unit: "score", trend: -0.3, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      fulfillmentReadiness: { key: "fulfillment_readiness", label: "Fulfillment Readiness", value: 84, unit: "score", trend: -0.2, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      recommendationCount: { key: "recommendations", label: "Recommendations", value: 3, unit: "count", trend: 0.3, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      generatedAt: "2024-01-01T00:00:00.000Z",
      immutableLineage: "lineage",
    }),
    listPipeline: async () => [],
    listForecasts: async () => [],
    listAccounts: async () => [],
    listRecommendations: async () => [],
    listTimeline: async () => [],
    listHealth: async () => [],
  })),
}));

import { GbaSalesWorkspace } from "@/components/gba/gba-sales-workspace";

describe("gba sales workspace", () => {
  it("renders sales workspace shell", async () => {
    const html = renderToString(await GbaSalesWorkspace({
      mode: "dashboard",
      permissions: {
        canViewDashboard: true,
        canViewPipeline: true,
        canManagePipeline: true,
        canViewForecasting: true,
        canViewAccounts: true,
        canViewRecommendations: true,
        canReviewRecommendations: true,
        canViewHealth: true,
      },
    }));

    expect(html).toContain("GBA Sales Agent Workspace");
    expect(html).toContain("Genesis Business Agents");
  });
});
