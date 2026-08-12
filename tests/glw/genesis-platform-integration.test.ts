import { beforeEach, describe, expect, it } from "@jest/globals";
import { getEnterpriseRegistryService, resetEnterpriseRegistryServiceForTests } from "@/platform/ear";
import { getEnterpriseHealthService, resetEnterpriseHealthServiceForTests } from "@/platform/ehc";
import {
  createApplicationDiscoveryService,
  createApplicationLauncher,
  createCapabilitySummaryService,
  createHealthSummaryService,
  createLaunchPolicyResolver,
  createMissionControlService,
  createNavigationService,
  createWorkspaceAssembler,
  getMissionControlService,
  resetMissionControlServiceForTests,
} from "@/platform/gmc";
import { GET as getGlwHealth } from "@/app/api/glw/health/route";
import { GET as getGlwCapabilities } from "@/app/api/glw/capabilities/route";
import { GET as getGmcWorkspace } from "@/app/api/gmc/workspace/route";
import { GET as getGmcSearch } from "@/app/api/gmc/search/route";
import { GET as getGmcDashboard } from "@/app/api/gmc/dashboard/route";
import { GET as getGmcLaunchMetadata } from "@/app/api/gmc/launch-metadata/[applicationId]/route";
import {
  createHealthServiceFromRecords,
  createRegistryServiceFromApplications,
  makeApplication,
  makeHealth,
} from "../gmc/fixtures";

beforeEach(() => {
  resetMissionControlServiceForTests();
  resetEnterpriseHealthServiceForTests();
  resetEnterpriseRegistryServiceForTests();
});

describe("GLW-1001 registration", () => {
  it("registers GLW through EAR as the canonical application metadata source", async () => {
    const registry = getEnterpriseRegistryService();
    const glw = await registry.retrieveApplication("glw");

    expect(glw).not.toBeNull();
    expect(glw?.registration.identity.displayName).toBe("Green LED Warehouse");
    expect(glw?.registration.status.lifecycleState).toBe("ACTIVE");
    expect(glw?.registration.metadata.discovery.launchPath).toBe("/glw");
    expect(glw?.registration.capabilities.declared).toEqual(
      expect.arrayContaining(["catalog", "order-management", "page-generation"]),
    );

    const all = await registry.enumerateApplications();
    const glwRecords = all.filter((entry) => entry.registration.identity.applicationId === "glw");
    expect(glwRecords).toHaveLength(1);
  });
});

describe("GLW-1001 health participation", () => {
  it("exposes GLW health through EHC without GLW-owned enterprise health logic", async () => {
    const health = await getEnterpriseHealthService();
    const glwRecord = await health.retrieveHealth("glw");

    expect(glwRecord).not.toBeNull();
    expect(glwRecord?.applicationId).toBe("glw");
    expect(glwRecord?.reference.healthEndpoint).toBe("/api/glw/health");

    const glwHealthResponse = await getGlwHealth();
    expect(glwHealthResponse.status).toBe(200);

    const glwCapabilitiesResponse = await getGlwCapabilities();
    expect(glwCapabilitiesResponse.status).toBe(200);
  });
});

describe("GLW-1001 Mission Control discovery", () => {
  it("discovers GLW dynamically in workspace, search, navigation, and dashboard", async () => {
    const service = await getMissionControlService();
    const workspace = await service.assembleWorkspace();

    const glw = workspace.applicationCatalog.find((entry) => entry.applicationId === "glw");
    expect(glw).toBeDefined();
    expect(glw?.displayName).toBe("Green LED Warehouse");

    const search = await service.searchApplications("green led");
    expect(search.some((entry) => entry.applicationId === "glw")).toBe(true);

    expect(workspace.navigation.applications).toContain("Green LED Warehouse");
    expect(workspace.dashboard.totals.applications).toBeGreaterThan(0);

    const workspaceResponse = await getGmcWorkspace();
    expect(workspaceResponse.status).toBe(200);

    const searchResponse = await getGmcSearch(new Request("http://localhost/api/gmc/search?q=green%20led"));
    expect(searchResponse.status).toBe(200);

    const dashboardResponse = await getGmcDashboard();
    expect(dashboardResponse.status).toBe(200);
  });
});

describe("GLW-1001 launch integration", () => {
  function buildScenarioService(input: {
    lifecycleState: "ACTIVE" | "INACTIVE";
    healthState: "HEALTHY" | "UNAVAILABLE" | "DEGRADED";
    launchPath: string;
  }) {
    const apps = [
      makeApplication("glw", "Green LED Warehouse", "Green LED Warehouse", "warehouse", {
        lifecycleState: input.lifecycleState,
        launchPath: input.launchPath,
      }),
    ];

    const records = new Map([["glw", makeHealth("glw", input.healthState)]]);

    return createMissionControlService({
      discoveryService: createApplicationDiscoveryService({
        registryService: createRegistryServiceFromApplications(apps),
        launcher: createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() }),
      }),
      healthSummaryService: createHealthSummaryService({
        healthService: createHealthServiceFromRecords(records, {
          aggregatedAt: new Date().toISOString(),
          enterpriseState: input.healthState,
          enterpriseReadiness: input.healthState === "HEALTHY" ? "READY" : "NOT_READY",
          enterpriseAvailability: input.healthState === "UNAVAILABLE" ? "NOT_LIVE" : "LIVE",
          applications: {
            total: 1,
            healthy: input.healthState === "HEALTHY" ? 1 : 0,
            warning: 0,
            degraded: input.healthState === "DEGRADED" ? 1 : 0,
            unavailable: input.healthState === "UNAVAILABLE" ? 1 : 0,
            unknown: 0,
          },
          compatibility: {
            compatible: input.healthState === "DEGRADED" ? 0 : 1,
            incompatible: input.healthState === "DEGRADED" ? 1 : 0,
          },
          perApplication: [...records.values()].map((record) => ({
            applicationId: record.applicationId,
            state: record.status.state,
            readiness: record.status.readiness,
            liveness: record.status.liveness,
          })),
          perCapability: [
            { capability: "catalog", healthy: 1, warning: 0, degraded: 0, unavailable: 0, unknown: 0 },
          ],
        }),
      }),
      capabilitySummaryService: createCapabilitySummaryService(),
      navigationService: createNavigationService(),
      workspaceAssembler: createWorkspaceAssembler(),
    });
  }

  it("allows GLW internal launch through certified launch metadata", async () => {
    const service = await getMissionControlService();
    const launch = await service.getLaunchMetadata("glw");

    expect(launch?.launchAllowed).toBe(true);
    expect(launch?.status).toBe("ALLOWED");
    expect(launch?.safeLaunchTarget).toBe("/glw");

    const route = await getGmcLaunchMetadata(
      new Request("http://localhost/api/gmc/launch-metadata/glw"),
      { params: Promise.resolve({ applicationId: "glw" }) },
    );

    expect(route.status).toBe(200);
  });

  it("blocks inactive, unavailable, incompatible, and missing-metadata launch scenarios", async () => {
    const inactive = await buildScenarioService({ lifecycleState: "INACTIVE", healthState: "HEALTHY", launchPath: "/glw" }).getLaunchMetadata("glw");
    const unavailable = await buildScenarioService({ lifecycleState: "ACTIVE", healthState: "UNAVAILABLE", launchPath: "/glw" }).getLaunchMetadata("glw");
    const incompatible = await buildScenarioService({ lifecycleState: "ACTIVE", healthState: "DEGRADED", launchPath: "/glw" }).getLaunchMetadata("glw");
    const missing = await buildScenarioService({ lifecycleState: "ACTIVE", healthState: "HEALTHY", launchPath: "   " }).getLaunchMetadata("glw");

    expect(inactive?.status).toBe("BLOCKED_INACTIVE");
    expect(unavailable?.status).toBe("BLOCKED_UNAVAILABLE");
    expect(incompatible?.status).toBe("BLOCKED_INCOMPATIBLE");
    expect(missing?.status).toBe("BLOCKED_MISSING_METADATA");

    expect(inactive?.safeLaunchTarget).toBeUndefined();
    expect(unavailable?.safeLaunchTarget).toBeUndefined();
    expect(incompatible?.safeLaunchTarget).toBeUndefined();
    expect(missing?.safeLaunchTarget).toBeUndefined();
  });
});

describe("GLW-1001 capability declaration", () => {
  it("reads GLW declared capabilities from EAR and does not rely on Mission Control capability ownership", async () => {
    const registry = getEnterpriseRegistryService();
    const capabilities = await registry.lookupCapabilities("glw");

    expect(capabilities).not.toBeNull();
    expect(capabilities?.declared).toEqual(
      expect.arrayContaining(["catalog", "order-management", "page-generation"]),
    );
  });
});

describe("GLW-1001 platform boundary verification", () => {
  it("keeps platform authority in EAR/EHC/GMC while GLW remains an application consumer", async () => {
    const registry = getEnterpriseRegistryService();
    const health = await getEnterpriseHealthService();
    const missionControl = await getMissionControlService();

    const fromRegistry = await registry.retrieveApplication("glw");
    const fromHealth = await health.retrieveHealth("glw");
    const fromMissionControl = (await missionControl.assembleWorkspace()).applicationCatalog
      .find((entry) => entry.applicationId === "glw");

    expect(fromRegistry?.registration.identity.applicationId).toBe("glw");
    expect(fromHealth?.applicationId).toBe("glw");
    expect(fromMissionControl?.applicationId).toBe("glw");
    expect(fromMissionControl?.capabilities).toEqual(expect.arrayContaining(fromRegistry?.registration.capabilities.declared ?? []));
  });
});

describe("GLW-1001 integration regression", () => {
  it("retains GLW business API surface while enabling Genesis platform integration routes", async () => {
    const healthResponse = await getGlwHealth();
    const capabilityResponse = await getGlwCapabilities();

    expect(healthResponse.status).toBe(200);
    expect(capabilityResponse.status).toBe(200);

    const healthPayload = await healthResponse.json() as { record: { applicationId: string } };
    expect(healthPayload.record.applicationId).toBe("glw");
  });
});
