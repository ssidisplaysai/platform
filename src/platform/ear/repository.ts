import type { ApplicationRegistration, RegistrationSearchQuery } from "./types";

export type EnterpriseRegistryRepository = {
  create: (registration: ApplicationRegistration) => Promise<ApplicationRegistration>;
  read: (applicationId: string) => Promise<ApplicationRegistration | null>;
  update: (applicationId: string, registration: ApplicationRegistration) => Promise<ApplicationRegistration | null>;
  deactivate: (applicationId: string, deactivatedRegistration: ApplicationRegistration) => Promise<ApplicationRegistration | null>;
  list: () => Promise<ApplicationRegistration[]>;
  search: (query?: RegistrationSearchQuery) => Promise<ApplicationRegistration[]>;
};

function includesQuery(registration: ApplicationRegistration, query: string): boolean {
  const normalized = query.toLowerCase();

  return [
    registration.identity.applicationId,
    registration.identity.code,
    registration.identity.displayName,
    registration.metadata.description,
    registration.ownership.ownerOrganization,
    registration.ownership.ownerTeam,
  ].some((value) => value.toLowerCase().includes(normalized));
}

export function createInMemoryEnterpriseRegistryRepository(
  seed: ApplicationRegistration[] = [],
): EnterpriseRegistryRepository {
  const registry = new Map<string, ApplicationRegistration>(
    seed.map((registration) => [registration.identity.applicationId, registration]),
  );

  const clone = (registration: ApplicationRegistration): ApplicationRegistration => ({
    ...registration,
    identity: { ...registration.identity },
    status: { ...registration.status },
    metadata: {
      ...registration.metadata,
      tags: [...registration.metadata.tags],
      discovery: { ...registration.metadata.discovery },
    },
    capabilities: { declared: [...registration.capabilities.declared] },
    healthReference: { ...registration.healthReference },
    version: { ...registration.version },
    compatibility: {
      ...registration.compatibility,
      supportedHealthContractVersions: [...registration.compatibility.supportedHealthContractVersions],
      supportedCapabilityContractVersions: [...registration.compatibility.supportedCapabilityContractVersions],
    },
    ownership: { ...registration.ownership },
  });

  return {
    async create(registration) {
      registry.set(registration.identity.applicationId, clone(registration));
      return clone(registration);
    },

    async read(applicationId) {
      const current = registry.get(applicationId);
      return current ? clone(current) : null;
    },

    async update(applicationId, registration) {
      if (!registry.has(applicationId)) {
        return null;
      }

      registry.set(applicationId, clone(registration));
      return clone(registration);
    },

    async deactivate(applicationId, deactivatedRegistration) {
      if (!registry.has(applicationId)) {
        return null;
      }

      registry.set(applicationId, clone(deactivatedRegistration));
      return clone(deactivatedRegistration);
    },

    async list() {
      return [...registry.values()].map(clone);
    },

    async search(query = {}) {
      const results = [...registry.values()].filter((registration) => {
        if (query.lifecycleState && registration.status.lifecycleState !== query.lifecycleState) {
          return false;
        }

        if (query.capability && !registration.capabilities.declared.includes(query.capability)) {
          return false;
        }

        if (
          query.ownerOrganization
          && registration.ownership.ownerOrganization.toLowerCase() !== query.ownerOrganization.toLowerCase()
        ) {
          return false;
        }

        if (query.q && !includesQuery(registration, query.q)) {
          return false;
        }

        return true;
      });

      const limit = Math.min(500, Math.max(1, query.limit ?? 100));
      return results.slice(0, limit).map(clone);
    },
  };
}
