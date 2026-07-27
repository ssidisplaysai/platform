import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/gba/marketing-api", () => ({
  handleMarketingDashboard: jest.fn(async () => Response.json({ ok: true })),
  handleMarketingCampaigns: jest.fn(async () => Response.json({ ok: true })),
  handleCreateMarketingCampaignPlan: jest.fn(async () => Response.json({ ok: true })),
  handleMarketingStrategy: jest.fn(async () => Response.json({ ok: true })),
  handleMarketingSeo: jest.fn(async () => Response.json({ ok: true })),
  handleMarketingBrandGovernance: jest.fn(async () => Response.json({ ok: true })),
  handleMarketingAnalytics: jest.fn(async () => Response.json({ ok: true })),
  handleMarketingRecommendations: jest.fn(async () => Response.json({ ok: true })),
  handleReviewMarketingRecommendation: jest.fn(async () => Response.json({ ok: true })),
  handleMarketingTimeline: jest.fn(async () => Response.json({ ok: true })),
  handleMarketingExecutiveReports: jest.fn(async () => Response.json({ ok: true })),
  handleMarketingHealth: jest.fn(async () => Response.json({ ok: true })),
}));

import { GET as getDashboardRoute } from "@/app/api/gba/marketing/dashboard/route";
import { GET as getCampaignsRoute, POST as postCampaignsRoute } from "@/app/api/gba/marketing/campaigns/route";
import { GET as getStrategyRoute } from "@/app/api/gba/marketing/strategy/route";
import { GET as getSeoRoute } from "@/app/api/gba/marketing/seo/route";
import { GET as getBrandRoute } from "@/app/api/gba/marketing/brand-governance/route";
import { GET as getAnalyticsRoute } from "@/app/api/gba/marketing/analytics/route";
import { GET as getRecommendationsRoute } from "@/app/api/gba/marketing/recommendations/route";
import { POST as postRecommendationReviewRoute } from "@/app/api/gba/marketing/recommendations/review/route";
import { GET as getTimelineRoute } from "@/app/api/gba/marketing/timeline/route";
import { GET as getExecutiveReportsRoute } from "@/app/api/gba/marketing/executive-reports/route";
import { GET as getHealthRoute } from "@/app/api/gba/marketing/health/route";

import {
  handleCreateMarketingCampaignPlan,
  handleMarketingAnalytics,
  handleMarketingBrandGovernance,
  handleMarketingCampaigns,
  handleMarketingDashboard,
  handleMarketingExecutiveReports,
  handleMarketingHealth,
  handleMarketingRecommendations,
  handleMarketingSeo,
  handleMarketingStrategy,
  handleMarketingTimeline,
  handleReviewMarketingRecommendation,
} from "@/lib/gba/marketing-api";

describe("gba marketing route forwarding", () => {
  it("forwards gba marketing api routes", async () => {
    await getDashboardRoute(new Request("http://localhost/api/gba/marketing/dashboard"));
    await getCampaignsRoute(new Request("http://localhost/api/gba/marketing/campaigns?projectId=project-1"));
    await postCampaignsRoute(new Request("http://localhost/api/gba/marketing/campaigns", { method: "POST" }));
    await getStrategyRoute(new Request("http://localhost/api/gba/marketing/strategy?projectId=project-1"));
    await getSeoRoute(new Request("http://localhost/api/gba/marketing/seo?projectId=project-1"));
    await getBrandRoute(new Request("http://localhost/api/gba/marketing/brand-governance?projectId=project-1"));
    await getAnalyticsRoute(new Request("http://localhost/api/gba/marketing/analytics?projectId=project-1"));
    await getRecommendationsRoute(new Request("http://localhost/api/gba/marketing/recommendations?projectId=project-1"));
    await postRecommendationReviewRoute(new Request("http://localhost/api/gba/marketing/recommendations/review", { method: "POST" }));
    await getTimelineRoute(new Request("http://localhost/api/gba/marketing/timeline?projectId=project-1"));
    await getExecutiveReportsRoute(new Request("http://localhost/api/gba/marketing/executive-reports?projectId=project-1"));
    await getHealthRoute(new Request("http://localhost/api/gba/marketing/health?projectId=project-1"));

    expect(handleMarketingDashboard).toHaveBeenCalled();
    expect(handleMarketingCampaigns).toHaveBeenCalled();
    expect(handleCreateMarketingCampaignPlan).toHaveBeenCalled();
    expect(handleMarketingStrategy).toHaveBeenCalled();
    expect(handleMarketingSeo).toHaveBeenCalled();
    expect(handleMarketingBrandGovernance).toHaveBeenCalled();
    expect(handleMarketingAnalytics).toHaveBeenCalled();
    expect(handleMarketingRecommendations).toHaveBeenCalled();
    expect(handleReviewMarketingRecommendation).toHaveBeenCalled();
    expect(handleMarketingTimeline).toHaveBeenCalled();
    expect(handleMarketingExecutiveReports).toHaveBeenCalled();
    expect(handleMarketingHealth).toHaveBeenCalled();
  });
});
