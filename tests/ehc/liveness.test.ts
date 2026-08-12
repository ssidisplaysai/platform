import { describe, expect, it } from "@jest/globals";
import { createEnterpriseHealthEvaluationEngine } from "@/platform/ehc";

describe("EHC liveness", () => {
  it("returns UNAVAILABLE when liveness is NOT_LIVE", () => {
    const engine = createEnterpriseHealthEvaluationEngine();
    const status = engine.evaluateStatus({
      readiness: "READY",
      liveness: "NOT_LIVE",
      capabilityAvailableCount: 2,
      capabilityDeclaredCount: 2,
      compatibility: { compatible: true, registryContractVersion: "1.0.0", issues: [] },
    });

    expect(status.liveness).toBe("NOT_LIVE");
    expect(status.state).toBe("UNAVAILABLE");
  });
});
