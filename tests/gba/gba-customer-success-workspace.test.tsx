import { describe, expect, it, jest } from "@jest/globals";
import { renderToString } from "react-dom/server";

jest.mock("@/lib/gba/customer-success-repository", () => ({
  createPrismaCustomerSuccessRepository: jest.fn(() => ({})),
}));

jest.mock("@/lib/gba/customer-success-runtime", () => ({
  createCustomerSuccessRuntimeService: jest.fn(() => ({
    getDashboard: async () => ({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      activeCustomers: { key: "active", label: "Active Customers", value: 25, unit: "count", trend: 0.1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      customerHealthSummary: { key: "health", label: "Health", value: 78.4, unit: "score", trend: 0.05, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      onboardingProgress: { key: "onboarding", label: "Onboarding", value: 81.1, unit: "%", trend: 0.04, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      renewalsDue: { key: "renewals", label: "Renewals", value: 4, unit: "count", trend: 0.01, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      renewalPipeline: { key: "pipeline", label: "Pipeline", value: 240000, unit: "USD", trend: 0.03, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      churnRiskSummary: { key: "churn", label: "Churn", value: 8.2, unit: "%", trend: -0.02, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      expansionOpportunities: { key: "expansion", label: "Expansion", value: 7, unit: "count", trend: 0.06, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      customerSatisfactionTrends: { key: "sat", label: "Satisfaction", value: 8.1, unit: "score", trend: 0.03, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      supportActivitySummary: { key: "support", label: "Support", value: 16, unit: "count", trend: -0.05, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      executiveCustomerAlerts: { key: "alerts", label: "Alerts", value: 3, unit: "count", trend: 0.08, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      generatedAt: "2024-01-01T00:00:00.000Z",
      immutableLineage: "lineage",
    }),
    listCustomerHealth: async () => [],
    listOnboarding: async () => [],
    listSuccessPlans: async () => [],
    listRenewals: async () => [],
    listSatisfaction: async () => [],
    listExecutiveReports: async () => [],
    listKpis: async () => [],
    listRecommendations: async () => [],
    listTimeline: async () => [],
    listHealth: async () => [],
  })),
}));

import { GbaCustomerSuccessWorkspace } from "@/components/gba/gba-customer-success-workspace";

describe("gba customer success workspace", () => {
  it("renders customer success workspace shell", async () => {
    const html = renderToString(await GbaCustomerSuccessWorkspace({
      mode: "dashboard",
      permissions: {
        canViewDashboard: true,
        canViewCustomerHealth: true,
        canViewOnboarding: true,
        canViewSuccessPlans: true,
        canViewRenewals: true,
        canViewSatisfaction: true,
        canViewExecutiveReports: true,
        canViewKpis: true,
        canViewRecommendations: true,
        canReviewRecommendations: true,
        canViewTimeline: true,
        canViewHealth: true,
      },
    }));

    expect(html).toContain("GBA Customer Success Agent Workspace");
    expect(html).toContain("Genesis Business Agents");
  });
});
