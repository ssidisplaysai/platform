import { describe, expect, it } from "@jest/globals";
import { createActionReference, createGenesisSubject } from "@/platform/gop/auth/resolver";
import { getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";

describe("gop authorization resolver", () => {
  it("denies viewer mutation actions", () => {
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
      moduleId: "glw.core",
      action: createActionReference("job:retry", "job_action"),
      resource: {
        workspaceId: "glw-led-display-warehouse",
        moduleId: "glw.core",
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("DENIED_POLICY");
  });

  it("allows administrator access in joined workspaces", () => {
    const resolver = getGenesisAuthorizationResolver();
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

    const decision = resolver.authorize({
      subject,
      workspaceId: "glw-led-display-warehouse",
      moduleId: "glw.core",
      action: createActionReference("metrics:view", "metrics_access"),
      resource: {
        workspaceId: "glw-led-display-warehouse",
        moduleId: "glw.core",
      },
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe("ALLOWED");
  });
});
