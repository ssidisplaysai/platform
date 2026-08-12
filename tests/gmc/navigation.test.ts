import { describe, expect, it } from "@jest/globals";
import { createNavigationService } from "@/platform/gmc";

describe("GMC navigation", () => {
  it("builds navigation dynamically from applications", () => {
    const navigationService = createNavigationService();
    const navigation = navigationService.buildNavigation([
      {
        applicationId: "glw",
        displayName: "GLW",
        description: "x",
        company: "Genesis Enterprise",
        category: "Manufacturing",
        launchUrl: "/glw",
        icon: "app-default",
        registrationStatus: "ACTIVE",
        version: "1.0.0",
        ownership: { organization: "Genesis Enterprise", team: "A", technicalContact: "a@example.com" },
        capabilities: ["catalog"],
        compatibility: { registryContractVersion: "1.0.0", healthContractVersions: ["1.0.0"], capabilityContractVersions: ["1.0.0"], compatible: true, issues: [] },
        health: { state: "HEALTHY", readiness: "READY", liveness: "LIVE", availability: "AVAILABLE" },
        launch: { target: "INTERNAL", href: "/glw" },
      },
    ]);

    expect(navigation.applications).toEqual(["GLW"]);
    expect(navigation.companies).toContain("Genesis Enterprise");
  });
});
