import { describe, expect, it } from "@jest/globals";
import { createEnterpriseHealthEvaluationEngine } from "@/platform/ehc";

describe("EHC readiness and liveness", () => {
  it("returns unavailable when liveness is NOT_LIVE", () => {
    const engine = createEnterpriseHealthEvaluationEngine();
    const status = engine.evaluateStatus({
      readiness: "READY",
      liveness: "NOT_LIVE",
      capabilityAvailableCount: 1,
      capabilityDeclaredCount: 1,
      compatibility: { compatible: true, registryContractVersion: "1.0.0", issues: [] },
    });

    expect(status.state).toBe("UNAVAILABLE");
  });

  it("returns warning when readiness is NOT_READY", () => {
    const engine = createEnterpriseHealthEvaluationEngine();
    const status = engine.evaluateStatus({
      readiness: "NOT_READY",
      liveness: "LIVE",
      capabilityAvailableCount: 1,
      capabilityDeclaredCount: 1,
      compatibility: { compatible: true, registryContractVersion: "1.0.0", issues: [] },
    });

    expect(status.state).toBe("WARNING");
  });
});
