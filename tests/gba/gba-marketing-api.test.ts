import { describe, expect, it, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "mocked.session.token" }),
    set: () => undefined,
    delete: () => undefined,
  }),
}), { virtual: true });

import { createInMemoryMarketingApiDependencies, handleCreateMarketingCampaignPlan, handleMarketingDashboard, handleMarketingRecommendations, handleReviewMarketingRecommendation } from "@/lib/gba/marketing-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const viewerSessionLoader = async () => ({ email: "viewer@example.com", expiresAt: Date.now() + 100000 });
const noSessionLoader = async () => null;

describe("gba marketing api", () => {
  it("enforces authentication", async () => {
    const deps = createInMemoryMarketingApiDependencies();
    const response = await handleMarketingDashboard(makeRequest("/api/gba/marketing/dashboard?projectId=project-1"), { ...deps, sessionLoader: noSessionLoader });

    expect(response.status).toBe(401);
  });

  it("creates campaign plans for administrators", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryMarketingApiDependencies();

    const response = await handleCreateMarketingCampaignPlan(makeRequest("/api/gba/marketing/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        campaignName: "Launch Motion",
        objective: "Drive launch demand",
        targetAudience: "Enterprise operators",
        channelFocus: ["organic_search", "email"],
        budgetCents: 200000,
        expectedImpressions: 100000,
        expectedConversions: 250,
      }),
    }), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(201);
  });

  it("rejects invalid recommendation review payload", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryMarketingApiDependencies();

    const response = await handleReviewMarketingRecommendation(makeRequest("/api/gba/marketing/recommendations/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketingRecommendationId: "missing", decision: "INVALID" }),
    }), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(400);
  });

  it("denies viewer campaign mutation by policy", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryMarketingApiDependencies();

    const response = await handleCreateMarketingCampaignPlan(makeRequest("/api/gba/marketing/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        campaignName: "Viewer mutation",
        objective: "Should be denied",
        targetAudience: "Operators",
        channelFocus: ["email"],
        budgetCents: 100000,
        expectedImpressions: 10000,
        expectedConversions: 20,
      }),
    }), {
      ...deps,
      sessionLoader: viewerSessionLoader,
    });

    expect(response.status).toBe(403);
  });

  it("returns marketing recommendations for authorized read", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryMarketingApiDependencies();

    const response = await handleMarketingRecommendations(makeRequest("/api/gba/marketing/recommendations?projectId=project-1"), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(200);
  });
});
