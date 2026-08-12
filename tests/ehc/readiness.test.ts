import { describe, expect, it } from "@jest/globals";
import { createEnterpriseHealthEvaluationEngine } from "@/platform/ehc";

describe("EHC readiness", () => {
  it("returns WARNING when readiness is NOT_READY and liveness is LIVE", () => {
    const engine = createEnterpriseHealthEvaluationEngine();
    const status = engine.evaluateStatus({
      readiness: "NOT_READY",
      liveness: "LIVE",
      capabilityAvailableCount: 2,
      capabilityDeclaredCount: 2,
      compatibility: { compatible: true, registryContractVersion: "1.0.0", issues: [] },
    });

    expect(status.readiness).toBe("NOT_READY");
    expect(status.state).toBe("WARNING");
  });
});
