import { afterEach, describe, expect, it } from "@jest/globals";
import { createActionReference } from "@/platform/gop/auth/resolver";
import {
  createGenesisAuthorizationSubjectFromIdentity,
  getGenesisAuthorizationResolver,
} from "@/platform/gop/auth/authorization";

const originalAdminEmail = process.env.GLW_ADMIN_EMAIL;

afterEach(() => {
  process.env.GLW_ADMIN_EMAIL = originalAdminEmail;
});

describe("gop authorization boundary", () => {
  it("evaluates permissions from synthetic identity through authorization contract", () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const subject = createGenesisAuthorizationSubjectFromIdentity({
      actorId: "admin@example.com",
      actorName: "admin@example.com",
      email: "admin@example.com",
      expiresAt: Date.now() + 60_000,
    });

    const decision = getGenesisAuthorizationResolver().authorize({
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

  it("preserves viewer permission decision behavior", () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const subject = createGenesisAuthorizationSubjectFromIdentity({
      actorId: "viewer@example.com",
      actorName: "viewer@example.com",
      email: "viewer@example.com",
      expiresAt: Date.now() + 60_000,
    });

    const decision = getGenesisAuthorizationResolver().authorize({
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
});
