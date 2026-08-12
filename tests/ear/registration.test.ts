import { describe, expect, it } from "@jest/globals";
import { getEnterpriseRegistryService, resetEnterpriseRegistryServiceForTests } from "@/platform/ear";

describe("EAR seeded registrations", () => {
  it("seeds foundational application metadata without runtime logic", async () => {
    resetEnterpriseRegistryServiceForTests();
    const service = getEnterpriseRegistryService();

    const apps = await service.enumerateApplications();
    const ids = apps.map((app) => app.registration.identity.applicationId);

    expect(ids).toEqual(expect.arrayContaining([
      "glw",
      "screen-solutions-international",
      "rj-metal",
      "stoner",
      "green-machine",
    ]));

    for (const app of apps) {
      expect(app.registration.healthReference.healthEndpoint.startsWith("/")).toBe(true);
      expect(app.registration.metadata.discovery.launchPath.startsWith("/")).toBe(true);
    }
  });
});
