import { describe, expect, it } from "@jest/globals";
import {
  createEnterpriseAggregationEngine,
  createEnterpriseCapabilityEngine,
  createEnterpriseHealthEvaluationEngine,
  createEnterpriseHealthService,
  createInMemoryEnterpriseHealthRepository,
} from "@/platform/ehc";
import { createMockEarService } from "./fixtures";

describe("EHC service", () => {
  it("evaluates and retrieves application health", async () => {
    const service = createEnterpriseHealthService({
      earService: createMockEarService(["glw"]),
      repository: createInMemoryEnterpriseHealthRepository(),
      evaluationEngine: createEnterpriseHealthEvaluationEngine(),
      capabilityEngine: createEnterpriseCapabilityEngine(),
      aggregationEngine: createEnterpriseAggregationEngine(),
    });

    const record = await service.evaluateHealth({
      applicationId: "glw",
      readiness: "READY",
      liveness: "LIVE",
      availableCapabilities: ["capability-a"],
      source: "SIMULATED",
    });

    expect(record?.applicationId).toBe("glw");

    const found = await service.retrieveHealth("glw");
    expect(found?.status.state).toBeDefined();
  });
});
