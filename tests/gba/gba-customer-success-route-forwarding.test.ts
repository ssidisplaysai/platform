import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/gba/customer-success-api", () => ({
  handleCustomerSuccessDashboard: jest.fn(async () => Response.json({ ok: true })),
  handleCustomerSuccessCustomerHealth: jest.fn(async () => Response.json({ ok: true })),
  handleCustomerSuccessOnboarding: jest.fn(async () => Response.json({ ok: true })),
  handleCustomerSuccessSuccessPlans: jest.fn(async () => Response.json({ ok: true })),
  handleCustomerSuccessRenewals: jest.fn(async () => Response.json({ ok: true })),
  handleCustomerSuccessSatisfaction: jest.fn(async () => Response.json({ ok: true })),
  handleCustomerSuccessKpis: jest.fn(async () => Response.json({ ok: true })),
  handleCustomerSuccessRecommendations: jest.fn(async () => Response.json({ ok: true })),
  handleReviewCustomerSuccessRecommendation: jest.fn(async () => Response.json({ ok: true })),
  handleCustomerSuccessExecutiveReports: jest.fn(async () => Response.json({ ok: true })),
  handleCustomerSuccessTimeline: jest.fn(async () => Response.json({ ok: true })),
  handleCustomerSuccessHealth: jest.fn(async () => Response.json({ ok: true })),
}));

import { GET as getDashboardRoute } from "@/app/api/gba/customer-success/dashboard/route";
import { GET as getCustomerHealthRoute } from "@/app/api/gba/customer-success/customer-health/route";
import { GET as getOnboardingRoute } from "@/app/api/gba/customer-success/onboarding/route";
import { GET as getSuccessPlansRoute } from "@/app/api/gba/customer-success/success-plans/route";
import { GET as getRenewalsRoute } from "@/app/api/gba/customer-success/renewals/route";
import { GET as getSatisfactionRoute } from "@/app/api/gba/customer-success/satisfaction/route";
import { GET as getKpisRoute } from "@/app/api/gba/customer-success/kpis/route";
import { GET as getRecommendationsRoute } from "@/app/api/gba/customer-success/recommendations/route";
import { POST as postReviewRoute } from "@/app/api/gba/customer-success/recommendations/review/route";
import { GET as getReportsRoute } from "@/app/api/gba/customer-success/executive-reports/route";
import { GET as getTimelineRoute } from "@/app/api/gba/customer-success/timeline/route";
import { GET as getHealthRoute } from "@/app/api/gba/customer-success/health/route";

import {
  handleCustomerSuccessCustomerHealth,
  handleCustomerSuccessDashboard,
  handleCustomerSuccessExecutiveReports,
  handleCustomerSuccessHealth,
  handleCustomerSuccessKpis,
  handleCustomerSuccessOnboarding,
  handleCustomerSuccessRecommendations,
  handleCustomerSuccessRenewals,
  handleCustomerSuccessSatisfaction,
  handleCustomerSuccessSuccessPlans,
  handleCustomerSuccessTimeline,
  handleReviewCustomerSuccessRecommendation,
} from "@/lib/gba/customer-success-api";

describe("gba customer success route forwarding", () => {
  it("forwards gba customer success api routes", async () => {
    await getDashboardRoute(new Request("http://localhost/api/gba/customer-success/dashboard"));
    await getCustomerHealthRoute(new Request("http://localhost/api/gba/customer-success/customer-health"));
    await getOnboardingRoute(new Request("http://localhost/api/gba/customer-success/onboarding"));
    await getSuccessPlansRoute(new Request("http://localhost/api/gba/customer-success/success-plans"));
    await getRenewalsRoute(new Request("http://localhost/api/gba/customer-success/renewals"));
    await getSatisfactionRoute(new Request("http://localhost/api/gba/customer-success/satisfaction"));
    await getKpisRoute(new Request("http://localhost/api/gba/customer-success/kpis"));
    await getRecommendationsRoute(new Request("http://localhost/api/gba/customer-success/recommendations"));
    await postReviewRoute(new Request("http://localhost/api/gba/customer-success/recommendations/review", { method: "POST" }));
    await getReportsRoute(new Request("http://localhost/api/gba/customer-success/executive-reports"));
    await getTimelineRoute(new Request("http://localhost/api/gba/customer-success/timeline"));
    await getHealthRoute(new Request("http://localhost/api/gba/customer-success/health"));

    expect(handleCustomerSuccessDashboard).toHaveBeenCalled();
    expect(handleCustomerSuccessCustomerHealth).toHaveBeenCalled();
    expect(handleCustomerSuccessOnboarding).toHaveBeenCalled();
    expect(handleCustomerSuccessSuccessPlans).toHaveBeenCalled();
    expect(handleCustomerSuccessRenewals).toHaveBeenCalled();
    expect(handleCustomerSuccessSatisfaction).toHaveBeenCalled();
    expect(handleCustomerSuccessKpis).toHaveBeenCalled();
    expect(handleCustomerSuccessRecommendations).toHaveBeenCalled();
    expect(handleReviewCustomerSuccessRecommendation).toHaveBeenCalled();
    expect(handleCustomerSuccessExecutiveReports).toHaveBeenCalled();
    expect(handleCustomerSuccessTimeline).toHaveBeenCalled();
    expect(handleCustomerSuccessHealth).toHaveBeenCalled();
  });
});
