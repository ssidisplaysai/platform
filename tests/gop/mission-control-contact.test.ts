import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/glw/auth", () => ({
  getGlwSession: async () => ({ email: "admin@example.com", expiresAt: Date.now() + 60_000 }),
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

describe("gop mission control contact endpoints", () => {
  it("returns contact health payload", async () => {
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

  it("returns contact metrics payload", async () => {
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
});
