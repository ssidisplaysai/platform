export type EnterpriseHealthState = "HEALTHY" | "WARNING" | "DEGRADED" | "UNAVAILABLE" | "UNKNOWN";
export type ReadinessStatus = "READY" | "NOT_READY" | "UNKNOWN";
export type LivenessStatus = "LIVE" | "NOT_LIVE" | "UNKNOWN";
export type CapabilityAvailability = "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";

export type HealthReference = {
  healthEndpoint: string;
  capabilityEndpoint?: string;
  contractVersion: string;
};

export type CapabilityStatus = {
  capability: string;
  availability: CapabilityAvailability;
  reason?: string;
};

export type CapabilityAdvertisement = {
  declaredCapabilities: string[];
  availableCapabilities: string[];
  unavailableCapabilities: string[];
  statuses: CapabilityStatus[];
};

export type CompatibilityAssessment = {
  compatible: boolean;
  registryContractVersion: string;
  requiredHealthContractVersion?: string;
  requiredCapabilityContractVersion?: string;
  issues: string[];
};

export type ApplicationHealthStatus = {
  state: EnterpriseHealthState;
  readiness: ReadinessStatus;
  liveness: LivenessStatus;
};

export type EnterpriseHealthRecord = {
  applicationId: string;
  observedAt: string;
  status: ApplicationHealthStatus;
  capabilities: CapabilityAdvertisement;
  compatibility: CompatibilityAssessment;
  reference: HealthReference;
  source: "SIMULATED" | "INTEGRATION" | "MANUAL";
};

export type HealthSnapshot = {
  applicationId: string;
  capturedAt: string;
  record: EnterpriseHealthRecord;
};

export type HealthHistory = {
  applicationId: string;
  records: EnterpriseHealthRecord[];
};

export type HealthEvent = {
  applicationId: string;
  occurredAt: string;
  fromState: EnterpriseHealthState;
  toState: EnterpriseHealthState;
  reason: string;
};

export type PerCapabilityHealth = {
  capability: string;
  healthy: number;
  warning: number;
  degraded: number;
  unavailable: number;
  unknown: number;
};

export type HealthAggregation = {
  aggregatedAt: string;
  enterpriseState: EnterpriseHealthState;
  enterpriseReadiness: ReadinessStatus;
  enterpriseAvailability: LivenessStatus;
  applications: {
    total: number;
    healthy: number;
    warning: number;
    degraded: number;
    unavailable: number;
    unknown: number;
  };
  compatibility: {
    compatible: number;
    incompatible: number;
  };
  perApplication: Array<{
    applicationId: string;
    state: EnterpriseHealthState;
    readiness: ReadinessStatus;
    liveness: LivenessStatus;
  }>;
  perCapability: PerCapabilityHealth[];
};

export type EvaluateHealthInput = {
  applicationId: string;
  readiness?: ReadinessStatus;
  liveness?: LivenessStatus;
  availableCapabilities?: string[];
  requiredHealthContractVersion?: string;
  requiredCapabilityContractVersion?: string;
  source?: "SIMULATED" | "INTEGRATION" | "MANUAL";
};

export type ValidateCompatibilityInput = {
  applicationId: string;
  requiredHealthContractVersion?: string;
  requiredCapabilityContractVersion?: string;
};
