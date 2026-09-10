export type EnterpriseHealthState = "HEALTHY" | "WARNING" | "DEGRADED" | "UNAVAILABLE" | "UNKNOWN";
export type ReadinessStatus = "READY" | "NOT_READY" | "UNKNOWN";
export type LivenessStatus = "LIVE" | "NOT_LIVE" | "UNKNOWN";
export type CapabilityAvailability = "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";

export type CapabilityStatus = { capability: string; availability: CapabilityAvailability; reason?: string };
export type CapabilityAdvertisement = { declaredCapabilities: string[]; availableCapabilities: string[]; unavailableCapabilities: string[]; statuses: CapabilityStatus[] };
export type CompatibilityAssessment = { compatible: boolean; registryContractVersion: string; requiredHealthContractVersion?: string; requiredCapabilityContractVersion?: string; issues: string[] };
export type ApplicationHealthStatus = { state: EnterpriseHealthState; readiness: ReadinessStatus; liveness: LivenessStatus };