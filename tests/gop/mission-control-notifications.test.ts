import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/glw/auth", () => ({
  getGlwSession: async () => ({ email: "admin@example.com", expiresAt: Date.now() + 60_000 }),
}));

jest.mock("@/platform/notifications/services/runtime", () => ({
  getGenesisNotificationEngine: () => ({
    capabilityMetadata: () => ({
      capabilityId: "platform.notifications",
      capabilityName: "Genesis Notification Platform",
      version: "1.0.0",
      deliveryModel: "DURABLE_ATTEMPT_TRACKED",
      providers: ["in-memory-email", "in-memory-in_app"],
    }),
    healthSnapshot: async () => ({
      status: "HEALTHY",
      checks: [{ name: "providers", status: "PASS", detail: "provider count 2" }],
      generatedAt: new Date().toISOString(),
    }),
    getOperationalReadiness: async () => ({
      queueDepth: 1,
      deferredDepth: 0,
      deadLetterDepth: 0,
      durability: "FILE_PERSISTED",
      idempotency: "IDEMPOTENCY_KEY_ENFORCED",
      providerMode: "IN_MEMORY_ADAPTERS",
    }),
    getMetrics: async () => ({
      requestedNotifications: 10,
      deliveredNotifications: 9,
      failedNotifications: 1,
    }),
  }),
}));

import { GET as getHealth } from "@/app/api/gop/notifications/health/route";
import { GET as getMetrics } from "@/app/api/gop/notifications/metrics/route";

describe("gop mission control notification endpoints", () => {
  it("returns notification health payload", async () => {
    const response = await getHealth();
    const payload = await response.json() as {
      capability?: string;
      metadata?: { capabilityId: string };
      health?: { status: string };
      readiness?: { durability: string };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("platform.notifications");
    expect(payload.metadata?.capabilityId).toBe("platform.notifications");
    expect(payload.health?.status).toBe("HEALTHY");
    expect(payload.readiness?.durability).toBe("FILE_PERSISTED");
  });

  it("returns notification metrics payload", async () => {
    const response = await getMetrics();
    const payload = await response.json() as {
      capability?: string;
      metadata?: { capabilityId: string };
      metrics?: { requestedNotifications: number; deliveredNotifications: number };
      readiness?: { queueDepth: number };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("platform.notifications");
    expect(payload.metadata?.capabilityId).toBe("platform.notifications");
    expect(payload.metrics?.requestedNotifications).toBe(10);
    expect(payload.metrics?.deliveredNotifications).toBe(9);
    expect(payload.readiness?.queueDepth).toBe(1);
  });
});
