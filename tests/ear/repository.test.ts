import { describe, expect, it } from "@jest/globals";
import { createInMemoryEnterpriseRegistryRepository } from "@/platform/ear";
import { makeRegistration } from "./fixtures";

describe("EAR repository", () => {
  it("supports create, read, update, deactivate, and search", async () => {
    const now = new Date().toISOString();
    const repository = createInMemoryEnterpriseRegistryRepository();
    const registration = { ...makeRegistration(), createdAt: now, updatedAt: now };

    await repository.create(registration);

    const found = await repository.read(registration.identity.applicationId);
    expect(found?.identity.displayName).toBe("Sample Application");

    const updated = {
      ...registration,
      metadata: { ...registration.metadata, description: "Updated" },
      updatedAt: new Date().toISOString(),
    };

    await repository.update(registration.identity.applicationId, updated);
    const searched = await repository.search({ q: "updated" });
    expect(searched).toHaveLength(1);

    const deactivated = {
      ...updated,
      status: {
        ...updated.status,
        lifecycleState: "INACTIVE" as const,
        deactivatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };

    await repository.deactivate(registration.identity.applicationId, deactivated);
    const inactive = await repository.search({ lifecycleState: "INACTIVE" });
    expect(inactive).toHaveLength(1);
  });
});
