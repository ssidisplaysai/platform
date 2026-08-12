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
import { createMockHealthService, createMockRegistryService } from "./fixtures";

describe("GMC dashboard", () => {
  it("builds dashboard model dynamically", async () => {
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

    const dashboard = await service.getDashboard();
    expect(dashboard.totals.applications).toBeGreaterThan(0);
    expect(dashboard.compatibility.compatible + dashboard.compatibility.incompatible).toBe(dashboard.totals.applications);
  });
});
