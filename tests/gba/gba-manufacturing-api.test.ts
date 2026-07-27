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
  createInMemoryManufacturingApiDependencies,
  handleCreateManufacturingProductionOrder,
  handleManufacturingDashboard,
  handleManufacturingRecommendations,
  handleReviewManufacturingRecommendation,
} from "@/lib/gba/manufacturing-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const viewerSessionLoader = async () => ({ email: "viewer@example.com", expiresAt: Date.now() + 100000 });
const noSessionLoader = async () => null;

describe("gba manufacturing api", () => {
  it("enforces authentication", async () => {
    const deps = createInMemoryManufacturingApiDependencies();
    const response = await handleManufacturingDashboard(makeRequest("/api/gba/manufacturing/dashboard"), {
      ...deps,
      sessionLoader: noSessionLoader,
    });

    expect(response.status).toBe(401);
  });

  it("creates production order for administrator", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryManufacturingApiDependencies();

    const response = await handleCreateManufacturingProductionOrder(makeRequest("/api/gba/manufacturing/production-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Display Batch Z",
        sku: "FG-DISPLAY-900",
        priority: "P1",
        quantityPlanned: 100,
        scheduledStartAt: new Date(Date.now() + 3600000).toISOString(),
        scheduledEndAt: new Date(Date.now() + 7200000).toISOString(),
      }),
    }), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(201);
  });

  it("rejects invalid recommendation review payload", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryManufacturingApiDependencies();

    const response = await handleReviewManufacturingRecommendation(makeRequest("/api/gba/manufacturing/recommendations/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manufacturingRecommendationId: "missing", decision: "INVALID" }),
    }), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(400);
  });

  it("denies viewer production-order mutation by policy", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryManufacturingApiDependencies();

    const response = await handleCreateManufacturingProductionOrder(makeRequest("/api/gba/manufacturing/production-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Viewer mutation",
        sku: "FG-DISPLAY-900",
        priority: "P2",
        quantityPlanned: 80,
        scheduledStartAt: new Date(Date.now() + 3600000).toISOString(),
        scheduledEndAt: new Date(Date.now() + 7200000).toISOString(),
      }),
    }), {
      ...deps,
      sessionLoader: viewerSessionLoader,
    });

    expect(response.status).toBe(403);
  });

  it("returns recommendations for authorized read", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryManufacturingApiDependencies();

    const response = await handleManufacturingRecommendations(makeRequest("/api/gba/manufacturing/recommendations"), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(200);
  });
});
