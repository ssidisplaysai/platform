import type {
  ApplicationLifecycleState,
  ApplicationRegistration,
  CompatibilityValidationInput,
  CompatibilityValidationResult,
  ValidationIssue,
  ValidationResult,
} from "./types";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const LIFECYCLE_TRANSITIONS: Record<ApplicationLifecycleState, ApplicationLifecycleState[]> = {
  REGISTERED: ["ACTIVE", "INACTIVE"],
  ACTIVE: ["INACTIVE", "DEPRECATED"],
  INACTIVE: ["ACTIVE", "DEPRECATED"],
  DEPRECATED: [],
};

function pushIssue(issues: ValidationIssue[], field: string, code: ValidationIssue["code"], message: string): void {
  issues.push({ field, code, message });
}

export type EnterpriseRegistryValidationEngine = {
  validateRegistration: (
    registration: ApplicationRegistration,
    options?: { existingApplicationIds?: string[] },
  ) => ValidationResult;
  validateLifecycleTransition: (
    currentState: ApplicationLifecycleState,
    nextState: ApplicationLifecycleState,
  ) => ValidationResult;
  validateCompatibility: (
    registration: ApplicationRegistration,
    input: Omit<CompatibilityValidationInput, "applicationId">,
  ) => CompatibilityValidationResult;
};

export function createEnterpriseRegistryValidationEngine(): EnterpriseRegistryValidationEngine {
  return {
    validateRegistration(registration, options = {}) {
      const issues: ValidationIssue[] = [];

      if (!registration.identity.applicationId.trim()) {
        pushIssue(issues, "identity.applicationId", "REQUIRED", "Application ID is required.");
      }

      if (options.existingApplicationIds?.includes(registration.identity.applicationId)) {
        pushIssue(issues, "identity.applicationId", "DUPLICATE", "Application ID must be unique.");
      }

      if (!registration.identity.code.trim()) {
        pushIssue(issues, "identity.code", "REQUIRED", "Application code is required.");
      }

      if (!registration.identity.displayName.trim()) {
        pushIssue(issues, "identity.displayName", "REQUIRED", "Application display name is required.");
      }

      if (!SEMVER_PATTERN.test(registration.version.version)) {
        pushIssue(issues, "version.version", "INVALID_FORMAT", "Version must follow semantic version syntax.");
      }

      if (registration.capabilities.declared.length === 0) {
        pushIssue(issues, "capabilities.declared", "REQUIRED", "At least one capability declaration is required.");
      }

      const capabilitySet = new Set<string>();
      for (const capability of registration.capabilities.declared) {
        const normalized = capability.trim().toLowerCase();
        if (!normalized) {
          pushIssue(issues, "capabilities.declared", "INVALID_VALUE", "Capabilities cannot be empty.");
          continue;
        }

        if (capabilitySet.has(normalized)) {
          pushIssue(issues, "capabilities.declared", "INVALID_VALUE", "Capabilities must be unique.");
        }

        capabilitySet.add(normalized);
      }

      if (!registration.ownership.ownerOrganization.trim()) {
        pushIssue(issues, "ownership.ownerOrganization", "REQUIRED", "Owner organization is required.");
      }

      if (!registration.ownership.ownerTeam.trim()) {
        pushIssue(issues, "ownership.ownerTeam", "REQUIRED", "Owner team is required.");
      }

      if (!registration.ownership.technicalContact.trim()) {
        pushIssue(issues, "ownership.technicalContact", "REQUIRED", "Technical contact is required.");
      }

      if (!registration.metadata.description.trim()) {
        pushIssue(issues, "metadata.description", "REQUIRED", "Description is required.");
      }

      if (!registration.metadata.discovery.launchPath.trim()) {
        pushIssue(issues, "metadata.discovery.launchPath", "REQUIRED", "Discovery launch path is required.");
      }

      if (!SEMVER_PATTERN.test(registration.compatibility.registryContractVersion)) {
        pushIssue(
          issues,
          "compatibility.registryContractVersion",
          "INVALID_FORMAT",
          "Registry contract version must follow semantic version syntax.",
        );
      }

      if (registration.compatibility.supportedHealthContractVersions.length === 0) {
        pushIssue(
          issues,
          "compatibility.supportedHealthContractVersions",
          "REQUIRED",
          "At least one supported health contract version is required.",
        );
      }

      if (registration.compatibility.supportedCapabilityContractVersions.length === 0) {
        pushIssue(
          issues,
          "compatibility.supportedCapabilityContractVersions",
          "REQUIRED",
          "At least one supported capability contract version is required.",
        );
      }

      if (!registration.healthReference.healthEndpoint.trim()) {
        pushIssue(issues, "healthReference.healthEndpoint", "REQUIRED", "Health endpoint reference is required.");
      }

      if (!SEMVER_PATTERN.test(registration.healthReference.contractVersion)) {
        pushIssue(
          issues,
          "healthReference.contractVersion",
          "INVALID_FORMAT",
          "Health contract version must follow semantic version syntax.",
        );
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    },

    validateLifecycleTransition(currentState, nextState) {
      if (currentState === nextState) {
        return { valid: true, issues: [] };
      }

      const validNext = LIFECYCLE_TRANSITIONS[currentState] ?? [];
      if (validNext.includes(nextState)) {
        return { valid: true, issues: [] };
      }

      return {
        valid: false,
        issues: [{
          field: "status.lifecycleState",
          code: "INVALID_TRANSITION",
          message: `Invalid lifecycle transition from ${currentState} to ${nextState}.`,
        }],
      };
    },

    validateCompatibility(registration, input) {
      const issues: ValidationIssue[] = [];

      if (registration.compatibility.registryContractVersion !== input.registryContractVersion) {
        pushIssue(
          issues,
          "compatibility.registryContractVersion",
          "UNSUPPORTED_VERSION",
          `Registry contract version ${input.registryContractVersion} is not supported by ${registration.identity.applicationId}.`,
        );
      }

      if (
        input.requiredHealthContractVersion
        && !registration.compatibility.supportedHealthContractVersions.includes(input.requiredHealthContractVersion)
      ) {
        pushIssue(
          issues,
          "compatibility.supportedHealthContractVersions",
          "UNSUPPORTED_VERSION",
          `Health contract version ${input.requiredHealthContractVersion} is not supported by ${registration.identity.applicationId}.`,
        );
      }

      if (
        input.requiredCapabilityContractVersion
        && !registration.compatibility.supportedCapabilityContractVersions.includes(input.requiredCapabilityContractVersion)
      ) {
        pushIssue(
          issues,
          "compatibility.supportedCapabilityContractVersions",
          "UNSUPPORTED_VERSION",
          `Capability contract version ${input.requiredCapabilityContractVersion} is not supported by ${registration.identity.applicationId}.`,
        );
      }

      return {
        valid: issues.length === 0,
        compatible: issues.length === 0,
        issues,
      };
    },
  };
}
