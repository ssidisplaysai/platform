import { describe, expect, it } from "@jest/globals";
import {
  createApplicationDiscoveryService,
  createApplicationLauncher,
  createCapabilitySummaryService,
  createHealthSummaryService,
  createLaunchPolicyResolver,
  createMissionControlService,
  createNavigationService,
  resetMissionControlServiceForTests,
  createWorkspaceAssembler,
} from "@/platform/gmc";
import { GET as getLaunchMetadataRoute } from "@/app/api/gmc/launch-metadata/[applicationId]/route";
import { createMockHealthService, createMockRegistryService, createRegistryServiceFromApplications, makeApplication, makeHealth, createHealthServiceFromRecords } from "./fixtures";

function createServiceForSafetyScenarios() {
  const applications = [
    makeApplication("allowed", "Allowed", "Genesis Enterprise", "operations"),
    makeApplication("inactive", "Inactive", "Genesis Enterprise", "operations", { lifecycleState: "INACTIVE" }),
    makeApplication("unavailable", "Unavailable", "Genesis Enterprise", "operations"),
    makeApplication("incompatible", "Incompatible", "Genesis Enterprise", "operations"),
    makeApplication("invalid", "Invalid", "Genesis Enterprise", "operations", { launchPath: "//evil.example.com" }),
    makeApplication("missing", "Missing", "Genesis Enterprise", "operations", { launchPath: "   " }),
  ];

  const healthRecords = new Map([
    ["allowed", makeHealth("allowed", "HEALTHY")],
    ["inactive", makeHealth("inactive", "HEALTHY")],
    ["unavailable", makeHealth("unavailable", "UNAVAILABLE")],
    ["incompatible", makeHealth("incompatible", "DEGRADED")],
    ["invalid", makeHealth("invalid", "HEALTHY")],
    ["missing", makeHealth("missing", "HEALTHY")],
  ]);

  return createMissionControlService({
    discoveryService: createApplicationDiscoveryService({
      registryService: createRegistryServiceFromApplications(applications),
      launcher: createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() }),
    }),
    healthSummaryService: createHealthSummaryService({
      healthService: createHealthServiceFromRecords(healthRecords, {
        aggregatedAt: new Date().toISOString(),
        enterpriseState: "WARNING",
        enterpriseReadiness: "NOT_READY",
        enterpriseAvailability: "LIVE",
        applications: {
          total: 6,
          healthy: 4,
          warning: 0,
          degraded: 1,
          unavailable: 1,
          unknown: 0,
        },
        compatibility: { compatible: 5, incompatible: 1 },
        perApplication: [...healthRecords.values()].map((record) => ({
          applicationId: record.applicationId,
          state: record.status.state,
          readiness: record.status.readiness,
          liveness: record.status.liveness,
        })),
        perCapability: [
          { capability: "catalog", healthy: 4, warning: 0, degraded: 1, unavailable: 1, unknown: 0 },
          { capability: "operations", healthy: 4, warning: 0, degraded: 1, unavailable: 1, unknown: 0 },
        ],
      }),
    }),
    capabilitySummaryService: createCapabilitySummaryService(),
    navigationService: createNavigationService(),
    workspaceAssembler: createWorkspaceAssembler(),
  });
}

describe("GMC workspace", () => {
  it("assembles workspace from registry and health services", async () => {
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

    const workspace = await service.assembleWorkspace();
    expect(workspace.applicationCatalog.length).toBeGreaterThan(1);
    expect(workspace.navigation.categories.length).toBeGreaterThan(0);
  });

  it("enforces launch gating statuses and strips targets for blocked apps", async () => {
    const service = createServiceForSafetyScenarios();
    const workspace = await service.assembleWorkspace();

    const byId = new Map(workspace.applicationCatalog.map((application) => [application.applicationId, application]));

    expect(byId.get("allowed")?.launch.status).toBe("ALLOWED");
    expect(byId.get("allowed")?.launch.safeLaunchTarget).toBe("/allowed");

    expect(byId.get("inactive")?.launch.status).toBe("BLOCKED_INACTIVE");
    expect(byId.get("inactive")?.launch.safeLaunchTarget).toBeUndefined();

    expect(byId.get("unavailable")?.launch.status).toBe("BLOCKED_UNAVAILABLE");
    expect(byId.get("unavailable")?.launch.safeLaunchTarget).toBeUndefined();

    expect(byId.get("incompatible")?.launch.status).toBe("BLOCKED_INCOMPATIBLE");
    expect(byId.get("incompatible")?.launch.safeLaunchTarget).toBeUndefined();

    expect(byId.get("invalid")?.launch.status).toBe("BLOCKED_INVALID_TARGET");
    expect(byId.get("invalid")?.launch.safeLaunchTarget).toBeUndefined();

    expect(byId.get("missing")?.launch.status).toBe("BLOCKED_MISSING_METADATA");
    expect(byId.get("missing")?.launch.safeLaunchTarget).toBeUndefined();
  });

  it("returns blocked launch metadata without executable target", async () => {
    const service = createServiceForSafetyScenarios();

    const blocked = await service.getLaunchMetadata("invalid");
    const allowed = await service.getLaunchMetadata("allowed");

    expect(blocked?.launchAllowed).toBe(false);
    expect(blocked?.launchBlockReason).toBe("BLOCKED_INVALID_TARGET");
    expect(blocked?.safeLaunchTarget).toBeUndefined();

    expect(allowed?.launchAllowed).toBe(true);
    expect(allowed?.safeLaunchTarget).toBe("/allowed");
  });

  it("fails safely for unknown application launch metadata requests", async () => {
    const service = createServiceForSafetyScenarios();

    await expect(service.getLaunchMetadata("unknown-app")).resolves.toBeNull();

    resetMissionControlServiceForTests();
    const response = await getLaunchMetadataRoute(
      new Request("http://localhost/api/gmc/launch-metadata/unknown-app"),
      { params: Promise.resolve({ applicationId: "unknown-app" }) },
    );

    expect(response.status).toBe(404);

    const payload = await response.json() as { error?: string; launchMetadata?: unknown };
    expect(payload.error).toBe("Application not found.");
    expect(payload.launchMetadata).toBeUndefined();
  });
});
