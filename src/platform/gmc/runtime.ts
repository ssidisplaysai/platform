import { getEnterpriseRegistryService } from "@/platform/ear";
import { getEnterpriseHealthService } from "@/platform/ehc";
import { createApplicationDiscoveryService } from "./application-discovery-service";
import { createApplicationLauncher } from "./application-launcher";
import { createCapabilitySummaryService } from "./capability-summary-service";
import { createHealthSummaryService } from "./health-summary-service";
import { createLaunchPolicyResolver } from "./launch-policy-resolver";
import { createMissionControlService, type MissionControlService } from "./mission-control-service";
import { createNavigationService } from "./navigation-service";
import { createWorkspaceAssembler } from "./workspace-assembler";

let singleton: MissionControlService | null = null;

export async function getMissionControlService(): Promise<MissionControlService> {
  if (!singleton) {
    const launcher = createApplicationLauncher({
      launchPolicyResolver: createLaunchPolicyResolver(),
    });

    const discoveryService = createApplicationDiscoveryService({
      registryService: getEnterpriseRegistryService(),
      launcher,
    });

    const healthSummaryService = createHealthSummaryService({
      healthService: await getEnterpriseHealthService(),
    });

    singleton = createMissionControlService({
      discoveryService,
      healthSummaryService,
      capabilitySummaryService: createCapabilitySummaryService(),
      navigationService: createNavigationService(),
      workspaceAssembler: createWorkspaceAssembler(),
    });
  }

  return singleton;
}

export function resetMissionControlServiceForTests(): void {
  singleton = null;
}
