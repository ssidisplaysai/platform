import { describe, expect, it, jest } from "@jest/globals";

const healthSnapshotMock = jest.fn(async () => ({
  status: "HEALTHY",
  checks: [{ name: "configuration", status: "PASS", detail: "ok" }],
  generatedAt: new Date().toISOString(),
}));

const getMetricsMock = jest.fn(() => ({
  loginSuccessCount: 1,
  loginFailureCount: 0,
  providerUnavailableCount: 0,
  authenticationErrorCount: 0,
  credentialRejectedCount: 0,
  sessionCreatedCount: 1,
  sessionExpiredCount: 0,
  sessionRevokedCount: 0,
  sessionRenewedCount: 0,
  logoutCount: 0,
  activeSessionCount: 1,
  providers: { "glw-local": { success: 1, failure: 0 } },
}));

const getProviderHealthMock = jest.fn(() => [
  { providerId: "glw-local", status: "HEALTHY", detail: "ok" },
]);

jest.mock("@/platform/identity/services", () => ({
  getGenesisAuthenticationService: () => ({
    healthSnapshot: healthSnapshotMock,
    getMetrics: getMetricsMock,
    getProviderHealth: getProviderHealthMock,
  }),
}));

import { GET as getAuthHealth } from "@/app/api/gop/authentication/health/route";
import { GET as getAuthMetrics } from "@/app/api/gop/authentication/metrics/route";

describe("authentication route surfaces", () => {
  it("returns authentication health payload", async () => {
    const response = await getAuthHealth();
    const payload = await response.json() as {
      capability: string;
      health: { status: string };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("identity.authentication");
    expect(payload.health.status).toBe("HEALTHY");
  });

  it("returns authentication metrics and provider health", async () => {
    const response = await getAuthMetrics();
    const payload = await response.json() as {
      capability: string;
      metrics: { loginSuccessCount: number };
      providers: Array<{ providerId: string; status: string }>;
      health: { status: string };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("identity.authentication");
    expect(payload.metrics.loginSuccessCount).toBe(1);
    expect(payload.providers[0]?.providerId).toBe("glw-local");
    expect(payload.health.status).toBe("HEALTHY");
  });
});
