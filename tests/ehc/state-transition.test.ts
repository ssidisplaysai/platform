import { describe, expect, it } from "@jest/globals";
import {
  createEnterpriseAggregationEngine,
  createEnterpriseCapabilityEngine,
  createEnterpriseHealthEvaluationEngine,
  createEnterpriseHealthService,
  createInMemoryEnterpriseHealthRepository,
} from "@/platform/ehc";
import { createMockEarService } from "./fixtures";

describe("EHC health state transitions", () => {
  it("records transition events when health state changes", async () => {
    const repository = createInMemoryEnterpriseHealthRepository();
    const service = createEnterpriseHealthService({
      earService: createMockEarService(["glw"]),
      repository,
      evaluationEngine: createEnterpriseHealthEvaluationEngine(),
      capabilityEngine: createEnterpriseCapabilityEngine(),
      aggregationEngine: createEnterpriseAggregationEngine(),
    });

    await service.evaluateHealth({ applicationId: "glw", readiness: "READY", liveness: "LIVE" });
    await service.evaluateHealth({ applicationId: "glw", readiness: "READY", liveness: "NOT_LIVE" });

    const events = await repository.retrieveEvents("glw", 50);
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1]?.toState).toBe("UNAVAILABLE");
  });
});
