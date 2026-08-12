import { describe, expect, it } from "@jest/globals";
import {
  createApplicationDiscoveryService,
  createApplicationLauncher,
  createCapabilitySummaryService,
  createHealthSummaryService,
  createLaunchPolicyResolver,
  createMissionControlService,
  createNavigationService,
  createWorkspaceAssembler,
} from "@/platform/gmc";
import {
  createHealthServiceFromRecords,
  createMockHealthService,
  createMockRegistryService,
  createRegistryServiceFromApplications,
  makeApplication,
  makeHealth,
} from "./fixtures";

function createSearchSafetyService() {
  const applications = [
    makeApplication("inactive", "Inactive Alpha", "Genesis Enterprise", "operations", { lifecycleState: "INACTIVE" }),
    makeApplication("unavailable", "Unavailable Beta", "Genesis Enterprise", "operations"),
    makeApplication("incompatible", "Incompatible Gamma", "Genesis Enterprise", "operations"),
  ];

  const healthRecords = new Map([
    ["inactive", makeHealth("inactive", "HEALTHY")],
    ["unavailable", makeHealth("unavailable", "UNAVAILABLE")],
    ["incompatible", makeHealth("incompatible", "DEGRADED")],
  ]);

  return createMissionControlService({
    discoveryService: createApplicationDiscoveryService({
      registryService: createRegistryServiceFromApplications(applications),
      launcher: createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() }),
    }),
    healthSummaryService: createHealthSummaryService({
      healthService: createHealthServiceFromRecords(healthRecords, {
        aggregatedAt: new Date().toISOString(),
        enterpriseState: "DEGRADED",
        enterpriseReadiness: "NOT_READY",
        enterpriseAvailability: "NOT_LIVE",
        applications: {
          total: 3,
          healthy: 1,
          warning: 0,
          degraded: 1,
          unavailable: 1,
          unknown: 0,
        },
        compatibility: { compatible: 2, incompatible: 1 },
        perApplication: [...healthRecords.values()].map((record) => ({
          applicationId: record.applicationId,
          state: record.status.state,
          readiness: record.status.readiness,
          liveness: record.status.liveness,
        })),
        perCapability: [
          { capability: "catalog", healthy: 1, warning: 0, degraded: 1, unavailable: 1, unknown: 0 },
          { capability: "operations", healthy: 1, warning: 0, degraded: 1, unavailable: 1, unknown: 0 },
        ],
      }),
    }),
    capabilitySummaryService: createCapabilitySummaryService(),
    navigationService: createNavigationService(),
    workspaceAssembler: createWorkspaceAssembler(),
  });
}

describe("GMC search", () => {
  it("searches by application name, company, capability, category, and description", async () => {
    const service = createMissionControlService({
      discoveryService: createApplicationDiscoveryService({
        registryService: createMockRegistryService(),
        launcher: createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() }),
      }),
      healthSummaryService: createHealthSummaryService({ healthService: createMockHealthService() }),
      capabilitySummaryService: createCapabilitySummaryService(),
      navigationService: createNavigationService(),
      workspaceAssembler: createWorkspaceAssembler(),
    });

    const results = await service.searchApplications("screen");
    expect(results.some((entry) => entry.displayName.includes("Screen"))).toBe(true);
  });

  it("returns blocked search results as non-launchable with explicit block reasons", async () => {
    const service = createSearchSafetyService();

    const inactiveResults = await service.searchApplications("inactive");
    const unavailableResults = await service.searchApplications("unavailable");
    const incompatibleResults = await service.searchApplications("incompatible");

    const inactive = inactiveResults.find((entry) => entry.applicationId === "inactive");
    const unavailable = unavailableResults.find((entry) => entry.applicationId === "unavailable");
    const incompatible = incompatibleResults.find((entry) => entry.applicationId === "incompatible");

    expect(inactive).toBeDefined();
    expect(unavailable).toBeDefined();
    expect(incompatible).toBeDefined();

    expect(inactive?.launch.launchAllowed).toBe(false);
    expect(inactive?.launch.launchBlockReason).toBe("BLOCKED_INACTIVE");
    expect(inactive?.launch.safeLaunchTarget).toBeUndefined();

    expect(unavailable?.launch.launchAllowed).toBe(false);
    expect(unavailable?.launch.launchBlockReason).toBe("BLOCKED_UNAVAILABLE");
    expect(unavailable?.launch.safeLaunchTarget).toBeUndefined();

    expect(incompatible?.launch.launchAllowed).toBe(false);
    expect(incompatible?.launch.launchBlockReason).toBe("BLOCKED_INCOMPATIBLE");
    expect(incompatible?.launch.safeLaunchTarget).toBeUndefined();
  });
});
