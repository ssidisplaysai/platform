import { describe, expect, it } from "@jest/globals";
import {
  createEnterpriseRegistryService,
  createEnterpriseRegistryValidationEngine,
  createInMemoryEnterpriseRegistryRepository,
} from "@/platform/ear";
import { makeRegistration } from "./fixtures";

describe("EAR compatibility validation", () => {
  it("accepts compatible versions", async () => {
    const service = createEnterpriseRegistryService({
      repository: createInMemoryEnterpriseRegistryRepository(),
      validation: createEnterpriseRegistryValidationEngine(),
    });

    await service.registerApplication(makeRegistration());

    const result = await service.validateCompatibility({
      applicationId: "sample-app",
      registryContractVersion: "1.0.0",
      requiredHealthContractVersion: "1.0.0",
      requiredCapabilityContractVersion: "1.0.0",
    });

    expect(result.valid).toBe(true);
    expect(result.compatible).toBe(true);
  });

  it("rejects unsupported versions", async () => {
    const service = createEnterpriseRegistryService({
      repository: createInMemoryEnterpriseRegistryRepository(),
      validation: createEnterpriseRegistryValidationEngine(),
    });

    await service.registerApplication(makeRegistration());

    const result = await service.validateCompatibility({
      applicationId: "sample-app",
      registryContractVersion: "2.0.0",
      requiredHealthContractVersion: "2.0.0",
      requiredCapabilityContractVersion: "2.0.0",
    });

    expect(result.valid).toBe(false);
    expect(result.compatible).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
