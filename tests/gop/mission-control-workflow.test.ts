import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/glw/auth", () => ({
  getGlwSession: async () => ({ email: "admin@example.com", expiresAt: Date.now() + 60_000 }),
}));

jest.mock("@/platform/workflow", () => ({
  getGenesisWorkflowEngine: () => ({
    capabilityMetadata: () => ({
      capabilityId: "platform.workflow",
      capabilityName: "Genesis Enterprise Workflow Platform",
      version: "1.0.0",
    }),
    getMetrics: () => ({ createdInstances: 2, completedInstances: 1, failedInstances: 0 }),
    healthSnapshot: async () => ({
      status: "HEALTHY",
      checks: [{ name: "workflow-execution", status: "PASS", detail: "ok" }],
      generatedAt: new Date().toISOString(),
    }),
    getOperationalReadiness: () => ({
      runningInstances: 1,
      pausedInstances: 0,
      completedInstances: 1,
      failedInstances: 0,
      timedOutInstances: 0,
      retries: 1,
      compensationRuns: 0,
    }),
  }),
}));

import { GET as getWorkflowHealth } from "@/app/api/gop/workflow/health/route";
import { GET as getWorkflowMetrics } from "@/app/api/gop/workflow/metrics/route";

describe("gop mission control workflow endpoints", () => {
  it("returns workflow health payload", async () => {
    const response = await getWorkflowHealth();
    const payload = await response.json() as {
      capability?: string;
      metadata?: { capabilityId: string };
      health?: { status: string };
      readiness?: { runningInstances: number };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("platform.workflow");
    expect(payload.metadata?.capabilityId).toBe("platform.workflow");
    expect(payload.health?.status).toBe("HEALTHY");
    expect(payload.readiness?.runningInstances).toBe(1);
  });

  it("returns workflow metrics payload", async () => {
    const response = await getWorkflowMetrics();
    const payload = await response.json() as {
      capability?: string;
      metrics?: { createdInstances: number };
      readiness?: { retries: number };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("platform.workflow");
    expect(payload.metrics?.createdInstances).toBe(2);
    expect(payload.readiness?.retries).toBe(1);
  });
});
