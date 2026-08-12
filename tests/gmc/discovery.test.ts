import { describe, expect, it } from "@jest/globals";
import { createApplicationDiscoveryService, createApplicationLauncher, createLaunchPolicyResolver } from "@/platform/gmc";
import { createMockRegistryService } from "./fixtures";

describe("GMC discovery", () => {
  it("discovers applications dynamically from EAR", async () => {
    const discovery = createApplicationDiscoveryService({
      registryService: createMockRegistryService(),
      launcher: createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() }),
    });

    const applications = await discovery.discoverApplications();
    expect(applications.length).toBeGreaterThan(1);
    expect(applications.some((entry) => entry.displayName === "GLW")).toBe(true);
  });
});
