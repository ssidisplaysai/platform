import { describe, expect, it } from "@jest/globals";
import { createActionReference, createGenesisSubject } from "@/platform/gop/auth/resolver";
import { getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";

describe("gba sales authorization", () => {
  it("denies viewer pipeline mutation by default policy", () => {
    const resolver = getGenesisAuthorizationResolver();
    const subject = createGenesisSubject({
      actorId: "viewer@example.com",
      role: "VIEWER",
      permissions: ["read"],
      workspaceMemberships: [
        {
          workspaceId: "glw-led-display-warehouse",
          actorId: "viewer@example.com",
          role: "VIEWER",
          permissions: ["read"],
          active: true,
        },
      ],
    });

    const decision = resolver.authorize({
      subject,
      workspaceId: "glw-led-display-warehouse",
      moduleId: "gba.sales",
      action: createActionReference("gba:sales:manage_pipeline", "route_access"),
      resource: {
        workspaceId: "glw-led-display-warehouse",
        moduleId: "gba.sales",
      },
    });

    expect(decision.allowed).toBe(false);
  });

  it("denies access for subject outside workspace membership", () => {
    const resolver = getGenesisAuthorizationResolver();
    const subject = createGenesisSubject({
      actorId: "admin@example.com",
      role: "ADMINISTRATOR",
      permissions: ["read", "write", "admin"],
      workspaceMemberships: [
        {
          workspaceId: "another-workspace",
          actorId: "admin@example.com",
          role: "ADMINISTRATOR",
          permissions: ["read", "write", "admin"],
          active: true,
        },
      ],
    });

    const decision = resolver.authorize({
      subject,
      workspaceId: "glw-led-display-warehouse",
      moduleId: "gba.sales",
      action: createActionReference("gba:sales:view_dashboard", "route_access"),
      resource: {
        workspaceId: "glw-led-display-warehouse",
        moduleId: "gba.sales",
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("DENIED_WORKSPACE");
  });
});
