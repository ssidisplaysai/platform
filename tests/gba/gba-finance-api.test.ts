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
  createInMemoryFinanceApiDependencies,
  handleFinanceBudgets,
  handleFinanceDashboard,
  handleFinanceRecommendations,
  handleReviewFinanceRecommendation,
} from "@/lib/gba/finance-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const viewerSessionLoader = async () => ({ email: "viewer@example.com", expiresAt: Date.now() + 100000 });
const noSessionLoader = async () => null;

describe("gba finance api", () => {
  it("enforces authentication", async () => {
    const deps = createInMemoryFinanceApiDependencies();
    const response = await handleFinanceDashboard(makeRequest("/api/gba/finance/dashboard"), { ...deps, sessionLoader: noSessionLoader });

    expect(response.status).toBe(401);
  });

  it("returns recommendations for authorized reads", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryFinanceApiDependencies();

    const response = await handleFinanceRecommendations(makeRequest("/api/gba/finance/recommendations"), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(200);
  });

  it("rejects invalid recommendation review payload", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryFinanceApiDependencies();

    const response = await handleReviewFinanceRecommendation(makeRequest("/api/gba/finance/recommendations/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ financeRecommendationId: "missing", decision: "INVALID" }),
    }), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(400);
  });

  it("denies viewer budget writes by policy", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryFinanceApiDependencies();

    const response = await handleFinanceBudgets(makeRequest("/api/gba/finance/budgets"), {
      ...deps,
      sessionLoader: viewerSessionLoader,
    });

    expect(response.status).toBe(200);
  });
});
