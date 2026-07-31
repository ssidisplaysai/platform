import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/glw/auth", () => ({
  getGlwSession: async () => ({ email: "admin@example.com", expiresAt: Date.now() + 60_000 }),
}));

jest.mock("@/platform/gop/auth/runtime", () => ({
  buildGenesisSubjectFromSession: () => ({
    actorId: "admin@example.com",
    actorName: "admin@example.com",
    role: "ADMINISTRATOR",
    permissions: ["read", "write", "admin"],
    workspaceMemberships: [
      {
        workspaceId: "glw-led-display-warehouse",
        actorId: "admin@example.com",
        role: "ADMINISTRATOR",
        permissions: ["read", "write", "admin"],
        active: true,
      },
    ],
  }),
  getGenesisAuthorizationResolver: () => ({
    authorize: () => ({ allowed: true, reason: "ok" }),
  }),
}));

jest.mock("@/lib/glw/prisma", () => ({
  getPrismaClient: () => ({
    $queryRaw: async () => [],
  }),
}));

jest.mock("@/platform/gop/metrics-from-events", () => ({
  reduceEventsToMetrics: () => ({ jobs: 0 }),
  metricsFromDerived: () => ({ successRate: 1 }),
}));

jest.mock("@/platform/identity/services", () => ({
  getGenesisAuthenticationService: () => ({
    getMetrics: () => ({ loginSuccessCount: 1 }),
    getProviderHealth: () => [{ providerId: "glw-local", status: "HEALTHY", detail: "ok" }],
    healthSnapshot: async () => ({
      status: "HEALTHY",
      checks: [{ name: "configuration", status: "PASS", detail: "ok" }],
      generatedAt: new Date().toISOString(),
    }),
  }),
}));

jest.mock("@/platform/gop/auth/authorization", () => ({
  getGenesisAuthorizationService: () => ({
    getMetrics: () => ({ evaluatedCount: 2, deniedCount: 0 }),
    healthSnapshot: () => ({
      status: "HEALTHY",
      checks: [{ name: "policy", status: "PASS", detail: "count=2" }],
      generatedAt: new Date().toISOString(),
    }),
  }),
}));

jest.mock("@/platform/messaging", () => ({
  getGenesisMessageBus: () => ({
    capabilityMetadata: () => ({ capabilityId: "platform.messaging", transport: "InMemoryTransport" }),
    getMetrics: () => ({ publishedCount: 3, deliveredCount: 3 }),
    healthSnapshot: () => ({
      status: "HEALTHY",
      checks: [{ name: "transport", status: "PASS", detail: "ok" }],
      generatedAt: new Date().toISOString(),
    }),
    getQueueStats: () => ({ published: 3, delivered: 3, failed: 0, deadLettered: 0, inFlight: 0 }),
    getSubscriberStats: () => ({ "topic.example": 1 }),
    getOperationalReadiness: async () => ({
      queueDepth: 0,
      retryDepth: 0,
      deadLetterDepth: 0,
      oldestPendingMessageAt: null,
      durability: "FILE_PERSISTED",
      multiNodeReadiness: "TRANSPORT_ABSTRACTION_READY",
    }),
  }),
}));

jest.mock("@/platform/workflow", () => ({
  getGenesisWorkflowEngine: () => ({
    capabilityMetadata: () => ({ capabilityId: "platform.workflow", version: "1.0.0" }),
    getMetrics: () => ({ createdInstances: 2, completedInstances: 1 }),
    healthSnapshot: async () => ({
      status: "HEALTHY",
      checks: [{ name: "workflow-execution", status: "PASS", detail: "ok" }],
      generatedAt: new Date().toISOString(),
    }),
    getOperationalReadiness: () => ({
      runningInstances: 0,
      pausedInstances: 0,
      completedInstances: 1,
      failedInstances: 0,
      timedOutInstances: 0,
      retries: 0,
      compensationRuns: 0,
    }),
  }),
}));

import { handleGetGopMetrics } from "@/lib/gop/events-api";

describe("gop mission control authorization integration", () => {
  it("includes authorization metrics and health in metrics payload", async () => {
    const response = await handleGetGopMetrics(new Request("https://example.test/api/gop/metrics?limit=100"));
    const payload = await response.json() as {
      authorizationMetrics?: { evaluatedCount: number };
      authorizationHealth?: { status: string };
      authentication?: { loginSuccessCount: number };
      messagingMetadata?: { capabilityId: string };
      messagingMetrics?: { publishedCount: number };
      messagingHealth?: { status: string };
      messagingReadiness?: { durability: string };
      workflowMetadata?: { capabilityId: string };
      workflowMetrics?: { createdInstances: number };
      workflowHealth?: { status: string };
      workflowReadiness?: { completedInstances: number };
    };

    expect(response.status).toBe(200);
    expect(payload.authentication?.loginSuccessCount).toBe(1);
    expect(payload.authorizationMetrics?.evaluatedCount).toBe(2);
    expect(payload.authorizationHealth?.status).toBe("HEALTHY");
    expect(payload.messagingMetadata?.capabilityId).toBe("platform.messaging");
    expect(payload.messagingMetrics?.publishedCount).toBe(3);
    expect(payload.messagingHealth?.status).toBe("HEALTHY");
    expect(payload.messagingReadiness?.durability).toBe("FILE_PERSISTED");
    expect(payload.workflowMetadata?.capabilityId).toBe("platform.workflow");
    expect(payload.workflowMetrics?.createdInstances).toBe(2);
    expect(payload.workflowHealth?.status).toBe("HEALTHY");
    expect(payload.workflowReadiness?.completedInstances).toBe(1);
  });
});
