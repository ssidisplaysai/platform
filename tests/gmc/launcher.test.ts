import { describe, expect, it } from "@jest/globals";
import { createApplicationLauncher, createLaunchPolicyResolver } from "@/platform/gmc";

function makeRegistration(input: { launchPath: string; baseUrl?: string }) {
  return {
    identity: { applicationId: "glw", code: "GLW", displayName: "GLW" },
    status: { lifecycleState: "ACTIVE" as const },
    metadata: { description: "d", tags: [], discovery: { launchPath: input.launchPath, baseUrl: input.baseUrl } },
    capabilities: { declared: [] },
    healthReference: { healthEndpoint: "/api/glw/health", contractVersion: "1.0.0" },
    version: { version: "1.0.0" },
    compatibility: { registryContractVersion: "1.0.0", supportedHealthContractVersions: ["1.0.0"], supportedCapabilityContractVersions: ["1.0.0"] },
    ownership: { ownerOrganization: "Genesis", ownerTeam: "Platform", technicalContact: "p@example.com" },
    createdAt: "now",
    updatedAt: "now",
  };
}

describe("GMC launcher", () => {
  it("resolves internal launch from registry metadata", () => {
    const launcher = createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() });

    const launch = launcher.resolveLaunch(makeRegistration({ launchPath: "/glw" }));

    expect(launch.valid).toBe(true);
    if (!launch.valid) {
      return;
    }

    expect(launch.target).toBe("INTERNAL");
    expect(launch.safeTarget).toBe("/glw");
  });

  it("resolves external launch when absolute https launch path is provided", () => {
    const launcher = createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() });
    const launch = launcher.resolveLaunch(makeRegistration({ launchPath: "https://apps.example.com/glw" }));

    expect(launch.valid).toBe(true);
    if (!launch.valid) {
      return;
    }

    expect(launch.target).toBe("EXTERNAL");
    expect(launch.safeTarget).toBe("https://apps.example.com/glw");
  });

  it("allows loopback http targets for local development", () => {
    const launcher = createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() });
    const launch = launcher.resolveLaunch(makeRegistration({ launchPath: "http://localhost:3000/glw" }));

    expect(launch.valid).toBe(true);
    if (!launch.valid) {
      return;
    }

    expect(launch.target).toBe("EXTERNAL");
    expect(launch.safeTarget).toBe("http://localhost:3000/glw");
  });

  it("blocks missing launch metadata", () => {
    const launcher = createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() });
    const launch = launcher.resolveLaunch(makeRegistration({ launchPath: "   " }));

    expect(launch.valid).toBe(false);
    if (launch.valid) {
      return;
    }

    expect(launch.reason).toBe("BLOCKED_MISSING_METADATA");
  });

  it("blocks protocol-relative targets", () => {
    const launcher = createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() });
    const launch = launcher.resolveLaunch(makeRegistration({ launchPath: "//evil.example.com" }));

    expect(launch.valid).toBe(false);
    if (launch.valid) {
      return;
    }

    expect(launch.reason).toBe("BLOCKED_INVALID_TARGET");
  });

  it("blocks unsafe schemes", () => {
    const launcher = createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() });
    const javascriptTarget = launcher.resolveLaunch(makeRegistration({ launchPath: "javascript:alert(1)" }));
    const dataTarget = launcher.resolveLaunch(makeRegistration({ launchPath: "data:text/html,hello" }));

    expect(javascriptTarget.valid).toBe(false);
    expect(dataTarget.valid).toBe(false);
  });

  it("blocks external http targets for non-loopback hosts", () => {
    const launcher = createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() });
    const launch = launcher.resolveLaunch(makeRegistration({ launchPath: "http://evil.example.com/app" }));

    expect(launch.valid).toBe(false);
    if (launch.valid) {
      return;
    }

    expect(launch.reason).toBe("BLOCKED_INVALID_TARGET");
  });

  it("blocks targets containing credentials", () => {
    const launcher = createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() });
    const launch = launcher.resolveLaunch(makeRegistration({ launchPath: "https://user:pass@example.com/app" }));

    expect(launch.valid).toBe(false);
    if (launch.valid) {
      return;
    }

    expect(launch.reason).toBe("BLOCKED_INVALID_TARGET");
  });

  it("fails closed for malformed external URLs that trigger parser failure", () => {
    const launcher = createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() });

    expect(() => launcher.resolveLaunch(makeRegistration({ launchPath: "https://%" }))).not.toThrow();
    const launch = launcher.resolveLaunch(makeRegistration({ launchPath: "https://%" }));

    expect(launch.valid).toBe(false);
    if (launch.valid) {
      return;
    }

    expect(launch.reason).toBe("BLOCKED_INVALID_TARGET");
  });

  it("blocks internal paths containing backslashes or control characters", () => {
    const launcher = createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() });
    const backslashTarget = launcher.resolveLaunch(makeRegistration({ launchPath: "/bad\\path" }));
    const controlCharTarget = launcher.resolveLaunch(makeRegistration({ launchPath: "/bad\npath" }));

    expect(backslashTarget.valid).toBe(false);
    expect(controlCharTarget.valid).toBe(false);
  });

  it("builds external href from baseUrl and path", () => {
    const launcher = createApplicationLauncher({ launchPolicyResolver: createLaunchPolicyResolver() });
    const launch = launcher.resolveLaunch(makeRegistration({ launchPath: "glw", baseUrl: "https://apps.example.com" }));

    expect(launch.valid).toBe(true);
    if (!launch.valid) {
      return;
    }

    expect(launch.target).toBe("EXTERNAL");
    expect(launch.safeTarget).toBe("https://apps.example.com/glw");
  });
});
