import type { EnterpriseApplication, EnterpriseRegistryService } from "@/platform/ear";

function makeEarApplication(applicationId: string, capabilities: string[]): EnterpriseApplication {
  const now = new Date().toISOString();

  return {
    registration: {
      identity: {
        applicationId,
        code: applicationId.toUpperCase(),
        displayName: applicationId,
      },
      status: { lifecycleState: "ACTIVE" },
      metadata: {
        description: `${applicationId} metadata`,
        tags: ["enterprise"],
        discovery: { launchPath: `/${applicationId}` },
      },
      capabilities: { declared: capabilities },
      healthReference: {
        healthEndpoint: `/api/${applicationId}/health`,
        capabilityEndpoint: `/api/${applicationId}/capabilities`,
        contractVersion: "1.0.0",
      },
      version: { version: "1.0.0" },
      compatibility: {
        registryContractVersion: "1.0.0",
        supportedHealthContractVersions: ["1.0.0"],
        supportedCapabilityContractVersions: ["1.0.0"],
      },
      ownership: {
        ownerOrganization: "Genesis Enterprise",
        ownerTeam: "Platform",
        technicalContact: "platform@genesis.local",
      },
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function createMockEarService(appIds: string[] = ["glw"]): EnterpriseRegistryService {
  const applications = appIds.map((appId) => makeEarApplication(appId, ["capability-a", "capability-b"]));

  return {
    async registerApplication() {
      return { validation: { valid: true, issues: [] }, application: applications[0] };
    },
    async updateRegistration() {
      return { validation: { valid: true, issues: [] }, application: applications[0] };
    },
    async deactivateApplication() {
      return { validation: { valid: true, issues: [] }, application: applications[0] };
    },
    async retrieveApplication(applicationId) {
      return applications.find((entry) => entry.registration.identity.applicationId === applicationId) ?? null;
    },
    async enumerateApplications() {
      return applications;
    },
    async validateRegistration() {
      return { valid: true, issues: [] };
    },
    async validateCompatibility() {
      return { valid: true, compatible: true, issues: [] };
    },
    async validateLifecycleTransition() {
      return { validation: { valid: true, issues: [] } };
    },
    async lookupHealthReference(applicationId) {
      const app = applications.find((entry) => entry.registration.identity.applicationId === applicationId);
      return app?.registration.healthReference ?? null;
    },
    async lookupCapabilities(applicationId) {
      const app = applications.find((entry) => entry.registration.identity.applicationId === applicationId);
      return app?.registration.capabilities ?? null;
    },
  };
}
