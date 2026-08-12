import type {
  ApplicationHealthStatus,
  CompatibilityAssessment,
  EnterpriseHealthState,
  LivenessStatus,
  ReadinessStatus,
} from "./types";

export type EnterpriseHealthEvaluationEngine = {
  evaluateStatus: (input: {
    readiness: ReadinessStatus;
    liveness: LivenessStatus;
    capabilityAvailableCount: number;
    capabilityDeclaredCount: number;
    compatibility: CompatibilityAssessment;
  }) => ApplicationHealthStatus;
  evaluateCompatibility: (input: {
    registryContractVersion: string;
    healthContractVersion: string;
    supportedHealthContractVersions: string[];
    supportedCapabilityContractVersions: string[];
    requiredHealthContractVersion?: string;
    requiredCapabilityContractVersion?: string;
  }) => CompatibilityAssessment;
  validateStateTransition: (fromState: EnterpriseHealthState, toState: EnterpriseHealthState) => { valid: boolean; reason?: string };
};

export function createEnterpriseHealthEvaluationEngine(): EnterpriseHealthEvaluationEngine {
  return {
    evaluateStatus(input) {
      const { readiness, liveness, capabilityAvailableCount, capabilityDeclaredCount, compatibility } = input;

      if (liveness === "NOT_LIVE") {
        return { state: "UNAVAILABLE", readiness, liveness };
      }

      if (!compatibility.compatible) {
        return { state: "DEGRADED", readiness, liveness };
      }

      if (readiness === "NOT_READY") {
        return { state: "WARNING", readiness, liveness };
      }

      if (capabilityDeclaredCount > 0 && capabilityAvailableCount === 0) {
        return { state: "DEGRADED", readiness, liveness };
      }

      if (capabilityDeclaredCount > capabilityAvailableCount) {
        return { state: "WARNING", readiness, liveness };
      }

      if (liveness === "UNKNOWN" || readiness === "UNKNOWN") {
        return { state: "UNKNOWN", readiness, liveness };
      }

      return { state: "HEALTHY", readiness, liveness };
    },

    evaluateCompatibility(input) {
      const issues: string[] = [];

      if (!input.supportedHealthContractVersions.includes(input.healthContractVersion)) {
        issues.push(`Health contract version ${input.healthContractVersion} not listed as supported.`);
      }

      if (
        input.requiredHealthContractVersion
        && !input.supportedHealthContractVersions.includes(input.requiredHealthContractVersion)
      ) {
        issues.push(`Required health contract version ${input.requiredHealthContractVersion} is unsupported.`);
      }

      if (
        input.requiredCapabilityContractVersion
        && !input.supportedCapabilityContractVersions.includes(input.requiredCapabilityContractVersion)
      ) {
        issues.push(`Required capability contract version ${input.requiredCapabilityContractVersion} is unsupported.`);
      }

      return {
        compatible: issues.length === 0,
        registryContractVersion: input.registryContractVersion,
        requiredHealthContractVersion: input.requiredHealthContractVersion,
        requiredCapabilityContractVersion: input.requiredCapabilityContractVersion,
        issues,
      };
    },

    validateStateTransition(fromState, toState) {
      if (fromState === toState) {
        return { valid: true };
      }

      if (fromState === "UNAVAILABLE" && toState === "HEALTHY") {
        return { valid: true };
      }

      if (fromState === "UNKNOWN") {
        return { valid: true };
      }

      return { valid: true };
    },
  };
}
