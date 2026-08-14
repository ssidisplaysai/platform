import { describe, expect, it, jest } from "@jest/globals";
import { classifyRecoveryCandidate, createJobRecoveryService } from "@/lib/runtime/job-recovery";

jest.mock("@/lib/glw/n8n", () => ({
  createGlwN8nExecutionService: jest.fn(() => ({
    getExecutionDiagnostics: async (executionId: string) => {
      if (executionId === "123") {
        return {
          available: true,
          diagnostics: { terminal: true, executionState: "ERROR" },
          upstreamStatus: null,
        };
      }

      if (executionId === "correlation-69861") {
        return {
          available: false,
          diagnostics: null,
          upstreamStatus: 400,
          reason: "Execution ID is not a native n8n execution identifier.",
        };
      }

      return {
        available: false,
        diagnostics: null,
        upstreamStatus: 404,
        reason: "Execution not found.",
      };
    },
  })),
}));

describe("job recovery classifier", () => {
  it("classifies active execution with healthy lease as running", () => {
    const result = classifyRecoveryCandidate({
      execution: {
        executionId: "123",
        executionExists: true,
        executionTerminal: false,
        executionState: "RUNNING",
      },
      signals: {
        leaseExpired: false,
        heartbeatStopped: false,
      },
    });

    expect(result.classification).toBe("RUNNING");
    expect(result.safeToRecover).toBe(false);
    expect(result.recommendedJobStatus).toBe("KEEP_STARTING");
  });

  it("classifies stale active execution as safe stuck recovery", () => {
    const result = classifyRecoveryCandidate({
      execution: {
        executionId: "124",
        executionExists: true,
        executionTerminal: false,
        executionState: "RUNNING",
      },
      signals: {
        leaseExpired: true,
        heartbeatStopped: true,
      },
    });

    expect(result.classification).toBe("STUCK");
    expect(result.safeToRecover).toBe(true);
    expect(result.decision).toBe("SAFE_RECOVERY");
  });

  it("classifies terminal execution with STARTING job as safe stuck recovery", () => {
    const result = classifyRecoveryCandidate({
      execution: {
        executionId: "125",
        executionExists: true,
        executionTerminal: true,
        executionState: "FAILED",
      },
      signals: {
        leaseExpired: false,
        heartbeatStopped: false,
      },
    });

    expect(result.classification).toBe("STUCK");
    expect(result.safeToRecover).toBe(true);
    expect(result.recommendedJobStatus).toBe("FAILED");
  });

  it("classifies missing execution plus stale signals as abandoned and recoverable", () => {
    const result = classifyRecoveryCandidate({
      execution: {
        executionId: "126",
        executionExists: false,
        executionTerminal: null,
        executionState: "MISSING",
      },
      signals: {
        leaseExpired: true,
        heartbeatStopped: true,
      },
    });

    expect(result.classification).toBe("ABANDONED");
    expect(result.safeToRecover).toBe(true);
  });

  it("classifies missing execution with non-stale signals as manual review", () => {
    const result = classifyRecoveryCandidate({
      execution: {
        executionId: "127",
        executionExists: false,
        executionTerminal: null,
        executionState: "MISSING",
      },
      signals: {
        leaseExpired: false,
        heartbeatStopped: false,
      },
    });

    expect(result.classification).toBe("STUCK");
    expect(result.safeToRecover).toBe(false);
    expect(result.decision).toBe("MANUAL_REVIEW");
  });

  it("classifies jobs without external execution id as unknown", () => {
    const result = classifyRecoveryCandidate({
      execution: {
        executionId: null,
        executionExists: null,
        executionTerminal: null,
        executionState: null,
        executionIdentityVerified: null,
      },
      signals: {
        leaseExpired: null,
        heartbeatStopped: null,
      },
    });

    expect(result.classification).toBe("UNKNOWN");
    expect(result.safeToRecover).toBe(false);
  });

  it("treats correlation-only execution ids as unverified external evidence", () => {
    const result = classifyRecoveryCandidate({
      execution: {
        executionId: "correlation-69861",
        executionExists: null,
        executionTerminal: null,
        executionState: "UNKNOWN",
        executionIdentityVerified: false,
        reason: "Execution ID is not a native n8n execution identifier.",
      },
      signals: {
        leaseExpired: true,
        heartbeatStopped: true,
      },
    });

    expect(result.classification).toBe("UNKNOWN");
    expect(result.decision).toBe("MANUAL_REVIEW");
    expect(result.safeToRecover).toBe(false);
    expect(result.recommendedJobStatus).toBe("MANUAL_INVESTIGATION");
  });

  it("requires external identity verification before missing execution can be treated as abandoned", () => {
    const result = classifyRecoveryCandidate({
      execution: {
        executionId: "99999",
        executionExists: false,
        executionTerminal: null,
        executionState: "MISSING",
        executionIdentityVerified: false,
        reason: "n8n API could not validate this execution identifier.",
      },
      signals: {
        leaseExpired: true,
        heartbeatStopped: true,
      },
    });

    expect(result.classification).toBe("UNKNOWN");
    expect(result.decision).toBe("MANUAL_REVIEW");
    expect(result.safeToRecover).toBe(false);
  });

  it("exposes executionIdentityVerified on the public audit row for verified and unverified identities", async () => {
    const service = createJobRecoveryService({
      glwJob: {
        count: async () => 0,
        findFirst: async () => null,
        findMany: async () => [
          {
            id: "job-verified",
            siteId: "site-1",
            status: "STARTING",
            type: "PAGE_GENERATION",
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
            updatedAt: new Date("2024-01-01T00:00:00.000Z"),
            input: { callbackUrl: "https://example.com/page-generation" },
            externalExecutionId: "123",
          },
          {
            id: "job-unverified",
            siteId: "site-1",
            status: "STARTING",
            type: "PAGE_GENERATION",
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
            updatedAt: new Date("2024-01-01T00:00:00.000Z"),
            input: { callbackUrl: "https://example.com/page-generation" },
            externalExecutionId: "correlation-69861",
          },
        ],
      },
      gopExecution: {
        findFirst: async ({ where }: any) => ({
          retryCount: 0,
          leases: [],
          jobId: where?.OR?.[0]?.jobId ?? "job-verified",
        }),
      },
      gopWorker: {
        findUnique: async () => null,
        findMany: async () => [],
      },
      gopExecutionLease: {
        count: async () => 0,
      },
      $queryRaw: async () => [{ regclass: null }],
      $executeRaw: async () => 0,
    } as any);

    const audit = await service.runAudit();
    expect(audit.rows).toHaveLength(2);

    const verifiedRow = audit.rows.find((row) => row.jobId === "job-verified");
    const unverifiedRow = audit.rows.find((row) => row.jobId === "job-unverified");

    expect(verifiedRow?.executionIdentityVerified).toBe(true);
    expect(unverifiedRow?.executionIdentityVerified).toBe(false);
    expect(verifiedRow?.executionExists).toBe(true);
    expect(unverifiedRow?.executionExists).toBeNull();
  });
});
