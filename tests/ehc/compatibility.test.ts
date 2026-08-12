import { describe, expect, it } from "@jest/globals";
import { createEnterpriseHealthEvaluationEngine } from "@/platform/ehc";

describe("EHC compatibility engine", () => {
  it("detects unsupported required versions", () => {
    const engine = createEnterpriseHealthEvaluationEngine();
    const result = engine.evaluateCompatibility({
      registryContractVersion: "1.0.0",
      healthContractVersion: "1.0.0",
      supportedHealthContractVersions: ["1.0.0"],
      supportedCapabilityContractVersions: ["1.0.0"],
      requiredHealthContractVersion: "2.0.0",
    });

    expect(result.compatible).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
