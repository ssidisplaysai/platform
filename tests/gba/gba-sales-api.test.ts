import { describe, expect, it, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "mocked.session.token" }),
    set: () => undefined,
    delete: () => undefined,
  }),
}), { virtual: true });

import {
  createInMemorySalesApiDependencies,
  handleCreateSalesPipelineRecord,
  handleReviewSalesRecommendation,
  handleSalesDashboard,
  handleSalesRecommendations,
} from "@/lib/gba/sales-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const viewerSessionLoader = async () => ({ email: "viewer@example.com", expiresAt: Date.now() + 100000 });
const noSessionLoader = async () => null;

describe("gba sales api", () => {
  it("enforces authentication", async () => {
    const deps = createInMemorySalesApiDependencies();
    const response = await handleSalesDashboard(makeRequest("/api/gba/sales/dashboard"), { ...deps, sessionLoader: noSessionLoader });

    expect(response.status).toBe(401);
  });

  it("creates pipeline records for administrators", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemorySalesApiDependencies();

    const response = await handleCreateSalesPipelineRecord(makeRequest("/api/gba/sales/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: "acct-1",
        accountName: "Apollo Dynamics",
        opportunityReference: "opp-1",
        stage: "PROPOSAL",
        amountCents: 3100000,
        probabilityPercent: 60,
        expectedCloseAt: new Date().toISOString(),
      }),
    }), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(201);
  });

  it("rejects invalid recommendation review payload", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemorySalesApiDependencies();

    const response = await handleReviewSalesRecommendation(makeRequest("/api/gba/sales/recommendations/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salesRecommendationId: "missing", decision: "INVALID" }),
    }), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(400);
  });

  it("denies viewer pipeline mutation by policy", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemorySalesApiDependencies();

    const response = await handleCreateSalesPipelineRecord(makeRequest("/api/gba/sales/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: "acct-view",
        accountName: "Viewer Account",
        opportunityReference: "opp-view",
        stage: "PROSPECT",
        amountCents: 500000,
        probabilityPercent: 20,
        expectedCloseAt: new Date().toISOString(),
      }),
    }), {
      ...deps,
      sessionLoader: viewerSessionLoader,
    });

    expect(response.status).toBe(403);
  });

  it("returns recommendations for authorized reads", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemorySalesApiDependencies();

    const response = await handleSalesRecommendations(makeRequest("/api/gba/sales/recommendations"), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(200);
  });
});
