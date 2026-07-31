import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/glw/auth", () => ({
  getGlwSession: async () => ({ email: "admin@example.com", expiresAt: Date.now() + 60_000 }),
}));

jest.mock("@/platform/messaging", () => ({
  getGenesisMessageBus: () => ({
    capabilityMetadata: () => ({
      capabilityId: "platform.messaging",
      capabilityName: "Genesis Enterprise Messaging Platform",
      version: "1.0.0",
      transport: "InMemoryTransport",
    }),
    getMetrics: () => ({ publishedCount: 10, deliveredCount: 9 }),
    healthSnapshot: () => ({
      status: "HEALTHY",
      checks: [{ name: "transport", status: "PASS", detail: "ok" }],
      generatedAt: new Date().toISOString(),
    }),
    getQueueStats: () => ({ published: 10, delivered: 9, failed: 1, deadLettered: 1, inFlight: 0 }),
    getSubscriberStats: () => ({ "topic.orders.created": 2 }),
    getDeadLetters: () => [{ messageId: "dead-1" }],
    getOperationalReadiness: async () => ({
      queueDepth: 5,
      retryDepth: 2,
      deadLetterDepth: 1,
      oldestPendingMessageAt: "2026-07-31T12:00:00.000Z",
      durability: "FILE_PERSISTED",
      multiNodeReadiness: "TRANSPORT_ABSTRACTION_READY",
    }),
  }),
}));

import { GET as getHealth } from "@/app/api/gop/messaging/health/route";
import { GET as getMetrics } from "@/app/api/gop/messaging/metrics/route";

describe("gop mission control messaging endpoints", () => {
  it("returns messaging health payload", async () => {
    const response = await getHealth();
    const payload = await response.json() as {
      capability?: string;
      metadata?: { capabilityId: string };
      health?: { status: string };
      readiness?: { durability: string };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("platform.messaging");
    expect(payload.metadata?.capabilityId).toBe("platform.messaging");
    expect(payload.health?.status).toBe("HEALTHY");
    expect(payload.readiness?.durability).toBe("FILE_PERSISTED");
  });

  it("returns messaging metrics payload", async () => {
    const response = await getMetrics();
    const payload = await response.json() as {
      capability?: string;
      metrics?: { publishedCount: number };
      deadLetters?: number;
      subscribers?: Record<string, number>;
      queueDepth?: number;
      retryDepth?: number;
      oldestPendingMessageAt?: string;
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("platform.messaging");
    expect(payload.metrics?.publishedCount).toBe(10);
    expect(payload.deadLetters).toBe(1);
    expect(payload.subscribers?.["topic.orders.created"]).toBe(2);
    expect(payload.queueDepth).toBe(5);
    expect(payload.retryDepth).toBe(2);
    expect(payload.oldestPendingMessageAt).toBe("2026-07-31T12:00:00.000Z");
  });
});
