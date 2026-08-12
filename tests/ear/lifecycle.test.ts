import { describe, expect, it } from "@jest/globals";
import {
  createEnterpriseRegistryService,
  createEnterpriseRegistryValidationEngine,
  createInMemoryEnterpriseRegistryRepository,
} from "@/platform/ear";
import { makeRegistration } from "./fixtures";

describe("EAR lifecycle behavior", () => {
  it("deactivates an active application and records reason", async () => {
    const service = createEnterpriseRegistryService({
      repository: createInMemoryEnterpriseRegistryRepository(),
      validation: createEnterpriseRegistryValidationEngine(),
    });

    await service.registerApplication(makeRegistration({ status: { lifecycleState: "ACTIVE" } }));
    const deactivated = await service.deactivateApplication("sample-app", "Maintenance");

    expect(deactivated.validation.valid).toBe(true);
    expect(deactivated.application?.registration.status.lifecycleState).toBe("INACTIVE");
    expect(deactivated.application?.registration.status.deactivationReason).toBe("Maintenance");
  });

  it("blocks invalid lifecycle transition", async () => {
    const service = createEnterpriseRegistryService({
      repository: createInMemoryEnterpriseRegistryRepository(),
      validation: createEnterpriseRegistryValidationEngine(),
    });

    await service.registerApplication(makeRegistration({ status: { lifecycleState: "DEPRECATED" } }));
    const update = await service.updateRegistration("sample-app", { status: { lifecycleState: "ACTIVE" } });

    expect(update.validation.valid).toBe(false);
    expect(update.validation.issues[0]?.code).toBe("INVALID_TRANSITION");
  });
});
