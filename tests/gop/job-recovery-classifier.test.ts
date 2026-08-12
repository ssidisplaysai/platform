import { describe, expect, it } from "@jest/globals";
import { classifyRecoveryCandidate } from "@/lib/runtime/job-recovery";

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
      },
      signals: {
        leaseExpired: null,
        heartbeatStopped: null,
      },
    });

    expect(result.classification).toBe("UNKNOWN");
    expect(result.safeToRecover).toBe(false);
  });
});
