import { describe, expect, it } from "@jest/globals";
import { getGenesisAuthenticatedIdentityFromSession } from "@/platform/gop/auth/authentication";

describe("gop authentication boundary", () => {
  it("establishes authenticated identity from session without permission data", () => {
    const identity = getGenesisAuthenticatedIdentityFromSession({
      email: "Admin@Example.com",
      expiresAt: 1_900_000_000_000,
    });

    expect(identity).toEqual({
      actorId: "admin@example.com",
      actorName: "admin@example.com",
      email: "admin@example.com",
      expiresAt: 1_900_000_000_000,
    });

    expect("permissions" in (identity ?? {})).toBe(false);
    expect("workspaceMemberships" in (identity ?? {})).toBe(false);
    expect("role" in (identity ?? {})).toBe(false);
  });

  it("returns null identity for unauthenticated session", () => {
    const identity = getGenesisAuthenticatedIdentityFromSession(null);
    expect(identity).toBeNull();
  });
});
