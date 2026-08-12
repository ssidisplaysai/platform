import type {
  ApplicationSearchQuery,
  LaunchDecision,
  MissionControlApplication,
  MissionControlFilters,
  MissionControlNavigation,
  MissionControlWorkspace,
} from "./types";
import type { ApplicationDiscoveryService } from "./application-discovery-service";
import type { CapabilitySummaryService } from "./capability-summary-service";
import type { HealthSummaryService } from "./health-summary-service";
import type { NavigationService } from "./navigation-service";
import type { WorkspaceAssembler } from "./workspace-assembler";

export type MissionControlService = {
  assembleWorkspace: () => Promise<MissionControlWorkspace>;
  listApplications: (query?: ApplicationSearchQuery) => Promise<MissionControlApplication[]>;
  getNavigation: () => Promise<MissionControlNavigation>;
  getDashboard: () => Promise<MissionControlWorkspace["dashboard"]>;
  getLaunchMetadata: (applicationId: string) => Promise<MissionControlApplication["launch"] | null>;
  searchApplications: (query: string) => Promise<MissionControlApplication[]>;
  getHealthSummary: () => Promise<MissionControlWorkspace["healthOverview"]>;
  getFilters: () => Promise<MissionControlFilters>;
};

function resolveLaunchDecision(application: MissionControlApplication): LaunchDecision {
  if (application.registrationStatus !== "ACTIVE") {
    return {
      status: "BLOCKED_INACTIVE",
      launchAllowed: false,
      launchBlockReason: "BLOCKED_INACTIVE",
    };
  }

  if (application.health.state === "UNAVAILABLE" || application.health.availability === "NOT_LIVE") {
    return {
      status: "BLOCKED_UNAVAILABLE",
      launchAllowed: false,
      launchBlockReason: "BLOCKED_UNAVAILABLE",
    };
  }

  if (!application.compatibility.compatible) {
    return {
      status: "BLOCKED_INCOMPATIBLE",
      launchAllowed: false,
      launchBlockReason: "BLOCKED_INCOMPATIBLE",
    };
  }

  if (!application.launch.launchAllowed) {
    const reason = application.launch.launchBlockReason ?? "BLOCKED_MISSING_METADATA";
    return {
      status: reason,
      launchAllowed: false,
      launchBlockReason: reason,
    };
  }

  if (!application.launch.resolvedLaunchType || !application.launch.safeLaunchTarget) {
    return {
      status: "BLOCKED_MISSING_METADATA",
      launchAllowed: false,
      launchBlockReason: "BLOCKED_MISSING_METADATA",
    };
  }

  return {
    status: "ALLOWED",
    launchAllowed: true,
    resolvedLaunchType: application.launch.resolvedLaunchType,
    safeLaunchTarget: application.launch.safeLaunchTarget,
  };
}

function matchesQuery(application: MissionControlApplication, query: ApplicationSearchQuery): boolean {
  const search = query.q?.trim().toLowerCase();
  if (search) {
    const haystack = [
      application.displayName,
      application.company,
      application.category,
      application.description,
      ...application.capabilities,
    ].join(" ").toLowerCase();

    if (!haystack.includes(search)) {
      return false;
    }
  }

  if (query.company && application.company !== query.company) {
    return false;
  }

  if (query.category && application.category !== query.category) {
    return false;
  }

  if (query.health && application.health.state !== query.health) {
    return false;
  }

  if (query.availability && application.health.availability !== query.availability) {
    return false;
  }

  if (query.compatibility) {
    const expected = query.compatibility === "compatible";
    if (application.compatibility.compatible !== expected) {
      return false;
    }
  }

  if (query.capability && !application.capabilities.includes(query.capability)) {
    return false;
  }

  if (query.status && application.registrationStatus !== query.status) {
    return false;
  }

  return true;
}

export function createMissionControlService(input: {
  discoveryService: ApplicationDiscoveryService;
  healthSummaryService: HealthSummaryService;
  capabilitySummaryService: CapabilitySummaryService;
  navigationService: NavigationService;
  workspaceAssembler: WorkspaceAssembler;
}): MissionControlService {
  const {
    discoveryService,
    healthSummaryService,
    capabilitySummaryService,
    navigationService,
    workspaceAssembler,
  } = input;

  async function collectApplications(): Promise<MissionControlApplication[]> {
    const discovered = await discoveryService.discoverApplications();
    const enriched = await healthSummaryService.enrichHealth(discovered);

    return enriched.map((application) => {
      const launch = resolveLaunchDecision(application);
      return {
        ...application,
        launch,
        launchUrl: launch.safeLaunchTarget ?? "",
      };
    });
  }

  return {
    async assembleWorkspace() {
      const applications = await collectApplications();
      const navigation = navigationService.buildNavigation(applications);
      const healthOverview = await healthSummaryService.enterpriseSummary();
      const capabilityOverview = capabilitySummaryService.summarizeCapabilities(applications);

      return workspaceAssembler.assemble({
        applications,
        navigation,
        healthOverview,
        capabilityOverview,
      });
    },

    async listApplications(query = {}) {
      const applications = await collectApplications();
      return applications.filter((application) => matchesQuery(application, query));
    },

    async getNavigation() {
      const applications = await collectApplications();
      return navigationService.buildNavigation(applications);
    },

    async getDashboard() {
      const workspace = await this.assembleWorkspace();
      return workspace.dashboard;
    },

    async getLaunchMetadata(applicationId) {
      const applications = await collectApplications();
      const target = applications.find((application) => application.applicationId === applicationId);
      if (!target) {
        return null;
      }

      if (!target.launch.launchAllowed) {
        return {
          status: target.launch.status,
          launchAllowed: false,
          launchBlockReason: target.launch.launchBlockReason,
        };
      }

      return {
        status: "ALLOWED",
        launchAllowed: true,
        resolvedLaunchType: target.launch.resolvedLaunchType,
        safeLaunchTarget: target.launch.safeLaunchTarget,
      };
    },

    async searchApplications(query) {
      return this.listApplications({ q: query });
    },

    async getHealthSummary() {
      const workspace = await this.assembleWorkspace();
      return workspace.healthOverview;
    },

    async getFilters() {
      const applications = await collectApplications();

      return {
        companies: [...new Set(applications.map((entry) => entry.company))].sort((left, right) => left.localeCompare(right)),
        categories: [...new Set(applications.map((entry) => entry.category))].sort((left, right) => left.localeCompare(right)),
        healthStates: [...new Set(applications.map((entry) => entry.health.state))],
        availabilityStates: [...new Set(applications.map((entry) => entry.health.availability))],
        compatibilityStates: ["compatible", "incompatible"],
        capabilities: [...new Set(applications.flatMap((entry) => entry.capabilities))].sort((left, right) => left.localeCompare(right)),
        statuses: [...new Set(applications.map((entry) => entry.registrationStatus))],
      };
    },
  };
}
