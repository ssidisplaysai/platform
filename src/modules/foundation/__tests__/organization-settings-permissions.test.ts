import { canManageSettingsFromSessionStatus } from "../OrganizationSettingsPanel";

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
});
