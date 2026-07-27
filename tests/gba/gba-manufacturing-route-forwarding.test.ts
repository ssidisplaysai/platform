import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/gba/manufacturing-api", () => ({
  handleManufacturingDashboard: jest.fn(async () => Response.json({ ok: true })),
  handleManufacturingBoms: jest.fn(async () => Response.json({ ok: true })),
  handleManufacturingRoutings: jest.fn(async () => Response.json({ ok: true })),
  handleManufacturingProductionOrders: jest.fn(async () => Response.json({ ok: true })),
  handleCreateManufacturingProductionOrder: jest.fn(async () => Response.json({ ok: true })),
  handleManufacturingMachines: jest.fn(async () => Response.json({ ok: true })),
  handleUpdateManufacturingMachineStatus: jest.fn(async () => Response.json({ ok: true })),
  handleManufacturingLabor: jest.fn(async () => Response.json({ ok: true })),
  handleManufacturingMaterials: jest.fn(async () => Response.json({ ok: true })),
  handleManufacturingQuality: jest.fn(async () => Response.json({ ok: true })),
  handleRecordManufacturingQualityEvent: jest.fn(async () => Response.json({ ok: true })),
  handleManufacturingCosting: jest.fn(async () => Response.json({ ok: true })),
  handleManufacturingKpis: jest.fn(async () => Response.json({ ok: true })),
  handleManufacturingRecommendations: jest.fn(async () => Response.json({ ok: true })),
  handleReviewManufacturingRecommendation: jest.fn(async () => Response.json({ ok: true })),
  handleManufacturingHealth: jest.fn(async () => Response.json({ ok: true })),
  handleManufacturingTimeline: jest.fn(async () => Response.json({ ok: true })),
  handleManufacturingExecutiveReports: jest.fn(async () => Response.json({ ok: true })),
}));

import { GET as getDashboardRoute } from "@/app/api/gba/manufacturing/dashboard/route";
import { GET as getBomsRoute } from "@/app/api/gba/manufacturing/boms/route";
import { GET as getRoutingsRoute } from "@/app/api/gba/manufacturing/routings/route";
import { GET as getProductionOrdersRoute, POST as postProductionOrdersRoute } from "@/app/api/gba/manufacturing/production-orders/route";
import { GET as getMachinesRoute, POST as postMachinesRoute } from "@/app/api/gba/manufacturing/machines/route";
import { GET as getLaborRoute } from "@/app/api/gba/manufacturing/labor/route";
import { GET as getMaterialsRoute } from "@/app/api/gba/manufacturing/materials/route";
import { GET as getQualityRoute, POST as postQualityRoute } from "@/app/api/gba/manufacturing/quality/route";
import { GET as getCostingRoute } from "@/app/api/gba/manufacturing/costing/route";
import { GET as getKpisRoute } from "@/app/api/gba/manufacturing/kpis/route";
import { GET as getRecommendationsRoute } from "@/app/api/gba/manufacturing/recommendations/route";
import { POST as postRecommendationReviewRoute } from "@/app/api/gba/manufacturing/recommendations/review/route";
import { GET as getHealthRoute } from "@/app/api/gba/manufacturing/health/route";
import { GET as getTimelineRoute } from "@/app/api/gba/manufacturing/timeline/route";
import { GET as getExecutiveReportsRoute } from "@/app/api/gba/manufacturing/executive-reports/route";

import {
  handleCreateManufacturingProductionOrder,
  handleManufacturingBoms,
  handleManufacturingCosting,
  handleManufacturingDashboard,
  handleManufacturingExecutiveReports,
  handleManufacturingHealth,
  handleManufacturingKpis,
  handleManufacturingLabor,
  handleManufacturingMachines,
  handleManufacturingMaterials,
  handleManufacturingProductionOrders,
  handleManufacturingQuality,
  handleManufacturingRecommendations,
  handleManufacturingRoutings,
  handleManufacturingTimeline,
  handleRecordManufacturingQualityEvent,
  handleReviewManufacturingRecommendation,
  handleUpdateManufacturingMachineStatus,
} from "@/lib/gba/manufacturing-api";

describe("gba manufacturing route forwarding", () => {
  it("forwards gba manufacturing api routes", async () => {
    await getDashboardRoute(new Request("http://localhost/api/gba/manufacturing/dashboard"));
    await getBomsRoute(new Request("http://localhost/api/gba/manufacturing/boms"));
    await getRoutingsRoute(new Request("http://localhost/api/gba/manufacturing/routings"));
    await getProductionOrdersRoute(new Request("http://localhost/api/gba/manufacturing/production-orders"));
    await postProductionOrdersRoute(new Request("http://localhost/api/gba/manufacturing/production-orders", { method: "POST" }));
    await getMachinesRoute(new Request("http://localhost/api/gba/manufacturing/machines"));
    await postMachinesRoute(new Request("http://localhost/api/gba/manufacturing/machines", { method: "POST" }));
    await getLaborRoute(new Request("http://localhost/api/gba/manufacturing/labor"));
    await getMaterialsRoute(new Request("http://localhost/api/gba/manufacturing/materials"));
    await getQualityRoute(new Request("http://localhost/api/gba/manufacturing/quality"));
    await postQualityRoute(new Request("http://localhost/api/gba/manufacturing/quality", { method: "POST" }));
    await getCostingRoute(new Request("http://localhost/api/gba/manufacturing/costing"));
    await getKpisRoute(new Request("http://localhost/api/gba/manufacturing/kpis"));
    await getRecommendationsRoute(new Request("http://localhost/api/gba/manufacturing/recommendations"));
    await postRecommendationReviewRoute(new Request("http://localhost/api/gba/manufacturing/recommendations/review", { method: "POST" }));
    await getHealthRoute(new Request("http://localhost/api/gba/manufacturing/health"));
    await getTimelineRoute(new Request("http://localhost/api/gba/manufacturing/timeline"));
    await getExecutiveReportsRoute(new Request("http://localhost/api/gba/manufacturing/executive-reports"));

    expect(handleManufacturingDashboard).toHaveBeenCalled();
    expect(handleManufacturingBoms).toHaveBeenCalled();
    expect(handleManufacturingRoutings).toHaveBeenCalled();
    expect(handleManufacturingProductionOrders).toHaveBeenCalled();
    expect(handleCreateManufacturingProductionOrder).toHaveBeenCalled();
    expect(handleManufacturingMachines).toHaveBeenCalled();
    expect(handleUpdateManufacturingMachineStatus).toHaveBeenCalled();
    expect(handleManufacturingLabor).toHaveBeenCalled();
    expect(handleManufacturingMaterials).toHaveBeenCalled();
    expect(handleManufacturingQuality).toHaveBeenCalled();
    expect(handleRecordManufacturingQualityEvent).toHaveBeenCalled();
    expect(handleManufacturingCosting).toHaveBeenCalled();
    expect(handleManufacturingKpis).toHaveBeenCalled();
    expect(handleManufacturingRecommendations).toHaveBeenCalled();
    expect(handleReviewManufacturingRecommendation).toHaveBeenCalled();
    expect(handleManufacturingHealth).toHaveBeenCalled();
    expect(handleManufacturingTimeline).toHaveBeenCalled();
    expect(handleManufacturingExecutiveReports).toHaveBeenCalled();
  });
});
