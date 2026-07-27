import { describe, expect, it, jest } from "@jest/globals";
import { renderToString } from "react-dom/server";

jest.mock("@/lib/gba/finance-repository", () => ({
  createPrismaFinanceRepository: jest.fn(() => ({})),
}));

jest.mock("@/lib/gba/finance-runtime", () => ({
  createFinanceRuntimeService: jest.fn(() => ({
    getDashboard: async () => ({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      revenueSummary: { key: "revenue", label: "Revenue", value: 1200000, unit: "USD", trend: 0.1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      grossProfit: { key: "gross_profit", label: "Gross Profit", value: 420000, unit: "USD", trend: 0.08, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      netProfit: { key: "net_profit", label: "Net Profit", value: 220000, unit: "USD", trend: 0.05, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      cashPosition: { key: "cash", label: "Cash", value: 980000, unit: "USD", trend: 0.02, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      arAging: { key: "ar", label: "AR Aging", value: 2, unit: "count", trend: -0.2, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      apAging: { key: "ap", label: "AP Aging", value: 1, unit: "count", trend: -0.1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      outstandingInvoices: { key: "invoices", label: "Outstanding Invoices", value: 145000, unit: "USD", trend: 0.03, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      budgetPerformance: { key: "budget", label: "Budget Performance", value: 25000, unit: "USD", trend: -0.5, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      cashFlowTrend: { key: "cash_flow", label: "Cash Flow", value: 82000, unit: "USD", trend: 0.01, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      operatingExpenses: { key: "opex", label: "Operating Expenses", value: 370000, unit: "USD", trend: 0.03, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      manufacturingCosts: { key: "mfg", label: "Manufacturing Costs", value: 280000, unit: "USD", trend: 0.02, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      executiveAlerts: { key: "alerts", label: "Alerts", value: 2, unit: "count", trend: 0.1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      generatedAt: "2024-01-01T00:00:00.000Z",
      immutableLineage: "lineage",
    }),
    listGeneralLedger: async () => [],
    listChartOfAccounts: async () => [],
    listAccountsReceivable: async () => [],
    listAccountsPayable: async () => [],
    listBudgets: async () => [],
    listProfitability: async () => [],
    listForecasts: async () => [],
    listKpis: async () => [],
    listRecommendations: async () => [],
    listExecutiveReports: async () => [],
    listHealth: async () => [],
  })),
}));

import { GbaFinanceWorkspace } from "@/components/gba/gba-finance-workspace";

describe("gba finance workspace", () => {
  it("renders finance workspace shell", async () => {
    const html = renderToString(await GbaFinanceWorkspace({
      mode: "dashboard",
      permissions: {
        canViewDashboard: true,
        canViewGeneralLedger: true,
        canViewAccountsReceivable: true,
        canViewAccountsPayable: true,
        canViewBudgets: true,
        canManageBudgets: true,
        canViewProfitability: true,
        canViewForecasts: true,
        canViewKpis: true,
        canViewRecommendations: true,
        canReviewRecommendations: true,
        canViewExecutiveReports: true,
        canViewHealth: true,
      },
    }));

    expect(html).toContain("GBA Finance Agent Workspace");
    expect(html).toContain("Genesis Business Agents");
  });
});
