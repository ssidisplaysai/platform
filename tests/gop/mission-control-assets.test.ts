import { describe, expect, it, jest } from "@jest/globals";

let sessionState: { email: string; expiresAt: number } | null = {
  email: "admin@example.com",
  expiresAt: Date.now() + 60_000,
};

let deniedCount = 0;

jest.mock("@/lib/glw/auth", () => ({
  getGlwSession: async () => sessionState,
}));

jest.mock("@/platform/gop/auth/runtime", () => ({
  buildGenesisSubjectFromSession: (session: { email: string } | null) => ({
    actorId: session?.email ?? "anonymous",
    actorName: session?.email ?? "anonymous",
    role: session?.email === "admin@example.com" ? "ADMINISTRATOR" : "VIEWER",
    permissions: session?.email === "admin@example.com" ? ["read", "metrics", "admin"] : ["read"],
    workspaceMemberships: [{ workspaceId: "glw-led-display-warehouse", actorId: session?.email ?? "anonymous", role: "VIEWER", permissions: ["read"], active: true }],
  }),
  getGenesisAuthorizationResolver: () => ({
    authorize: (request: { action: { actionId: string }; subject: { role: string } }) => {
      const allowedActions = ["assets:health:view", "assets:metrics:view"];
      if (request.subject.role !== "ADMINISTRATOR") {
        deniedCount += 1;
        return { allowed: false, denied: true, reasonCode: "DENIED_DEFAULT", reason: "No policy allowed this request.", policyId: "default-deny" };
      }
      if (!allowedActions.includes(request.action.actionId)) {
        deniedCount += 1;
        return { allowed: false, denied: true, reasonCode: "DENIED_DEFAULT", reason: "No policy allowed this request.", policyId: "default-deny" };
      }
      return { allowed: true, denied: false, reasonCode: "ALLOWED", reason: "allowed", policyId: "admin-all-access" };
    },
  }),
}));

jest.mock("@/platform/gop/auth/authorization", () => ({
  getGenesisAuthorizationService: () => ({
    getMetrics: () => ({ deniedCount }),
  }),
}));

jest.mock("@/platform/assets", () => ({
  getGenesisAssetRuntime: async () => ({
    observability: async () => ({
      capability: "platform.assets",
      metadata: {
        contractVersion: "1.0.0",
        runtimeVersion: "1.0.0",
        persistence: "file.asset-state.v1",
        providers: ["local-filesystem"],
      },
      metrics: {
        assetsTotal: 4,
        activeAssets: 3,
        archivedAssets: 1,
        softDeletedAssets: 0,
        versionsTotal: 6,
        checksumVerifications: 5,
        integrityFailures: 1,
        relationshipsTotal: 2,
        collectionsTotal: 1,
        assetsInCollections: 3,
        retentionProtectedAssets: 1,
        auditEvents: 12,
        recoveryCount: 1,
        corruptStateCount: 0,
      },
      health: {
        status: "DEGRADED",
        generatedAt: new Date().toISOString(),
        checks: [{ name: "integrity", status: "WARN", detail: "failures=1" }],
      },
    }),
  }),
}));

import { GET as getHealth } from "@/app/api/gop/assets/health/route";
import { GET as getMetrics } from "@/app/api/gop/assets/metrics/route";
import { authorizeAssetObservability } from "@/lib/gop/asset-observability-authorization";

describe("gop mission control assets endpoints", () => {
  it("returns unauthorized when session is missing", async () => {
    sessionState = null;

    const response = await getHealth();
    expect(response.status).toBe(401);
  });

  it("returns assets health payload", async () => {
    sessionState = { email: "admin@example.com", expiresAt: Date.now() + 60_000 };

    const response = await getHealth();
    const payload = await response.json() as {
      capability?: string;
      health?: { status: string };
      metadata?: { contractVersion: string };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("platform.assets");
    expect(payload.metadata?.contractVersion).toBe("1.0.0");
    expect(payload.health?.status).toBe("DEGRADED");
  });

  it("returns assets metrics payload", async () => {
    sessionState = { email: "admin@example.com", expiresAt: Date.now() + 60_000 };

    const response = await getMetrics();
    const payload = await response.json() as {
      capability?: string;
      metrics?: { assetsTotal: number; integrityFailures: number };
      health?: { status: string };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("platform.assets");
    expect(payload.metrics?.assetsTotal).toBe(4);
    expect(payload.metrics?.integrityFailures).toBe(1);
    expect(payload.health?.status).toBe("DEGRADED");
  });

  it("denies non-admin by default and returns deterministic reason code", async () => {
    sessionState = { email: "viewer@example.com", expiresAt: Date.now() + 60_000 };

    const response = await getHealth();
    const payload = await response.json() as {
      reasonCode?: string;
      authorizationMetrics?: { deniedCount?: number };
    };

    expect(response.status).toBe(403);
    expect(payload.reasonCode).toBe("DENIED_DEFAULT");
    expect(payload.authorizationMetrics?.deniedCount ?? 0).toBeGreaterThan(0);
  });

  it("returns deterministic denial for invalid action checks", async () => {
    sessionState = { email: "viewer@example.com", expiresAt: Date.now() + 60_000 };

    const decision = authorizeAssetObservability({
      session: sessionState,
      action: "assets:invalid:view",
      route: "/api/gop/assets/health",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("DENIED_DEFAULT");
    expect(decision.deniedCount).toBeGreaterThan(0);
  });
});
