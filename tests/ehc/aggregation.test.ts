import { describe, expect, it } from "@jest/globals";
import {
  createEnterpriseAggregationEngine,
  createEnterpriseCapabilityEngine,
  createEnterpriseHealthEvaluationEngine,
  createEnterpriseHealthService,
  createInMemoryEnterpriseHealthRepository,
} from "@/platform/ehc";
import { createMockEarService } from "./fixtures";

describe("EHC aggregation", () => {
  it("aggregates enterprise health across applications", async () => {
    const service = createEnterpriseHealthService({
      earService: createMockEarService(["glw", "ssi"]),
      repository: createInMemoryEnterpriseHealthRepository(),
      evaluationEngine: createEnterpriseHealthEvaluationEngine(),
      capabilityEngine: createEnterpriseCapabilityEngine(),
      aggregationEngine: createEnterpriseAggregationEngine(),
    });

    await service.evaluateHealth({ applicationId: "glw", readiness: "READY", liveness: "LIVE", source: "SIMULATED" });
    await service.evaluateHealth({ applicationId: "ssi", readiness: "NOT_READY", liveness: "LIVE", source: "SIMULATED" });

    const aggregation = await service.aggregateHealth();
    expect(aggregation.applications.total).toBe(2);
    expect(["HEALTHY", "WARNING", "DEGRADED", "UNAVAILABLE", "UNKNOWN"]).toContain(aggregation.enterpriseState);
  });
});
