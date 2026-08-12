import type {
  ApplicationLifecycleState,
  ApplicationRegistration,
  CompatibilityValidationInput,
  CompatibilityValidationResult,
  EnterpriseApplication,
  RegisterApplicationInput,
  RegistrationSearchQuery,
  UpdateRegistrationInput,
  ValidationResult,
} from "./types";
import type { EnterpriseRegistryRepository } from "./repository";
import type { EnterpriseRegistryValidationEngine } from "./validation";

export type EnterpriseRegistryService = {
  registerApplication: (input: RegisterApplicationInput) => Promise<{ application?: EnterpriseApplication; validation: ValidationResult }>;
  updateRegistration: (
    applicationId: string,
    updates: UpdateRegistrationInput,
  ) => Promise<{ application?: EnterpriseApplication; validation: ValidationResult; notFound?: boolean }>;
  deactivateApplication: (
    applicationId: string,
    reason?: string,
  ) => Promise<{ application?: EnterpriseApplication; validation: ValidationResult; notFound?: boolean }>;
  retrieveApplication: (applicationId: string) => Promise<EnterpriseApplication | null>;
  enumerateApplications: (query?: RegistrationSearchQuery) => Promise<EnterpriseApplication[]>;
  validateRegistration: (input: RegisterApplicationInput) => Promise<ValidationResult>;
  validateCompatibility: (input: CompatibilityValidationInput) => Promise<CompatibilityValidationResult>;
  validateLifecycleTransition: (
    applicationId: string,
    nextState: ApplicationLifecycleState,
  ) => Promise<{ validation: ValidationResult; notFound?: boolean }>;
  lookupHealthReference: (applicationId: string) => Promise<ApplicationRegistration["healthReference"] | null>;
  lookupCapabilities: (applicationId: string) => Promise<ApplicationRegistration["capabilities"] | null>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function toEnterpriseApplication(registration: ApplicationRegistration): EnterpriseApplication {
  return { registration };
}

function mergeRegistration(
  current: ApplicationRegistration,
  updates: UpdateRegistrationInput,
): ApplicationRegistration {
  return {
    ...current,
    status: updates.status ? { ...current.status, ...updates.status } : current.status,
    metadata: updates.metadata
      ? {
          ...current.metadata,
          ...updates.metadata,
          discovery: updates.metadata.discovery
            ? { ...current.metadata.discovery, ...updates.metadata.discovery }
            : current.metadata.discovery,
          tags: updates.metadata.tags ? [...updates.metadata.tags] : current.metadata.tags,
        }
      : current.metadata,
    capabilities: updates.capabilities
      ? { ...current.capabilities, declared: [...updates.capabilities.declared] }
      : current.capabilities,
    healthReference: updates.healthReference
      ? { ...current.healthReference, ...updates.healthReference }
      : current.healthReference,
    version: updates.version ? { ...current.version, ...updates.version } : current.version,
    compatibility: updates.compatibility
      ? {
          ...current.compatibility,
          ...updates.compatibility,
          supportedHealthContractVersions: updates.compatibility.supportedHealthContractVersions
            ? [...updates.compatibility.supportedHealthContractVersions]
            : current.compatibility.supportedHealthContractVersions,
          supportedCapabilityContractVersions: updates.compatibility.supportedCapabilityContractVersions
            ? [...updates.compatibility.supportedCapabilityContractVersions]
            : current.compatibility.supportedCapabilityContractVersions,
        }
      : current.compatibility,
    ownership: updates.ownership ? { ...current.ownership, ...updates.ownership } : current.ownership,
    updatedAt: nowIso(),
  };
}

export function createEnterpriseRegistryService(input: {
  repository: EnterpriseRegistryRepository;
  validation: EnterpriseRegistryValidationEngine;
}): EnterpriseRegistryService {
  const { repository, validation } = input;

  return {
    async registerApplication(registrationInput) {
      const existing = await repository.read(registrationInput.identity.applicationId);
      const now = nowIso();

      const registration: ApplicationRegistration = {
        ...registrationInput,
        createdAt: now,
        updatedAt: now,
      };

      const registrationValidation = validation.validateRegistration(registration, {
        existingApplicationIds: existing ? [existing.identity.applicationId] : [],
      });

      if (!registrationValidation.valid) {
        return { validation: registrationValidation };
      }

      const saved = await repository.create(registration);
      return {
        validation: registrationValidation,
        application: toEnterpriseApplication(saved),
      };
    },

    async updateRegistration(applicationId, updates) {
      const current = await repository.read(applicationId);
      if (!current) {
        return {
          notFound: true,
          validation: {
            valid: false,
            issues: [{ field: "identity.applicationId", code: "INVALID_VALUE", message: "Application not found." }],
          },
        };
      }

      const nextState = updates.status?.lifecycleState;
      if (nextState) {
        const lifecycleValidation = validation.validateLifecycleTransition(current.status.lifecycleState, nextState);
        if (!lifecycleValidation.valid) {
          return { validation: lifecycleValidation };
        }
      }

      const merged = mergeRegistration(current, updates);
      const registrationValidation = validation.validateRegistration(merged, {
        existingApplicationIds: [],
      });

      if (!registrationValidation.valid) {
        return { validation: registrationValidation };
      }

      const updated = await repository.update(applicationId, merged);
      if (!updated) {
        return {
          notFound: true,
          validation: {
            valid: false,
            issues: [{ field: "identity.applicationId", code: "INVALID_VALUE", message: "Application not found." }],
          },
        };
      }

      return {
        validation: registrationValidation,
        application: toEnterpriseApplication(updated),
      };
    },

    async deactivateApplication(applicationId, reason) {
      const current = await repository.read(applicationId);
      if (!current) {
        return {
          notFound: true,
          validation: {
            valid: false,
            issues: [{ field: "identity.applicationId", code: "INVALID_VALUE", message: "Application not found." }],
          },
        };
      }

      const lifecycleValidation = validation.validateLifecycleTransition(current.status.lifecycleState, "INACTIVE");
      if (!lifecycleValidation.valid) {
        return { validation: lifecycleValidation };
      }

      const deactivated: ApplicationRegistration = {
        ...current,
        status: {
          ...current.status,
          lifecycleState: "INACTIVE",
          deactivatedAt: nowIso(),
          deactivationReason: reason ?? "Manual deactivation",
        },
        updatedAt: nowIso(),
      };

      const saved = await repository.deactivate(applicationId, deactivated);
      if (!saved) {
        return {
          notFound: true,
          validation: {
            valid: false,
            issues: [{ field: "identity.applicationId", code: "INVALID_VALUE", message: "Application not found." }],
          },
        };
      }

      return {
        validation: { valid: true, issues: [] },
        application: toEnterpriseApplication(saved),
      };
    },

    async retrieveApplication(applicationId) {
      const registration = await repository.read(applicationId);
      return registration ? toEnterpriseApplication(registration) : null;
    },

    async enumerateApplications(query) {
      const registrations = query ? await repository.search(query) : await repository.list();
      return registrations.map(toEnterpriseApplication);
    },

    async validateRegistration(registrationInput) {
      const existing = await repository.read(registrationInput.identity.applicationId);
      const registration: ApplicationRegistration = {
        ...registrationInput,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      return validation.validateRegistration(registration, {
        existingApplicationIds: existing ? [existing.identity.applicationId] : [],
      });
    },

    async validateCompatibility(inputCompatibility) {
      const current = await repository.read(inputCompatibility.applicationId);
      if (!current) {
        return {
          valid: false,
          compatible: false,
          issues: [{ field: "identity.applicationId", code: "INVALID_VALUE", message: "Application not found." }],
        };
      }

      return validation.validateCompatibility(current, {
        registryContractVersion: inputCompatibility.registryContractVersion,
        requiredHealthContractVersion: inputCompatibility.requiredHealthContractVersion,
        requiredCapabilityContractVersion: inputCompatibility.requiredCapabilityContractVersion,
      });
    },

    async validateLifecycleTransition(applicationId, nextState) {
      const current = await repository.read(applicationId);
      if (!current) {
        return {
          notFound: true,
          validation: {
            valid: false,
            issues: [{ field: "identity.applicationId", code: "INVALID_VALUE", message: "Application not found." }],
          },
        };
      }

      return {
        validation: validation.validateLifecycleTransition(current.status.lifecycleState, nextState),
      };
    },

    async lookupHealthReference(applicationId) {
      const current = await repository.read(applicationId);
      return current?.healthReference ?? null;
    },

    async lookupCapabilities(applicationId) {
      const current = await repository.read(applicationId);
      return current?.capabilities ?? null;
    },
  };
}
