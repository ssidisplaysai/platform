import type { EnterpriseHealthService } from "@/platform/ehc";
import type { MissionControlApplication } from "./types";

export type HealthSummaryService = {
  enrichHealth: (applications: MissionControlApplication[]) => Promise<MissionControlApplication[]>;
  enterpriseSummary: () => Promise<{
    enterpriseState: string;
    enterpriseReadiness: string;
    enterpriseAvailability: string;
  }>;
};

export function createHealthSummaryService(input: {
  healthService: EnterpriseHealthService;
}): HealthSummaryService {
  const { healthService } = input;

  return {
    async enrichHealth(applications) {
      const enriched: MissionControlApplication[] = [];

      for (const application of applications) {
        const current = await healthService.retrieveHealth(application.applicationId);

        if (!current) {
          enriched.push(application);
          continue;
        }

        enriched.push({
          ...application,
          health: {
            state: current.status.state,
            readiness: current.status.readiness,
            liveness: current.status.liveness,
            availability: current.status.liveness,
          },
          compatibility: {
            ...application.compatibility,
            compatible: current.compatibility.compatible,
            issues: [...current.compatibility.issues],
          },
          capabilities: [...current.capabilities.declaredCapabilities],
        });
      }

      return enriched;
    },

    async enterpriseSummary() {
      const summary = await healthService.generateEnterpriseHealthSummary();
      return {
        enterpriseState: summary.enterpriseState,
        enterpriseReadiness: summary.enterpriseReadiness,
        enterpriseAvailability: summary.enterpriseAvailability,
      };
    },
  };
}
