import type { RegisterApplicationInput } from "@/platform/ear";

export function makeRegistration(overrides: Partial<RegisterApplicationInput> = {}): RegisterApplicationInput {
  return {
    identity: {
      applicationId: "sample-app",
      code: "SAMPLE",
      displayName: "Sample Application",
      ...(overrides.identity ?? {}),
    },
    status: {
      lifecycleState: "REGISTERED",
      ...(overrides.status ?? {}),
    },
    metadata: {
      description: "Sample application metadata",
      tags: ["sample"],
      discovery: {
        launchPath: "/sample",
        ...(overrides.metadata?.discovery ?? {}),
      },
      ...(overrides.metadata ?? {}),
    },
    capabilities: {
      declared: ["reporting"],
      ...(overrides.capabilities ?? {}),
    },
    healthReference: {
      healthEndpoint: "/api/sample/health",
      capabilityEndpoint: "/api/sample/capabilities",
      contractVersion: "1.0.0",
      ...(overrides.healthReference ?? {}),
    },
    version: {
      version: "1.0.0",
      ...(overrides.version ?? {}),
    },
    compatibility: {
      registryContractVersion: "1.0.0",
      supportedHealthContractVersions: ["1.0.0"],
      supportedCapabilityContractVersions: ["1.0.0"],
      ...(overrides.compatibility ?? {}),
    },
    ownership: {
      ownerOrganization: "Genesis Enterprise",
      ownerTeam: "Platform",
      technicalContact: "platform@genesis.local",
      ...(overrides.ownership ?? {}),
    },
  };
}
