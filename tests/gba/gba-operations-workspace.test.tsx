import { describe, expect, it, jest } from "@jest/globals";
import { renderToString } from "react-dom/server";

jest.mock("@/lib/gba/operations-repository", () => ({
  createPrismaOperationsRepository: jest.fn(() => ({})),
}));

jest.mock("@/lib/gba/operations-runtime", () => ({
  createOperationsRuntimeService: jest.fn(() => ({
    getDashboard: async () => ({
      workspaceId: "glw-led-display-warehouse",
      organizationId: "genesis",
      filters: {},
      manufacturing: { key: "manufacturing", label: "Manufacturing", value: 84, unit: "score", trend: 0.4, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      warehouse: { key: "warehouse", label: "Warehouse", value: 72, unit: "score", trend: 0.2, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      inventory: { key: "inventory", label: "Inventory", value: 78, unit: "score", trend: -0.1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      purchasing: { key: "purchasing", label: "Purchasing", value: 80, unit: "score", trend: 0.3, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      logistics: { key: "logistics", label: "Logistics", value: 81, unit: "score", trend: 0.1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      shipping: { key: "shipping", label: "Shipping", value: 79, unit: "score", trend: 0.2, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      receiving: { key: "receiving", label: "Receiving", value: 76, unit: "score", trend: 0.1, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      production: { key: "production", label: "Production", value: 1200, unit: "units/day", trend: 0.8, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      vendorPerformance: { key: "vendor", label: "Vendor Performance", value: 90, unit: "score", trend: -0.3, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      capacity: { key: "capacity", label: "Capacity", value: 82, unit: "%", trend: 0.7, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      fieldOperations: { key: "field", label: "Field", value: 83, unit: "score", trend: 0.2, asOf: "2024-01-01T00:00:00.000Z", evidenceReferences: [] },
      generatedAt: "2024-01-01T00:00:00.000Z",
      immutableLineage: "lineage",
    }),
    listWorkOrders: async () => [],
    listProductionSchedules: async () => [],
    listWarehouseOperations: async () => [],
    listInventory: async () => [],
    listPurchasing: async () => [],
    listShipping: async () => [],
    listCapacity: async () => [],
    listOperationsKpis: async () => [],
    listRecommendations: async () => [],
    listVendorMetrics: async () => [],
    listTimeline: async () => [],
    listHealth: async () => [],
    listExecutiveSummaries: async () => [],
  })),
}));

import { GbaOperationsWorkspace } from "@/components/gba/gba-operations-workspace";

describe("gba operations workspace", () => {
  it("renders operations workspace shell", async () => {
    const html = renderToString(await GbaOperationsWorkspace({
      mode: "dashboard",
      permissions: {
        canViewDashboard: true,
        canViewWorkOrders: true,
        canManageWorkOrders: true,
        canViewInventory: true,
        canManageInventory: true,
        canViewPurchasing: true,
        canManagePurchasing: true,
        canViewWarehouse: true,
        canManageWarehouse: true,
        canViewShipping: true,
        canManageShipping: true,
        canViewCapacity: true,
        canViewKpis: true,
        canViewRecommendations: true,
        canReviewRecommendations: true,
        canViewHealth: true,
      },
    }));

    expect(html).toContain("GBA Operations Agent Workspace");
    expect(html).toContain("Genesis Business Agents");
  });
});
