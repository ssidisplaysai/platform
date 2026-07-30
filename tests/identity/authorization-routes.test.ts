import { describe, expect, it, jest } from "@jest/globals";

const getMetricsMock = jest.fn(() => ({
  evaluatedCount: 3,
  allowedCount: 2,
  deniedCount: 1,
  cacheHitCount: 1,
  cacheMissCount: 2,
  avgLatencyMs: 4,
  reasonCodeCounts: {
    ALLOWED: 2,
    DENIED_POLICY: 1,
  },
  resolverStats: {
    roleResolutions: 3,
    permissionResolutions: 3,
    capabilityResolutions: 3,
    workspaceResolutions: 3,
    resourceAuthorizations: 3,
  },
}));

const healthSnapshotMock = jest.fn(() => ({
  status: "HEALTHY",
  checks: [
    { name: "policy", status: "PASS", detail: "count=1" },
    { name: "cache", status: "PASS", detail: "size=1" },
    { name: "metrics", status: "PASS", detail: "evaluated=3" },
  ],
  generatedAt: new Date().toISOString(),
}));

jest.mock("@/lib/glw/auth", () => ({
  getGlwSession: async () => ({
    email: "admin@example.com",
    expiresAt: Date.now() + 60_000,
  }),
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
}));

jest.mock("@/platform/gop/auth/authorization", () => ({
  getGenesisAuthorizationService: () => ({
    getMetrics: getMetricsMock,
    healthSnapshot: healthSnapshotMock,
  }),
}));

import { GET as getAuthorizationHealth } from "@/app/api/gop/authorization/health/route";
import { GET as getAuthorizationMetrics } from "@/app/api/gop/authorization/metrics/route";

describe("authorization route surfaces", () => {
  it("returns authorization health payload", async () => {
    const response = await getAuthorizationHealth();
    const payload = await response.json() as {
      capability: string;
      health: { status: string };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("identity.authorization");
    expect(payload.health.status).toBe("HEALTHY");
  });

  it("returns authorization metrics payload", async () => {
    const response = await getAuthorizationMetrics();
    const payload = await response.json() as {
      capability: string;
      metrics: { evaluatedCount: number };
      health: { status: string };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("identity.authorization");
    expect(payload.metrics.evaluatedCount).toBe(3);
    expect(payload.health.status).toBe("HEALTHY");
  });
});
