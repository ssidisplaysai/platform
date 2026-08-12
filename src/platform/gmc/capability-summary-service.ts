import type { MissionControlApplication } from "./types";

export type CapabilitySummaryService = {
  summarizeCapabilities: (applications: MissionControlApplication[]) => {
    capabilityCount: number;
    capabilities: string[];
    totalDeclared: number;
    totalAvailable: number;
    totalUnavailable: number;
  };
};

export function createCapabilitySummaryService(): CapabilitySummaryService {
  return {
    summarizeCapabilities(applications) {
      const capabilities = new Set<string>();
      let totalDeclared = 0;
      let totalAvailable = 0;
      let totalUnavailable = 0;

      for (const app of applications) {
        totalDeclared += app.capabilities.length;
        for (const capability of app.capabilities) {
          capabilities.add(capability);
        }

        if (app.health.availability === "AVAILABLE") {
          totalAvailable += app.capabilities.length;
        } else {
          totalUnavailable += app.capabilities.length;
        }
      }

      return {
        capabilityCount: capabilities.size,
        capabilities: [...capabilities].sort((left, right) => left.localeCompare(right)),
        totalDeclared,
        totalAvailable,
        totalUnavailable,
      };
    },
  };
}
