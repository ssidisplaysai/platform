export type LaunchTarget = "INTERNAL" | "EXTERNAL" | "FUTURE_DESKTOP" | "FUTURE_MOBILE" | "FUTURE_DEEP_LINK";

export type LaunchBlockReason =
  | "BLOCKED_INACTIVE"
  | "BLOCKED_UNAVAILABLE"
  | "BLOCKED_INCOMPATIBLE"
  | "BLOCKED_MISSING_METADATA"
  | "BLOCKED_INVALID_TARGET";

export type LaunchEligibilityStatus = "ALLOWED" | LaunchBlockReason;

export type LaunchDecision = {
  status: LaunchEligibilityStatus;
  launchAllowed: boolean;
  launchBlockReason?: LaunchBlockReason;
  resolvedLaunchType?: LaunchTarget;
  safeLaunchTarget?: string;
};

export type MissionControlApplication = {
  applicationId: string;
  displayName: string;
  description: string;
  company: string;
  category: string;
  launchUrl: string;
  icon: string;
  registrationStatus: string;
  version: string;
  ownership: {
    organization: string;
    team: string;
    technicalContact: string;
  };
  capabilities: string[];
  compatibility: {
    registryContractVersion: string;
    healthContractVersions: string[];
    capabilityContractVersions: string[];
    compatible: boolean;
    issues: string[];
  };
  health: {
    state: string;
    readiness: string;
    liveness: string;
    availability: string;
  };
  launch: LaunchDecision;
};

export type MissionControlNavigation = {
  applications: string[];
  companies: string[];
  categories: string[];
  favorites: string[];
  pinnedApplications: string[];
  recentlyUsed: string[];
};

export type EnterpriseDashboardModel = {
  generatedAt: string;
  totals: {
    applications: number;
    healthy: number;
    warning: number;
    degraded: number;
    unavailable: number;
    unknown: number;
  };
  readiness: {
    ready: number;
    notReady: number;
    unknown: number;
  };
  compatibility: {
    compatible: number;
    incompatible: number;
  };
  capabilities: {
    totalDeclared: number;
    totalAvailable: number;
    totalUnavailable: number;
  };
};

export type MissionControlWorkspace = {
  home: {
    title: string;
    subtitle: string;
  };
  applicationCatalog: MissionControlApplication[];
  companyViews: string[];
  categoryViews: string[];
  healthOverview: {
    enterpriseState: string;
    enterpriseReadiness: string;
    enterpriseAvailability: string;
  };
  capabilityOverview: {
    capabilityCount: number;
    capabilities: string[];
  };
  navigation: MissionControlNavigation;
  dashboard: EnterpriseDashboardModel;
};

export type ApplicationSearchQuery = {
  q?: string;
  company?: string;
  category?: string;
  health?: string;
  availability?: string;
  compatibility?: "compatible" | "incompatible";
  capability?: string;
  status?: string;
};

export type MissionControlFilters = {
  companies: string[];
  categories: string[];
  healthStates: string[];
  availabilityStates: string[];
  compatibilityStates: string[];
  capabilities: string[];
  statuses: string[];
};
