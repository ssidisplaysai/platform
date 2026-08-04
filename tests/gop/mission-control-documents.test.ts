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
      const allowedActions = ["documents:health:view", "documents:metrics:view"];
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

jest.mock("@/platform/documents", () => ({
  getGenesisDocumentRuntime: async () => ({
    observability: async () => ({
      capability: "platform.documents",
      metadata: {
        contractVersion: "1.0.0",
        runtimeVersion: "1.0.0",
        persistence: "file.document-state.v1",
        dependencies: ["assets", "organization", "contacts", "workflow", "ai"],
      },
      metrics: {
        documentsTotal: 5,
        draftDocuments: 1,
        reviewDocuments: 1,
        approvedDocuments: 1,
        activeDocuments: 2,
        archivedDocuments: 0,
        retiredDocuments: 0,
        revisionsTotal: 8,
        templatesTotal: 2,
        approvalsTotal: 3,
        signaturesTotal: 2,
        activeSignatures: 1,
        relationshipsTotal: 2,
        assetReferencesTotal: 4,
        generatedOutputsTotal: 1,
        recoveryCount: 1,
        corruptStateCount: 0,
        auditEvents: 12,
      },
      health: {
        status: "HEALTHY",
        generatedAt: new Date().toISOString(),
        checks: [{ name: "registry", status: "PASS", detail: "documents=5" }],
      },
    }),
  }),
}));

import { GET as getHealth } from "@/app/api/gop/documents/health/route";
import { GET as getMetrics } from "@/app/api/gop/documents/metrics/route";
import { authorizeDocumentObservability } from "@/lib/gop/document-observability-authorization";

describe("gop mission control documents endpoints", () => {
  it("returns unauthorized when session is missing", async () => {
    sessionState = null;

    const response = await getHealth();
    expect(response.status).toBe(401);
  });

  it("returns documents health payload", async () => {
    sessionState = { email: "admin@example.com", expiresAt: Date.now() + 60_000 };

    const response = await getHealth();
    const payload = await response.json() as {
      capability?: string;
      metadata?: { contractVersion: string };
      health?: { status: string };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("platform.documents");
    expect(payload.metadata?.contractVersion).toBe("1.0.0");
    expect(payload.health?.status).toBe("HEALTHY");
  });

  it("returns documents metrics payload", async () => {
    sessionState = { email: "admin@example.com", expiresAt: Date.now() + 60_000 };

    const response = await getMetrics();
    const payload = await response.json() as {
      capability?: string;
      metrics?: { documentsTotal: number; revisionsTotal: number };
      health?: { status: string };
    };

    expect(response.status).toBe(200);
    expect(payload.capability).toBe("platform.documents");
    expect(payload.metrics?.documentsTotal).toBe(5);
    expect(payload.metrics?.revisionsTotal).toBe(8);
    expect(payload.health?.status).toBe("HEALTHY");
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

    const decision = authorizeDocumentObservability({
      session: sessionState,
      action: "documents:invalid:view",
      route: "/api/gop/documents/health",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("DENIED_DEFAULT");
    expect(decision.deniedCount).toBeGreaterThan(0);
  });
});
