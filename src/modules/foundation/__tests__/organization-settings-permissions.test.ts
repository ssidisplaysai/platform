import { canManageSettingsFromSessionStatus, createOrganizationRequestHeaders } from "../OrganizationSettingsPanel";

describe("organization settings permission resolution", () => {
  test("returns true for authenticated platform_admin session", () => {
    expect(
      canManageSettingsFromSessionStatus({
        authenticated: true,
        principal: {
          roles: ["platform_admin"],
        },
      }),
    ).toBe(true);
  });

  test("returns false for authenticated session without settings permissions", () => {
    expect(
      canManageSettingsFromSessionStatus({
        authenticated: true,
        principal: {
          roles: ["viewer"],
        },
      }),
    ).toBe(false);
  });

  test("returns false for unauthenticated or malformed payload", () => {
    expect(canManageSettingsFromSessionStatus({ authenticated: false })).toBe(false);
    expect(canManageSettingsFromSessionStatus({ authenticated: true, principal: { roles: "platform_admin" } })).toBe(false);
    expect(canManageSettingsFromSessionStatus(null)).toBe(false);
  });

  test("includes operator CSRF header for organization creation mutations", () => {
    const originalDocument = global.document;
    Object.defineProperty(global, "document", {
      configurable: true,
      value: { cookie: "genesis_operator_csrf=test-csrf-token; other=value" },
    });
    const headers = new Headers(createOrganizationRequestHeaders());
    expect(headers.get("x-genesis-csrf-token")).toBe("test-csrf-token");
    expect(headers.get("content-type")).toBe("application/json");
    Object.defineProperty(global, "document", { configurable: true, value: originalDocument });
  });
});
