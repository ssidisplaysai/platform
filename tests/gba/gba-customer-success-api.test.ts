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
  createInMemoryCustomerSuccessApiDependencies,
  handleCustomerSuccessDashboard,
  handleCustomerSuccessRecommendations,
  handleCustomerSuccessRenewals,
  handleReviewCustomerSuccessRecommendation,
} from "@/lib/gba/customer-success-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const viewerSessionLoader = async () => ({ email: "viewer@example.com", expiresAt: Date.now() + 100000 });
const noSessionLoader = async () => null;

describe("gba customer success api", () => {
  it("enforces authentication", async () => {
    const deps = createInMemoryCustomerSuccessApiDependencies();
    const response = await handleCustomerSuccessDashboard(makeRequest("/api/gba/customer-success/dashboard"), { ...deps, sessionLoader: noSessionLoader });

    expect(response.status).toBe(401);
  });

  it("returns recommendations for authorized reads", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryCustomerSuccessApiDependencies();

    const response = await handleCustomerSuccessRecommendations(makeRequest("/api/gba/customer-success/recommendations"), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(200);
  });

  it("rejects invalid recommendation review payload", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryCustomerSuccessApiDependencies();

    const response = await handleReviewCustomerSuccessRecommendation(makeRequest("/api/gba/customer-success/recommendations/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerSuccessRecommendationId: "missing", decision: "INVALID" }),
    }), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(400);
  });

  it("allows viewer renewal reads by policy", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryCustomerSuccessApiDependencies();

    const response = await handleCustomerSuccessRenewals(makeRequest("/api/gba/customer-success/renewals"), {
      ...deps,
      sessionLoader: viewerSessionLoader,
    });

    expect(response.status).toBe(200);
  });
});
