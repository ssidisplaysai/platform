import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/gba/sales-api", () => ({
  handleSalesDashboard: jest.fn(async () => Response.json({ ok: true })),
  handleSalesPipeline: jest.fn(async () => Response.json({ ok: true })),
  handleCreateSalesPipelineRecord: jest.fn(async () => Response.json({ ok: true })),
  handleSalesForecasting: jest.fn(async () => Response.json({ ok: true })),
  handleSalesAccounts: jest.fn(async () => Response.json({ ok: true })),
  handleSalesRecommendations: jest.fn(async () => Response.json({ ok: true })),
  handleReviewSalesRecommendation: jest.fn(async () => Response.json({ ok: true })),
  handleSalesTimeline: jest.fn(async () => Response.json({ ok: true })),
  handleSalesHealth: jest.fn(async () => Response.json({ ok: true })),
}));

import { GET as getDashboardRoute } from "@/app/api/gba/sales/dashboard/route";
import { GET as getPipelineRoute, POST as postPipelineRoute } from "@/app/api/gba/sales/pipeline/route";
import { GET as getForecastingRoute } from "@/app/api/gba/sales/forecasting/route";
import { GET as getAccountsRoute } from "@/app/api/gba/sales/accounts/route";
import { GET as getRecommendationsRoute } from "@/app/api/gba/sales/recommendations/route";
import { POST as postReviewRoute } from "@/app/api/gba/sales/recommendations/review/route";
import { GET as getTimelineRoute } from "@/app/api/gba/sales/timeline/route";
import { GET as getHealthRoute } from "@/app/api/gba/sales/health/route";

import {
  handleCreateSalesPipelineRecord,
  handleReviewSalesRecommendation,
  handleSalesAccounts,
  handleSalesDashboard,
  handleSalesForecasting,
  handleSalesHealth,
  handleSalesPipeline,
  handleSalesRecommendations,
  handleSalesTimeline,
} from "@/lib/gba/sales-api";

describe("gba sales route forwarding", () => {
  it("forwards gba sales api routes", async () => {
    await getDashboardRoute(new Request("http://localhost/api/gba/sales/dashboard"));
    await getPipelineRoute(new Request("http://localhost/api/gba/sales/pipeline"));
    await postPipelineRoute(new Request("http://localhost/api/gba/sales/pipeline", { method: "POST" }));
    await getForecastingRoute(new Request("http://localhost/api/gba/sales/forecasting"));
    await getAccountsRoute(new Request("http://localhost/api/gba/sales/accounts"));
    await getRecommendationsRoute(new Request("http://localhost/api/gba/sales/recommendations"));
    await postReviewRoute(new Request("http://localhost/api/gba/sales/recommendations/review", { method: "POST" }));
    await getTimelineRoute(new Request("http://localhost/api/gba/sales/timeline"));
    await getHealthRoute(new Request("http://localhost/api/gba/sales/health"));

    expect(handleSalesDashboard).toHaveBeenCalled();
    expect(handleSalesPipeline).toHaveBeenCalled();
    expect(handleCreateSalesPipelineRecord).toHaveBeenCalled();
    expect(handleSalesForecasting).toHaveBeenCalled();
    expect(handleSalesAccounts).toHaveBeenCalled();
    expect(handleSalesRecommendations).toHaveBeenCalled();
    expect(handleReviewSalesRecommendation).toHaveBeenCalled();
    expect(handleSalesTimeline).toHaveBeenCalled();
    expect(handleSalesHealth).toHaveBeenCalled();
  });
});
