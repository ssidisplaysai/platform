import { describe, expect, it } from "@jest/globals";
import { createActionReference, createGenesisSubject } from "@/platform/gop/auth/resolver";
import { getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";

describe("gba customer success authorization", () => {
  it("denies recommendation review for viewer by default policy", () => {
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
      moduleId: "gba.customer_success",
      action: createActionReference("gba:customer_success:review_recommendations", "route_access"),
      resource: {
        workspaceId: "glw-led-display-warehouse",
        moduleId: "gba.customer_success",
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
      moduleId: "gba.customer_success",
      action: createActionReference("gba:customer_success:view_dashboard", "route_access"),
      resource: {
        workspaceId: "glw-led-display-warehouse",
        moduleId: "gba.customer_success",
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("DENIED_WORKSPACE");
  });
});
