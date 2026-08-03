import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/glw/auth", () => ({
  getGlwSession: async () => ({ email: "admin@example.com", expiresAt: Date.now() + 60_000 }),
}));

jest.mock("@/platform/scheduling", () => ({
  getGenesisSchedulingEngine: () => ({
    capabilityMetadata: () => ({
      capabilityId: "platform.scheduling",
      capabilityName: "Genesis Scheduling Platform",
      version: "1.0.0",
    }),
    getMetrics: () => ({ registeredSchedules: 4, dispatchedOccurrences: 9 }),
    healthSnapshot: async () => ({
      status: "HEALTHY",
      checks: [{ name: "dispatch", status: "PASS", detail: "ok" }],
      generatedAt: new Date().toISOString(),
    }),
    getOperationalReadiness: () => ({
      activeSchedules: 2,
      pausedSchedules: 1,
      dispatchFailures: 0,
      recoveryCount: 1,
      durability: "FILE_PERSISTED",
      multiNodeReadiness: "CLAIM_STORE_ABSTRACTION_SINGLE_WRITER",
    }),
  }),
}));

import { GET as getSchedulingHealth } from "@/app/api/gop/scheduling/health/route";
import { GET as getSchedulingMetrics } from "@/app/api/gop/scheduling/metrics/route";

describe("gop mission control scheduling endpoints", () => {
  it("returns scheduling health payload", async () => {
    const response = await getSchedulingHealth();
    const payload = await response.json() as {
      capability?: string;
      metadata?: { capabilityId: string };
      health?: { status: string };
      readiness?: { activeSchedules: number };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("platform.scheduling");
    expect(payload.metadata?.capabilityId).toBe("platform.scheduling");
    expect(payload.health?.status).toBe("HEALTHY");
    expect(payload.readiness?.activeSchedules).toBe(2);
  });

  it("returns scheduling metrics payload", async () => {
    const response = await getSchedulingMetrics();
    const payload = await response.json() as {
      capability?: string;
      metrics?: { registeredSchedules: number; dispatchedOccurrences: number };
      readiness?: { dispatchFailures: number };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("platform.scheduling");
    expect(payload.metrics?.registeredSchedules).toBe(4);
    expect(payload.metrics?.dispatchedOccurrences).toBe(9);
    expect(payload.readiness?.dispatchFailures).toBe(0);
  });
});
