import type { MissionControlApplication, MissionControlNavigation } from "./types";

export type NavigationService = {
  buildNavigation: (applications: MissionControlApplication[]) => MissionControlNavigation;
};

export function createNavigationService(): NavigationService {
  return {
    buildNavigation(applications) {
      const appNames = applications.map((entry) => entry.displayName).sort((left, right) => left.localeCompare(right));
      const companies = [...new Set(applications.map((entry) => entry.company))].sort((left, right) => left.localeCompare(right));
      const categories = [...new Set(applications.map((entry) => entry.category))].sort((left, right) => left.localeCompare(right));

      return {
        applications: appNames,
        companies,
        categories,
        favorites: [],
        pinnedApplications: [],
        recentlyUsed: [],
      };
    },
  };
}
