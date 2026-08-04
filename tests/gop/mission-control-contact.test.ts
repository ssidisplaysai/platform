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
      const allowedActions = ["contact:health:view", "contact:metrics:view"];
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

jest.mock("@/platform/contact", () => ({
  getGenesisContactRuntime: async () => ({
    observability: async () => ({
      capability: "platform.contact",
      metadata: {
        contractVersion: "1.0.0",
        runtimeVersion: "1.0.0",
        persistence: "file.contact-state.v1",
        severityThreshold: "MEDIUM",
      },
      metrics: {
        registeredContacts: 3,
        activeContacts: 2,
        inactiveContacts: 1,
        archivedContacts: 0,
        mergedContacts: 0,
        blockedContacts: 0,
        verifiedEmailMethods: 2,
        verifiedPhoneMethods: 1,
        activeAffiliations: 2,
        consentGrants: 2,
        consentWithdrawals: 0,
        eligibleContactsByChannel: { EMAIL: 2, PHONE: 1, POSTAL: 1 },
        duplicateCandidates: 0,
        mergeOperations: 0,
        mergeFailures: 0,
        recoveryCount: 1,
        corruptStateCount: 0,
        auditFailureCount: 0,
        oldestUnreviewedDuplicateAgeMinutes: 0,
      },
      health: {
        status: "HEALTHY",
        generatedAt: new Date().toISOString(),
        checks: [{ name: "registry", status: "PASS", detail: "contacts=3" }],
      },
    }),
  }),
}));

import { GET as getHealth } from "@/app/api/gop/contact/health/route";
import { GET as getMetrics } from "@/app/api/gop/contact/metrics/route";
import { authorizeContactObservability } from "@/lib/gop/contact-observability-authorization";

describe("gop mission control contact endpoints", () => {
  it("returns unauthorized when session is missing", async () => {
    sessionState = null;

    const response = await getHealth();
    expect(response.status).toBe(401);
  });

  it("returns contact health payload", async () => {
    sessionState = { email: "admin@example.com", expiresAt: Date.now() + 60_000 };

    const response = await getHealth();
    const payload = await response.json() as {
      capability?: string;
      metadata?: { contractVersion: string };
      health?: { status: string };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("platform.contact");
    expect(payload.metadata?.contractVersion).toBe("1.0.0");
    expect(payload.health?.status).toBe("HEALTHY");
  });

  it("denies session without permission using default-deny authorization", async () => {
    sessionState = { email: "viewer@example.com", expiresAt: Date.now() + 60_000 };

    const response = await getHealth();
    const payload = await response.json() as {
      error?: string;
      reasonCode?: string;
      authorizationMetrics?: { deniedCount?: number };
    };

    expect(response.status).toBe(403);
    expect(payload.reasonCode).toBe("DENIED_DEFAULT");
    expect((payload.authorizationMetrics?.deniedCount ?? 0)).toBeGreaterThan(0);
  });

  it("returns contact metrics payload", async () => {
    sessionState = { email: "admin@example.com", expiresAt: Date.now() + 60_000 };

    const response = await getMetrics();
    const payload = await response.json() as {
      capability?: string;
      metrics?: { registeredContacts: number; verifiedEmailMethods: number };
      health?: { status: string };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("platform.contact");
    expect(payload.metrics?.registeredContacts).toBe(3);
    expect(payload.metrics?.verifiedEmailMethods).toBe(2);
    expect(payload.health?.status).toBe("HEALTHY");
  });

  it("returns deterministic denial details for invalid action authorization checks", async () => {
    sessionState = { email: "viewer@example.com", expiresAt: Date.now() + 60_000 };

    const decision = authorizeContactObservability({
      session: sessionState,
      action: "contact:invalid:view",
      route: "/api/gop/contact/health",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("DENIED_DEFAULT");
    expect(decision.deniedCount).toBeGreaterThan(0);
  });
});
