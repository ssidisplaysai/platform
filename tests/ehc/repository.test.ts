import { describe, expect, it } from "@jest/globals";
import { createInMemoryEnterpriseHealthRepository } from "@/platform/ehc";

const sampleRecord = {
  applicationId: "glw",
  observedAt: new Date().toISOString(),
  status: { state: "HEALTHY" as const, readiness: "READY" as const, liveness: "LIVE" as const },
  capabilities: {
    declaredCapabilities: ["capability-a"],
    availableCapabilities: ["capability-a"],
    unavailableCapabilities: [],
    statuses: [{ capability: "capability-a", availability: "AVAILABLE" as const }],
  },
  compatibility: {
    compatible: true,
    registryContractVersion: "1.0.0",
    issues: [],
  },
  reference: { healthEndpoint: "/api/glw/health", contractVersion: "1.0.0" },
  source: "SIMULATED" as const,
};

describe("EHC repository", () => {
  it("supports create, update, retrieve, history, snapshot, and aggregation", async () => {
    const repository = createInMemoryEnterpriseHealthRepository();

    await repository.createRecord(sampleRecord);
    const current = await repository.retrieveCurrent("glw");
    expect(current?.status.state).toBe("HEALTHY");

    await repository.updateCurrent({ ...sampleRecord, status: { ...sampleRecord.status, state: "WARNING" } });
    const history = await repository.retrieveHistory("glw", 10);
    expect(history.length).toBeGreaterThanOrEqual(2);

    await repository.saveSnapshot({ applicationId: "glw", capturedAt: new Date().toISOString(), record: sampleRecord });
    const snapshot = await repository.retrieveLatestSnapshot("glw");
    expect(snapshot?.applicationId).toBe("glw");

    await repository.saveAggregation({
      aggregatedAt: new Date().toISOString(),
      enterpriseState: "WARNING",
      enterpriseReadiness: "READY",
      enterpriseAvailability: "LIVE",
      applications: { total: 1, healthy: 0, warning: 1, degraded: 0, unavailable: 0, unknown: 0 },
      compatibility: { compatible: 1, incompatible: 0 },
      perApplication: [{ applicationId: "glw", state: "WARNING", readiness: "READY", liveness: "LIVE" }],
      perCapability: [{ capability: "capability-a", healthy: 0, warning: 1, degraded: 0, unavailable: 0, unknown: 0 }],
    });

    const aggregation = await repository.retrieveLatestAggregation();
    expect(aggregation?.enterpriseState).toBe("WARNING");
  });
});
