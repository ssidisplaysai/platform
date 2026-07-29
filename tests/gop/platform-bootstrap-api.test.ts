import { describe, expect, it } from "@jest/globals";
import type { GenesisWorkspaceDescriptor } from "@/platform/gop/contracts";
import { createGenesisSubject } from "@/platform/gop/auth/resolver";
import {
  getBootstrapState,
  initializePlatform,
  loadWorkspace,
  resolveCapabilities,
} from "@/lib/gop/platform-bootstrap-api";

const workspaceDescriptors: GenesisWorkspaceDescriptor[] = [
  {
    workspaceId: "glw-led-display-warehouse",
    name: "LED Display Warehouse",
    description: "GLW reference workspace",
    enabled: true,
    defaultModuleId: "glw.core",
    enabledModuleIds: ["glw.core"],
    availableSites: [
      { siteId: "led-display-warehouse", name: "LED Display Warehouse", region: "Austin, TX" },
    ],
    featureFlags: ["gop.events", "gop.inspector"],
    branding: {
      shortName: "GLW",
      logoText: "GLW",
    },
    environment: "development",
    order: 10,
  },
];

describe("platform bootstrap api", () => {
  it("initializes workspace and navigation for an authorized subject", () => {
    const subject = createGenesisSubject({
      actorId: "admin@example.com",
      role: "ADMINISTRATOR",
      permissions: ["read", "write", "admin"],
      workspaceMemberships: [
        {
          workspaceId: "glw-led-display-warehouse",
          actorId: "admin@example.com",
          role: "ADMINISTRATOR",
          permissions: ["read", "write", "admin"],
          active: true,
        },
      ],
    });

    const result = initializePlatform({ subject, workspaceDescriptors });

    expect(result.workspace?.workspaceId).toBe("glw-led-display-warehouse");
    expect(result.workspace?.availableSites?.[0]?.siteId).toBe("led-display-warehouse");
    expect(result.navigationItems.length).toBeGreaterThan(0);
    expect(result.state.initialized).toBe(true);
  });

  it("returns uninitialized state when no authorized workspace exists", () => {
    const subject = createGenesisSubject({
      actorId: "viewer@example.com",
      role: "VIEWER",
      permissions: ["read"],
      workspaceMemberships: [],
    });

    const workspace = loadWorkspace({ subject, workspaceDescriptors });
    const state = getBootstrapState({ workspace, navigationItems: [] });

    expect(workspace).toBeNull();
    expect(state.initialized).toBe(false);
    expect(state.issueCode).toBe("NO_AUTHORIZED_WORKSPACE");
  });

  it("derives workspace capabilities from the selected workspace", () => {
    const subject = createGenesisSubject({
      actorId: "admin2@example.com",
      role: "ADMINISTRATOR",
      permissions: ["read", "write", "admin"],
      workspaceMemberships: [
        {
          workspaceId: "glw-led-display-warehouse",
          actorId: "admin2@example.com",
          role: "ADMINISTRATOR",
          permissions: ["read", "write", "admin"],
          active: true,
        },
      ],
    });

    const workspace = loadWorkspace({ subject, workspaceDescriptors });
    expect(workspace).not.toBeNull();

    const capabilities = resolveCapabilities(workspace!);
    expect(capabilities.enabledModuleIds).toContain("glw.core");
  });
});
