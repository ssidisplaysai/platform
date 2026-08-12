import type { EnterpriseRegistryService } from "@/platform/ear";
import type { ApplicationLauncher } from "./application-launcher";
import type { MissionControlApplication } from "./types";

export type ApplicationDiscoveryService = {
  discoverApplications: () => Promise<MissionControlApplication[]>;
};

function titleFromTag(tag: string | undefined): string {
  if (!tag) {
    return "General";
  }

  return tag
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

export function createApplicationDiscoveryService(input: {
  registryService: EnterpriseRegistryService;
  launcher: ApplicationLauncher;
}): ApplicationDiscoveryService {
  const { registryService, launcher } = input;

  return {
    async discoverApplications() {
      const applications = await registryService.enumerateApplications();

      return applications.map((entry) => {
        const registration = entry.registration;
        const launchResolution = launcher.resolveLaunch(registration);
        const category = titleFromTag(registration.metadata.tags[0]);

        return {
          applicationId: registration.identity.applicationId,
          displayName: registration.identity.displayName,
          description: registration.metadata.description,
          company: registration.ownership.ownerOrganization,
          category,
          launchUrl: launchResolution.valid ? launchResolution.safeTarget : "",
          icon: registration.metadata.discovery.iconKey ?? "app-default",
          registrationStatus: registration.status.lifecycleState,
          version: registration.version.version,
          ownership: {
            organization: registration.ownership.ownerOrganization,
            team: registration.ownership.ownerTeam,
            technicalContact: registration.ownership.technicalContact,
          },
          capabilities: [...registration.capabilities.declared],
          compatibility: {
            registryContractVersion: registration.compatibility.registryContractVersion,
            healthContractVersions: [...registration.compatibility.supportedHealthContractVersions],
            capabilityContractVersions: [...registration.compatibility.supportedCapabilityContractVersions],
            compatible: true,
            issues: [],
          },
          health: {
            state: "UNKNOWN",
            readiness: "UNKNOWN",
            liveness: "UNKNOWN",
            availability: "UNKNOWN",
          },
          launch: launchResolution.valid
            ? {
                status: "ALLOWED",
                launchAllowed: true,
                resolvedLaunchType: launchResolution.target,
                safeLaunchTarget: launchResolution.safeTarget,
              }
            : {
                status: launchResolution.reason,
                launchAllowed: false,
                launchBlockReason: launchResolution.reason,
              },
        };
      });
    },
  };
}
