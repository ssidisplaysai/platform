import type { EnterpriseDashboardModel, MissionControlApplication, MissionControlNavigation, MissionControlWorkspace } from "./types";

export type WorkspaceAssembler = {
  assemble: (input: {
    applications: MissionControlApplication[];
    navigation: MissionControlNavigation;
    healthOverview: {
      enterpriseState: string;
      enterpriseReadiness: string;
      enterpriseAvailability: string;
    };
    capabilityOverview: {
      capabilityCount: number;
      capabilities: string[];
      totalDeclared: number;
      totalAvailable: number;
      totalUnavailable: number;
    };
  }) => MissionControlWorkspace;
};

function buildDashboard(applications: MissionControlApplication[], capabilityOverview: {
  totalDeclared: number;
  totalAvailable: number;
  totalUnavailable: number;
}): EnterpriseDashboardModel {
  return {
    generatedAt: new Date().toISOString(),
    totals: {
      applications: applications.length,
      healthy: applications.filter((entry) => entry.health.state === "HEALTHY").length,
      warning: applications.filter((entry) => entry.health.state === "WARNING").length,
      degraded: applications.filter((entry) => entry.health.state === "DEGRADED").length,
      unavailable: applications.filter((entry) => entry.health.state === "UNAVAILABLE").length,
      unknown: applications.filter((entry) => entry.health.state === "UNKNOWN").length,
    },
    readiness: {
      ready: applications.filter((entry) => entry.health.readiness === "READY").length,
      notReady: applications.filter((entry) => entry.health.readiness === "NOT_READY").length,
      unknown: applications.filter((entry) => entry.health.readiness === "UNKNOWN").length,
    },
    compatibility: {
      compatible: applications.filter((entry) => entry.compatibility.compatible).length,
      incompatible: applications.filter((entry) => !entry.compatibility.compatible).length,
    },
    capabilities: {
      totalDeclared: capabilityOverview.totalDeclared,
      totalAvailable: capabilityOverview.totalAvailable,
      totalUnavailable: capabilityOverview.totalUnavailable,
    },
  };
}

export function createWorkspaceAssembler(): WorkspaceAssembler {
  return {
    assemble(input) {
      const dashboard = buildDashboard(input.applications, input.capabilityOverview);

      return {
        home: {
          title: "Genesis Mission Control",
          subtitle: "Dynamic enterprise orchestration workspace assembled from certified platform services.",
        },
        applicationCatalog: input.applications,
        companyViews: input.navigation.companies,
        categoryViews: input.navigation.categories,
        healthOverview: input.healthOverview,
        capabilityOverview: {
          capabilityCount: input.capabilityOverview.capabilityCount,
          capabilities: input.capabilityOverview.capabilities,
        },
        navigation: input.navigation,
        dashboard,
      };
    },
  };
}
