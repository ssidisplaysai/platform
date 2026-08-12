import type { RegisterApplicationInput } from "./types";

export const ENTERPRISE_REGISTRY_SEED: RegisterApplicationInput[] = [
  {
    identity: { applicationId: "glw", code: "GLW", displayName: "Green LED Warehouse" },
    status: { lifecycleState: "ACTIVE" },
    metadata: {
      description: "Green LED Warehouse enterprise operations application integrated with certified Genesis platform services.",
      tags: ["enterprise", "warehouse", "operations", "canonical-reference"],
      discovery: { launchPath: "/glw" },
    },
    capabilities: { declared: ["catalog", "order-management", "page-generation"] },
    healthReference: {
      healthEndpoint: "/api/glw/health",
      capabilityEndpoint: "/api/glw/capabilities",
      contractVersion: "1.0.0",
    },
    version: { version: "1.0.0" },
    compatibility: {
      registryContractVersion: "1.0.0",
      supportedHealthContractVersions: ["1.0.0"],
      supportedCapabilityContractVersions: ["1.0.0"],
    },
    ownership: {
      ownerOrganization: "Green LED Warehouse",
      ownerTeam: "GLW Platform Team",
      technicalContact: "platform@greenledwarehouse.local",
    },
  },
  {
    identity: {
      applicationId: "screen-solutions-international",
      code: "SSI",
      displayName: "Screen Solutions International",
    },
    status: { lifecycleState: "REGISTERED" },
    metadata: {
      description: "Genesis application registration metadata for Screen Solutions International.",
      tags: ["enterprise"],
      discovery: { launchPath: "/ssi" },
    },
    capabilities: { declared: ["production-planning", "installation-ops"] },
    healthReference: {
      healthEndpoint: "/api/ssi/health",
      capabilityEndpoint: "/api/ssi/capabilities",
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
      ownerTeam: "SSI Platform Team",
      technicalContact: "ssi-platform@genesis.local",
    },
  },
  {
    identity: { applicationId: "rj-metal", code: "RJM", displayName: "RJ Metal" },
    status: { lifecycleState: "REGISTERED" },
    metadata: {
      description: "Genesis application registration metadata for RJ Metal.",
      tags: ["enterprise"],
      discovery: { launchPath: "/rj-metal" },
    },
    capabilities: { declared: ["fabrication", "work-orders"] },
    healthReference: {
      healthEndpoint: "/api/rj-metal/health",
      capabilityEndpoint: "/api/rj-metal/capabilities",
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
      ownerTeam: "RJ Metal Platform Team",
      technicalContact: "rjmetal-platform@genesis.local",
    },
  },
  {
    identity: { applicationId: "stoner", code: "STONER", displayName: "STONER" },
    status: { lifecycleState: "REGISTERED" },
    metadata: {
      description: "Genesis application registration metadata for STONER.",
      tags: ["enterprise"],
      discovery: { launchPath: "/stoner" },
    },
    capabilities: { declared: ["operations", "analytics"] },
    healthReference: {
      healthEndpoint: "/api/stoner/health",
      capabilityEndpoint: "/api/stoner/capabilities",
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
      ownerTeam: "STONER Platform Team",
      technicalContact: "stoner-platform@genesis.local",
    },
  },
  {
    identity: {
      applicationId: "green-machine",
      code: "GREENMACHINE",
      displayName: "Green Machine",
    },
    status: { lifecycleState: "REGISTERED" },
    metadata: {
      description: "Genesis application registration metadata for Green Machine.",
      tags: ["enterprise"],
      discovery: { launchPath: "/green-machine" },
    },
    capabilities: { declared: ["fleet", "telemetry"] },
    healthReference: {
      healthEndpoint: "/api/green-machine/health",
      capabilityEndpoint: "/api/green-machine/capabilities",
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
      ownerTeam: "Green Machine Platform Team",
      technicalContact: "greenmachine-platform@genesis.local",
    },
  },
];
