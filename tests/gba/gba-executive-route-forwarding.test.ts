import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/gba/executive-api", () => ({
  handleExecutiveDashboard: jest.fn(async () => Response.json({ ok: true })),
  handleExecutiveBriefings: jest.fn(async () => Response.json({ ok: true })),
  handleGenerateExecutiveBriefing: jest.fn(async () => Response.json({ ok: true })),
  handleExecutiveGoals: jest.fn(async () => Response.json({ ok: true })),
  handleExecutiveKpis: jest.fn(async () => Response.json({ ok: true })),
  handleExecutiveRecommendations: jest.fn(async () => Response.json({ ok: true })),
  handleReviewExecutiveRecommendation: jest.fn(async () => Response.json({ ok: true })),
  handleExecutiveRisks: jest.fn(async () => Response.json({ ok: true })),
  handleExecutiveOpportunities: jest.fn(async () => Response.json({ ok: true })),
  handleExecutiveDelegate: jest.fn(async () => Response.json({ ok: true })),
  handleExecutiveHealth: jest.fn(async () => Response.json({ ok: true })),
}));

import { GET as getDashboardRoute } from "@/app/api/gba/executive/dashboard/route";
import { GET as getBriefingsRoute } from "@/app/api/gba/executive/briefings/route";
import { POST as postGenerateBriefingRoute } from "@/app/api/gba/executive/briefings/generate/route";
import { GET as getGoalsRoute } from "@/app/api/gba/executive/goals/route";
import { GET as getKpisRoute } from "@/app/api/gba/executive/kpis/route";
import { GET as getRecommendationsRoute } from "@/app/api/gba/executive/recommendations/route";
import { POST as postReviewRecommendationRoute } from "@/app/api/gba/executive/recommendations/review/route";
import { GET as getRisksRoute } from "@/app/api/gba/executive/risks/route";
import { GET as getOpportunitiesRoute } from "@/app/api/gba/executive/opportunities/route";
import { POST as postDelegateRoute } from "@/app/api/gba/executive/delegate/route";
import { GET as getHealthRoute } from "@/app/api/gba/executive/health/route";

import {
  handleExecutiveDashboard,
  handleExecutiveBriefings,
  handleGenerateExecutiveBriefing,
  handleExecutiveGoals,
  handleExecutiveKpis,
  handleExecutiveRecommendations,
  handleReviewExecutiveRecommendation,
  handleExecutiveRisks,
  handleExecutiveOpportunities,
  handleExecutiveDelegate,
  handleExecutiveHealth,
} from "@/lib/gba/executive-api";

describe("gba executive route forwarding", () => {
  it("forwards gba executive api routes", async () => {
    await getDashboardRoute(new Request("http://localhost/api/gba/executive/dashboard"));
    await getBriefingsRoute(new Request("http://localhost/api/gba/executive/briefings"));
    await postGenerateBriefingRoute(new Request("http://localhost/api/gba/executive/briefings/generate", { method: "POST" }));
    await getGoalsRoute(new Request("http://localhost/api/gba/executive/goals"));
    await getKpisRoute(new Request("http://localhost/api/gba/executive/kpis"));
    await getRecommendationsRoute(new Request("http://localhost/api/gba/executive/recommendations"));
    await postReviewRecommendationRoute(new Request("http://localhost/api/gba/executive/recommendations/review", { method: "POST" }));
    await getRisksRoute(new Request("http://localhost/api/gba/executive/risks"));
    await getOpportunitiesRoute(new Request("http://localhost/api/gba/executive/opportunities"));
    await postDelegateRoute(new Request("http://localhost/api/gba/executive/delegate", { method: "POST" }));
    await getHealthRoute(new Request("http://localhost/api/gba/executive/health"));

    expect(handleExecutiveDashboard).toHaveBeenCalled();
    expect(handleExecutiveBriefings).toHaveBeenCalled();
    expect(handleGenerateExecutiveBriefing).toHaveBeenCalled();
    expect(handleExecutiveGoals).toHaveBeenCalled();
    expect(handleExecutiveKpis).toHaveBeenCalled();
    expect(handleExecutiveRecommendations).toHaveBeenCalled();
    expect(handleReviewExecutiveRecommendation).toHaveBeenCalled();
    expect(handleExecutiveRisks).toHaveBeenCalled();
    expect(handleExecutiveOpportunities).toHaveBeenCalled();
    expect(handleExecutiveDelegate).toHaveBeenCalled();
    expect(handleExecutiveHealth).toHaveBeenCalled();
  });
});
