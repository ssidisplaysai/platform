import { describe, expect, it } from "@jest/globals";
import {
  createEnterpriseRegistryService,
  createEnterpriseRegistryValidationEngine,
  createInMemoryEnterpriseRegistryRepository,
} from "@/platform/ear";
import { makeRegistration } from "./fixtures";

describe("EAR service", () => {
  it("registers and retrieves an application", async () => {
    const service = createEnterpriseRegistryService({
      repository: createInMemoryEnterpriseRegistryRepository(),
      validation: createEnterpriseRegistryValidationEngine(),
    });

    const result = await service.registerApplication(makeRegistration());
    expect(result.validation.valid).toBe(true);
    expect(result.application?.registration.identity.applicationId).toBe("sample-app");

    const found = await service.retrieveApplication("sample-app");
    expect(found?.registration.identity.displayName).toBe("Sample Application");
  });

  it("returns validation errors for invalid registration", async () => {
    const service = createEnterpriseRegistryService({
      repository: createInMemoryEnterpriseRegistryRepository(),
      validation: createEnterpriseRegistryValidationEngine(),
    });

    const result = await service.registerApplication(makeRegistration({ version: { version: "bad" } }));
    expect(result.validation.valid).toBe(false);
    expect(result.application).toBeUndefined();
  });
});
