import { afterEach, describe, expect, it } from "@jest/globals";
import {
  buildGenesisSubjectFromSession,
  isSubjectAuthorizedForRoute,
} from "@/platform/gop/auth/runtime";

const originalAdminEmail = process.env.GLW_ADMIN_EMAIL;

afterEach(() => {
  process.env.GLW_ADMIN_EMAIL = originalAdminEmail;
});

describe("gop auth runtime compatibility", () => {
  it("preserves protected-route authorization behavior for admin sessions", () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const subject = buildGenesisSubjectFromSession({
      email: "admin@example.com",
      expiresAt: Date.now() + 60_000,
    });

    const allowed = isSubjectAuthorizedForRoute({
      subject,
      workspaceId: "glw-led-display-warehouse",
      moduleId: "glw.core",
      route: "/glw",
    });

    expect(allowed).toBe(true);
  });

  it("preserves protected-route authorization behavior for unauthenticated subjects", () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const subject = buildGenesisSubjectFromSession(null);

    const allowed = isSubjectAuthorizedForRoute({
      subject,
      workspaceId: "glw-led-display-warehouse",
      moduleId: "glw.core",
      route: "/glw",
    });

    expect(allowed).toBe(false);
  });
});
