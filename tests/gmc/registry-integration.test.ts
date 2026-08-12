import { describe, expect, it } from "@jest/globals";
import { createApplicationDiscoveryService, createApplicationLauncher, createLaunchPolicyResolver } from "@/platform/gmc";
import { createMockRegistryService } from "./fixtures";

describe("GMC registry integration", () => {
  it("consumes applications from EAR interfaces and does not maintain an inventory", async () => {
    const discovery = createApplicationDiscoveryService({
      registryService: createMockRegistryService(),
      launcher: createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() }),
    });

    const applications = await discovery.discoverApplications();
    const ids = applications.map((entry) => entry.applicationId);

    expect(ids).toEqual(expect.arrayContaining(["glw", "ssi", "rj-metal"]));
  });
});
