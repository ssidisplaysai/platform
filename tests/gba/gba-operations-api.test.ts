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
  createInMemoryOperationsApiDependencies,
  handleOperationsDashboard,
  handleCreateOperationsWorkOrder,
  handleReviewOperationsRecommendation,
  handleOperationsRecommendations,
} from "@/lib/gba/operations-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const viewerSessionLoader = async () => ({ email: "viewer@example.com", expiresAt: Date.now() + 100000 });
const noSessionLoader = async () => null;

describe("gba operations api", () => {
  it("enforces authentication", async () => {
    const deps = createInMemoryOperationsApiDependencies();
    const response = await handleOperationsDashboard(makeRequest("/api/gba/operations/dashboard"), {
      ...deps,
      sessionLoader: noSessionLoader,
    });

    expect(response.status).toBe(401);
  });

  it("creates work order for administrator", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryOperationsApiDependencies();

    const response = await handleCreateOperationsWorkOrder(makeRequest("/api/gba/operations/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Expedite final assembly", priority: "P1", dueDate: new Date(Date.now() + 86400000).toISOString() }),
    }), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(201);
  });

  it("rejects invalid recommendation review payload", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryOperationsApiDependencies();

    const response = await handleReviewOperationsRecommendation(makeRequest("/api/gba/operations/recommendations/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operationsRecommendationId: "missing", decision: "INVALID" }),
    }), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(400);
  });

  it("denies viewer work-order mutation by policy", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryOperationsApiDependencies();

    const response = await handleCreateOperationsWorkOrder(makeRequest("/api/gba/operations/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Viewer mutation", priority: "P2", dueDate: new Date(Date.now() + 86400000).toISOString() }),
    }), {
      ...deps,
      sessionLoader: viewerSessionLoader,
    });

    expect(response.status).toBe(403);
  });

  it("returns recommendations for authorized read", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryOperationsApiDependencies();

    const response = await handleOperationsRecommendations(makeRequest("/api/gba/operations/recommendations"), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(200);
  });
});
