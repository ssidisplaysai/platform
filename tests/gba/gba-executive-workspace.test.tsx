import { describe, expect, it, jest } from "@jest/globals";
import { renderToString } from "react-dom/server";

jest.mock("@/lib/gba/executive-repository", () => ({
  createPrismaExecutiveRepository: jest.fn(() => ({})),
}));

jest.mock("@/lib/gba/executive-runtime", () => ({
  createExecutiveRuntimeService: jest.fn(() => ({
    getDashboard: async () => ({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      filters: {},
      revenue: { key: "revenue", label: "Revenue", value: 1000, unit: "USD", trend: 1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      profit: { key: "profit", label: "Profit", value: 100, unit: "USD", trend: 1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      cashFlow: { key: "cashflow", label: "Cash Flow", value: 50, unit: "USD", trend: 1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      salesPipeline: { key: "pipeline", label: "Pipeline", value: 200, unit: "USD", trend: 1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      marketingPerformance: { key: "marketing", label: "Marketing", value: 80, unit: "score", trend: 1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      manufacturingThroughput: { key: "throughput", label: "Throughput", value: 500, unit: "units/day", trend: 1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      inventoryHealth: { key: "inventory", label: "Inventory", value: 80, unit: "score", trend: 1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      purchasingStatus: { key: "purchasing", label: "Purchasing", value: 80, unit: "score", trend: 1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      customerHealth: { key: "customer", label: "Customer", value: 80, unit: "score", trend: 1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      projectHealth: { key: "project", label: "Project", value: 80, unit: "score", trend: 1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      systemHealth: { key: "system", label: "System", value: 95, unit: "score", trend: 1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      generatedAt: "2024-01-01T00:00:00.000Z",
      immutableLineage: "lineage",
    }),
    listBriefings: async () => [],
    listGoals: async () => [],
    listKpis: async () => [],
    listRecommendations: async () => [],
    listRisks: async () => [],
    listOpportunities: async () => [],
    listDelegations: async () => [],
    listHealth: async () => [],
    listTimeline: async () => [],
    listApprovals: async () => [],
  })),
}));

import { GbaExecutiveWorkspace } from "@/components/gba/gba-executive-workspace";

describe("gba executive workspace", () => {
  it("renders executive workspace shell", async () => {
    const html = renderToString(await GbaExecutiveWorkspace({
      mode: "dashboard",
      permissions: {
        canViewDashboard: true,
        canViewBriefings: true,
        canGenerateBriefings: true,
        canViewKpis: true,
        canManageKpis: true,
        canViewGoals: true,
        canManageGoals: true,
        canViewRecommendations: true,
        canReviewRecommendations: true,
        canDelegateWork: true,
        canViewRisks: true,
        canManageRisks: true,
        canViewOpportunities: true,
        canViewHealth: true,
      },
    }));

    expect(html).toContain("GBA Executive Workspace");
    expect(html).toContain("Genesis Business Agents");
  });
});
