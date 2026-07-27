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
  createInMemoryExecutiveApiDependencies,
  handleExecutiveDashboard,
  handleGenerateExecutiveBriefing,
  handleExecutiveDelegate,
} from "@/lib/gba/executive-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const viewerSessionLoader = async () => ({ email: "viewer@example.com", expiresAt: Date.now() + 100000 });
const noSessionLoader = async () => null;

describe("gba executive api", () => {
  it("enforces authentication", async () => {
    const deps = createInMemoryExecutiveApiDependencies();
    const response = await handleExecutiveDashboard(makeRequest("/api/gba/executive/dashboard"), {
      ...deps,
      sessionLoader: noSessionLoader,
    });

    expect(response.status).toBe(401);
  });

  it("generates executive briefing for administrator", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryExecutiveApiDependencies();

    const response = await handleGenerateExecutiveBriefing(makeRequest("/api/gba/executive/briefings/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: "daily" }),
    }), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(201);
  });

  it("rejects invalid delegation target agent", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryExecutiveApiDependencies();

    const response = await handleExecutiveDelegate(makeRequest("/api/gba/executive/delegate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetAgent: "INVALID_AGENT", objective: "Do work" }),
    }), {
      ...deps,
      sessionLoader: adminSessionLoader,
    });

    expect(response.status).toBe(400);
  });

  it("denies viewer delegation action by policy", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryExecutiveApiDependencies();

    const response = await handleExecutiveDelegate(makeRequest("/api/gba/executive/delegate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetAgent: "OPERATIONS_AGENT", objective: "Coordinate shipping" }),
    }), {
      ...deps,
      sessionLoader: viewerSessionLoader,
    });

    expect(response.status).toBe(403);
  });
});
