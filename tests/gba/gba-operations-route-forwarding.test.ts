import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/gba/operations-api", () => ({
  handleOperationsDashboard: jest.fn(async () => Response.json({ ok: true })),
  handleOperationsWorkOrders: jest.fn(async () => Response.json({ ok: true })),
  handleCreateOperationsWorkOrder: jest.fn(async () => Response.json({ ok: true })),
  handleOperationsInventory: jest.fn(async () => Response.json({ ok: true })),
  handleOperationsPurchasing: jest.fn(async () => Response.json({ ok: true })),
  handleOperationsWarehouse: jest.fn(async () => Response.json({ ok: true })),
  handleOperationsShipping: jest.fn(async () => Response.json({ ok: true })),
  handleOperationsCapacity: jest.fn(async () => Response.json({ ok: true })),
  handleOperationsKpis: jest.fn(async () => Response.json({ ok: true })),
  handleOperationsRecommendations: jest.fn(async () => Response.json({ ok: true })),
  handleReviewOperationsRecommendation: jest.fn(async () => Response.json({ ok: true })),
  handleOperationsHealth: jest.fn(async () => Response.json({ ok: true })),
}));

import { GET as getDashboardRoute } from "@/app/api/gba/operations/dashboard/route";
import { GET as getWorkOrdersRoute, POST as postWorkOrdersRoute } from "@/app/api/gba/operations/work-orders/route";
import { GET as getInventoryRoute } from "@/app/api/gba/operations/inventory/route";
import { GET as getPurchasingRoute } from "@/app/api/gba/operations/purchasing/route";
import { GET as getWarehouseRoute } from "@/app/api/gba/operations/warehouse/route";
import { GET as getShippingRoute } from "@/app/api/gba/operations/shipping/route";
import { GET as getCapacityRoute } from "@/app/api/gba/operations/capacity/route";
import { GET as getKpisRoute } from "@/app/api/gba/operations/kpis/route";
import { GET as getRecommendationsRoute } from "@/app/api/gba/operations/recommendations/route";
import { POST as postReviewRoute } from "@/app/api/gba/operations/recommendations/review/route";
import { GET as getHealthRoute } from "@/app/api/gba/operations/health/route";

import {
  handleOperationsDashboard,
  handleOperationsWorkOrders,
  handleCreateOperationsWorkOrder,
  handleOperationsInventory,
  handleOperationsPurchasing,
  handleOperationsWarehouse,
  handleOperationsShipping,
  handleOperationsCapacity,
  handleOperationsKpis,
  handleOperationsRecommendations,
  handleReviewOperationsRecommendation,
  handleOperationsHealth,
} from "@/lib/gba/operations-api";

describe("gba operations route forwarding", () => {
  it("forwards gba operations api routes", async () => {
    await getDashboardRoute(new Request("http://localhost/api/gba/operations/dashboard"));
    await getWorkOrdersRoute(new Request("http://localhost/api/gba/operations/work-orders"));
    await postWorkOrdersRoute(new Request("http://localhost/api/gba/operations/work-orders", { method: "POST" }));
    await getInventoryRoute(new Request("http://localhost/api/gba/operations/inventory"));
    await getPurchasingRoute(new Request("http://localhost/api/gba/operations/purchasing"));
    await getWarehouseRoute(new Request("http://localhost/api/gba/operations/warehouse"));
    await getShippingRoute(new Request("http://localhost/api/gba/operations/shipping"));
    await getCapacityRoute(new Request("http://localhost/api/gba/operations/capacity"));
    await getKpisRoute(new Request("http://localhost/api/gba/operations/kpis"));
    await getRecommendationsRoute(new Request("http://localhost/api/gba/operations/recommendations"));
    await postReviewRoute(new Request("http://localhost/api/gba/operations/recommendations/review", { method: "POST" }));
    await getHealthRoute(new Request("http://localhost/api/gba/operations/health"));

    expect(handleOperationsDashboard).toHaveBeenCalled();
    expect(handleOperationsWorkOrders).toHaveBeenCalled();
    expect(handleCreateOperationsWorkOrder).toHaveBeenCalled();
    expect(handleOperationsInventory).toHaveBeenCalled();
    expect(handleOperationsPurchasing).toHaveBeenCalled();
    expect(handleOperationsWarehouse).toHaveBeenCalled();
    expect(handleOperationsShipping).toHaveBeenCalled();
    expect(handleOperationsCapacity).toHaveBeenCalled();
    expect(handleOperationsKpis).toHaveBeenCalled();
    expect(handleOperationsRecommendations).toHaveBeenCalled();
    expect(handleReviewOperationsRecommendation).toHaveBeenCalled();
    expect(handleOperationsHealth).toHaveBeenCalled();
  });
});
