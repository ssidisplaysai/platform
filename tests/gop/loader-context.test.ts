import { describe, expect, it } from "@jest/globals";
import { createGenesisSubject } from "@/platform/gop/auth/resolver";
import { getGenesisNavigationItems, loadGenesisModules } from "@/platform/gop/runtime/loader";

describe("gop loader context cache", () => {
  it("does not leak a denied cache result across authorized subjects", () => {
    const deniedSubject = createGenesisSubject({
      actorId: "no-workspace@example.com",
      role: "VIEWER",
      permissions: ["read"],
      workspaceMemberships: [],
    });

    const allowedSubject = createGenesisSubject({
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

    loadGenesisModules(true, { subject: deniedSubject, workspaceId: "glw-led-display-warehouse" });
    const deniedNavigation = getGenesisNavigationItems({
      subject: deniedSubject,
      workspaceId: "glw-led-display-warehouse",
    });

    const allowedNavigation = getGenesisNavigationItems({
      subject: allowedSubject,
      workspaceId: "glw-led-display-warehouse",
    });

    expect(deniedNavigation).toHaveLength(0);
    expect(allowedNavigation.length).toBeGreaterThan(0);
  });
});
