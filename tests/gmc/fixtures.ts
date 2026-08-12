import type { EnterpriseRegistryService, EnterpriseApplication } from "@/platform/ear";
import type { EnterpriseHealthService, EnterpriseHealthRecord, HealthAggregation } from "@/platform/ehc";

type ApplicationFixtureOptions = {
  lifecycleState?: EnterpriseApplication["registration"]["status"]["lifecycleState"];
  launchPath?: string;
  baseUrl?: string;
};

export function makeApplication(
  applicationId: string,
  name: string,
  company: string,
  category: string,
  options: ApplicationFixtureOptions = {},
): EnterpriseApplication {
  const now = new Date().toISOString();

  return {
    registration: {
      identity: {
        applicationId,
        code: applicationId.toUpperCase(),
        displayName: name,
      },
      status: { lifecycleState: options.lifecycleState ?? "ACTIVE" },
      metadata: {
        description: `${name} description`,
        tags: [category],
        discovery: {
          launchPath: options.launchPath ?? `/${applicationId}`,
          baseUrl: options.baseUrl,
        },
      },
      capabilities: { declared: ["catalog", "operations"] },
      healthReference: { healthEndpoint: `/api/${applicationId}/health`, contractVersion: "1.0.0" },
      version: { version: "1.0.0" },
      compatibility: {
        registryContractVersion: "1.0.0",
        supportedHealthContractVersions: ["1.0.0"],
        supportedCapabilityContractVersions: ["1.0.0"],
      },
      ownership: {
        ownerOrganization: company,
        ownerTeam: `${company} Team`,
        technicalContact: `${applicationId}@example.com`,
      },
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function makeHealth(applicationId: string, state: EnterpriseHealthRecord["status"]["state"]): EnterpriseHealthRecord {
  return {
    applicationId,
    observedAt: new Date().toISOString(),
    status: {
      state,
      readiness: state === "HEALTHY" ? "READY" : "NOT_READY",
      liveness: state === "UNAVAILABLE" ? "NOT_LIVE" : "LIVE",
    },
    capabilities: {
      declaredCapabilities: ["catalog", "operations"],
      availableCapabilities: state === "UNAVAILABLE" ? ["catalog"] : ["catalog", "operations"],
      unavailableCapabilities: state === "UNAVAILABLE" ? ["operations"] : [],
      statuses: [
        { capability: "catalog", availability: "AVAILABLE" },
        { capability: "operations", availability: state === "UNAVAILABLE" ? "UNAVAILABLE" : "AVAILABLE" },
      ],
    },
    compatibility: {
      compatible: state !== "DEGRADED",
      registryContractVersion: "1.0.0",
      issues: state === "DEGRADED" ? ["Compatibility mismatch"] : [],
    },
    reference: {
      healthEndpoint: `/api/${applicationId}/health`,
      contractVersion: "1.0.0",
    },
    source: "SIMULATED",
  };
}

export function createMockRegistryService(): EnterpriseRegistryService {
  const applications = [
    makeApplication("glw", "GLW", "Genesis Enterprise", "manufacturing"),
    makeApplication("ssi", "Screen Solutions International", "Genesis Enterprise", "installation"),
    makeApplication("rj-metal", "RJ Metal", "Metal Group", "fabrication"),
  ];

  return createRegistryServiceFromApplications(applications);
}

export function createRegistryServiceFromApplications(applications: EnterpriseApplication[]): EnterpriseRegistryService {

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
      const application = applications.find((entry) => entry.registration.identity.applicationId === applicationId);
      return application?.registration.healthReference ?? null;
    },
    async lookupCapabilities(applicationId) {
      const application = applications.find((entry) => entry.registration.identity.applicationId === applicationId);
      return application?.registration.capabilities ?? null;
    },
  };
}

export function createMockHealthService(): EnterpriseHealthService {
  const current = new Map<string, EnterpriseHealthRecord>([
    ["glw", makeHealth("glw", "HEALTHY")],
    ["ssi", makeHealth("ssi", "WARNING")],
    ["rj-metal", makeHealth("rj-metal", "DEGRADED")],
  ]);

  const summary: HealthAggregation = {
    aggregatedAt: new Date().toISOString(),
    enterpriseState: "DEGRADED",
    enterpriseReadiness: "NOT_READY",
    enterpriseAvailability: "LIVE",
    applications: {
      total: 3,
      healthy: 1,
      warning: 1,
      degraded: 1,
      unavailable: 0,
      unknown: 0,
    },
    compatibility: { compatible: 2, incompatible: 1 },
    perApplication: [...current.values()].map((record) => ({
      applicationId: record.applicationId,
      state: record.status.state,
      readiness: record.status.readiness,
      liveness: record.status.liveness,
    })),
    perCapability: [
      { capability: "catalog", healthy: 1, warning: 1, degraded: 1, unavailable: 0, unknown: 0 },
      { capability: "operations", healthy: 1, warning: 1, degraded: 1, unavailable: 0, unknown: 0 },
    ],
  };

  return createHealthServiceFromRecords(current, summary);
}

export function createHealthServiceFromRecords(
  current: Map<string, EnterpriseHealthRecord>,
  summary: HealthAggregation,
): EnterpriseHealthService {
  return {
    async evaluateHealth(input) {
      return current.get(input.applicationId) ?? null;
    },
    async recordHealth(record) {
      current.set(record.applicationId, record);
      return record;
    },
    async retrieveHealth(applicationId) {
      return current.get(applicationId) ?? null;
    },
    async retrieveHealthHistory(applicationId) {
      const found = current.get(applicationId);
      return found ? [found] : [];
    },
    async aggregateHealth() {
      return summary;
    },
    async validateCompatibility(applicationCompatibility) {
      const found = current.get(applicationCompatibility.applicationId);
      return found?.compatibility ?? null;
    },
    async retrieveCapabilityInformation(applicationId) {
      return current.get(applicationId)?.capabilities ?? null;
    },
    async retrieveReadiness(applicationId) {
      return current.get(applicationId)?.status.readiness ?? null;
    },
    async retrieveLiveness(applicationId) {
      return current.get(applicationId)?.status.liveness ?? null;
    },
    async generateEnterpriseHealthSummary() {
      return summary;
    },
    async bootstrapFromRegistrySimulation() {
      return;
    },
  };
}
