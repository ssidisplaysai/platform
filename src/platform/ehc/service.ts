import type { EnterpriseRegistryService } from "@/platform/ear";
import type { EnterpriseAggregationEngine } from "./aggregation-engine";
import type { EnterpriseCapabilityEngine } from "./capability-engine";
import type { EnterpriseHealthEvaluationEngine } from "./evaluation-engine";
import type { EnterpriseHealthRepository } from "./repository";
import type {
  EnterpriseHealthRecord,
  EvaluateHealthInput,
  HealthAggregation,
  ValidateCompatibilityInput,
} from "./types";

export type EnterpriseHealthService = {
  evaluateHealth: (input: EvaluateHealthInput) => Promise<EnterpriseHealthRecord | null>;
  recordHealth: (record: EnterpriseHealthRecord) => Promise<EnterpriseHealthRecord | null>;
  retrieveHealth: (applicationId: string) => Promise<EnterpriseHealthRecord | null>;
  retrieveHealthHistory: (applicationId: string, limit?: number) => Promise<EnterpriseHealthRecord[]>;
  aggregateHealth: () => Promise<HealthAggregation>;
  validateCompatibility: (input: ValidateCompatibilityInput) => Promise<EnterpriseHealthRecord["compatibility"] | null>;
  retrieveCapabilityInformation: (applicationId: string) => Promise<EnterpriseHealthRecord["capabilities"] | null>;
  retrieveReadiness: (applicationId: string) => Promise<EnterpriseHealthRecord["status"]["readiness"] | null>;
  retrieveLiveness: (applicationId: string) => Promise<EnterpriseHealthRecord["status"]["liveness"] | null>;
  generateEnterpriseHealthSummary: () => Promise<HealthAggregation>;
  bootstrapFromRegistrySimulation: () => Promise<void>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function simulatedReadiness(applicationId: string): EnterpriseHealthRecord["status"]["readiness"] {
  const hash = applicationId.length % 3;
  if (hash === 0) {
    return "READY";
  }

  if (hash === 1) {
    return "NOT_READY";
  }

  return "UNKNOWN";
}

function simulatedLiveness(applicationId: string): EnterpriseHealthRecord["status"]["liveness"] {
  const hash = applicationId.length % 4;
  if (hash === 0 || hash === 3) {
    return "LIVE";
  }

  if (hash === 1) {
    return "NOT_LIVE";
  }

  return "UNKNOWN";
}

export function createEnterpriseHealthService(input: {
  earService: EnterpriseRegistryService;
  repository: EnterpriseHealthRepository;
  evaluationEngine: EnterpriseHealthEvaluationEngine;
  capabilityEngine: EnterpriseCapabilityEngine;
  aggregationEngine: EnterpriseAggregationEngine;
}): EnterpriseHealthService {
  const {
    earService,
    repository,
    evaluationEngine,
    capabilityEngine,
    aggregationEngine,
  } = input;

  async function buildRecord(evalInput: EvaluateHealthInput): Promise<EnterpriseHealthRecord | null> {
    const application = await earService.retrieveApplication(evalInput.applicationId);
    if (!application) {
      return null;
    }

    const registration = application.registration;
    const declaredCapabilities = registration.capabilities.declared;
    const availableCapabilities = evalInput.availableCapabilities ?? declaredCapabilities;

    const capabilities = capabilityEngine.buildAdvertisement(declaredCapabilities, availableCapabilities);
    const compatibility = evaluationEngine.evaluateCompatibility({
      registryContractVersion: registration.compatibility.registryContractVersion,
      healthContractVersion: registration.healthReference.contractVersion,
      supportedHealthContractVersions: registration.compatibility.supportedHealthContractVersions,
      supportedCapabilityContractVersions: registration.compatibility.supportedCapabilityContractVersions,
      requiredHealthContractVersion: evalInput.requiredHealthContractVersion,
      requiredCapabilityContractVersion: evalInput.requiredCapabilityContractVersion,
    });

    const readiness = evalInput.readiness ?? "UNKNOWN";
    const liveness = evalInput.liveness ?? "UNKNOWN";

    const status = evaluationEngine.evaluateStatus({
      readiness,
      liveness,
      capabilityAvailableCount: capabilities.availableCapabilities.length,
      capabilityDeclaredCount: capabilities.declaredCapabilities.length,
      compatibility,
    });

    return {
      applicationId: registration.identity.applicationId,
      observedAt: nowIso(),
      status,
      capabilities,
      compatibility,
      reference: {
        healthEndpoint: registration.healthReference.healthEndpoint,
        capabilityEndpoint: registration.healthReference.capabilityEndpoint,
        contractVersion: registration.healthReference.contractVersion,
      },
      source: evalInput.source ?? "MANUAL",
    };
  }

  return {
    async evaluateHealth(evalInput) {
      const next = await buildRecord(evalInput);
      if (!next) {
        return null;
      }

      const previous = await repository.retrieveCurrent(next.applicationId);
      const saved = previous
        ? await repository.updateCurrent(next)
        : await repository.createRecord(next);

      if (previous) {
        const transition = evaluationEngine.validateStateTransition(previous.status.state, saved.status.state);
        if (transition.valid && previous.status.state !== saved.status.state) {
          await repository.appendEvent({
            applicationId: saved.applicationId,
            occurredAt: saved.observedAt,
            fromState: previous.status.state,
            toState: saved.status.state,
            reason: "Health evaluation update",
          });
        }
      }

      await repository.saveSnapshot({
        applicationId: saved.applicationId,
        capturedAt: saved.observedAt,
        record: saved,
      });

      return saved;
    },

    async recordHealth(record) {
      const application = await earService.retrieveApplication(record.applicationId);
      if (!application) {
        return null;
      }

      const previous = await repository.retrieveCurrent(record.applicationId);
      const saved = previous
        ? await repository.updateCurrent(record)
        : await repository.createRecord(record);

      if (previous && previous.status.state !== saved.status.state) {
        await repository.appendEvent({
          applicationId: saved.applicationId,
          occurredAt: nowIso(),
          fromState: previous.status.state,
          toState: saved.status.state,
          reason: "Manual health record update",
        });
      }

      await repository.saveSnapshot({
        applicationId: saved.applicationId,
        capturedAt: nowIso(),
        record: saved,
      });

      return saved;
    },

    async retrieveHealth(applicationId) {
      return repository.retrieveCurrent(applicationId);
    },

    async retrieveHealthHistory(applicationId, limit) {
      return repository.retrieveHistory(applicationId, limit);
    },

    async aggregateHealth() {
      const current = await repository.retrieveAllCurrent();
      const aggregation = aggregationEngine.aggregate(current);
      await repository.saveAggregation(aggregation);
      return aggregation;
    },

    async validateCompatibility(compatibilityInput) {
      const current = await repository.retrieveCurrent(compatibilityInput.applicationId);
      if (!current) {
        const evaluated = await this.evaluateHealth({
          applicationId: compatibilityInput.applicationId,
          source: "MANUAL",
        });

        if (!evaluated) {
          return null;
        }

        return evaluated.compatibility;
      }

      return evaluationEngine.evaluateCompatibility({
        registryContractVersion: current.compatibility.registryContractVersion,
        healthContractVersion: current.reference.contractVersion,
        supportedHealthContractVersions: current.compatibility.requiredHealthContractVersion
          ? [current.compatibility.requiredHealthContractVersion]
          : [current.reference.contractVersion],
        supportedCapabilityContractVersions: current.compatibility.requiredCapabilityContractVersion
          ? [current.compatibility.requiredCapabilityContractVersion]
          : ["1.0.0"],
        requiredHealthContractVersion: compatibilityInput.requiredHealthContractVersion,
        requiredCapabilityContractVersion: compatibilityInput.requiredCapabilityContractVersion,
      });
    },

    async retrieveCapabilityInformation(applicationId) {
      const current = await repository.retrieveCurrent(applicationId);
      return current?.capabilities ?? null;
    },

    async retrieveReadiness(applicationId) {
      const current = await repository.retrieveCurrent(applicationId);
      return current?.status.readiness ?? null;
    },

    async retrieveLiveness(applicationId) {
      const current = await repository.retrieveCurrent(applicationId);
      return current?.status.liveness ?? null;
    },

    async generateEnterpriseHealthSummary() {
      const latest = await repository.retrieveLatestAggregation();
      if (latest) {
        return latest;
      }

      return this.aggregateHealth();
    },

    async bootstrapFromRegistrySimulation() {
      const applications = await earService.enumerateApplications();
      for (const application of applications) {
        const registration = application.registration;
        await this.evaluateHealth({
          applicationId: registration.identity.applicationId,
          readiness: simulatedReadiness(registration.identity.applicationId),
          liveness: simulatedLiveness(registration.identity.applicationId),
          availableCapabilities: registration.capabilities.declared.slice(0, Math.max(1, registration.capabilities.declared.length - 1)),
          source: "SIMULATED",
        });
      }

      await this.aggregateHealth();
    },
  };
}
