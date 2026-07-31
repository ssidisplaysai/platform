import { describe, expect, it, jest } from "@jest/globals";

const redirectMock = jest.fn();
const createSessionMock = jest.fn(async (_email: string) => undefined);
const validateCredentialsMock = jest.fn(async (_email: string, _password: string) => true);

jest.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

jest.mock("@/lib/glw/auth", () => ({
  createGlwSession: createSessionMock,
  validateGlwCredentials: validateCredentialsMock,
}));

import { loginToGlw } from "@/app/glw/login/actions";

describe("glw login action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("authenticates and redirects on valid credentials", async () => {
    validateCredentialsMock.mockResolvedValueOnce(true);

    const form = new FormData();
    form.set("email", "Admin@Example.com ");
    form.set("password", "secret-123");

    await loginToGlw({}, form);

    expect(validateCredentialsMock).toHaveBeenCalledWith("Admin@Example.com ", "secret-123");
    expect(createSessionMock).toHaveBeenCalledWith("admin@example.com");
    expect(redirectMock).toHaveBeenCalledWith("/glw");
  });

  it("returns user-facing error on invalid credentials", async () => {
    validateCredentialsMock.mockResolvedValueOnce(false);

    const form = new FormData();
    form.set("email", "admin@example.com");
    form.set("password", "wrong");

    const result = await loginToGlw({}, form);

    expect(result).toEqual({ error: "The email or password is incorrect." });
    expect(createSessionMock).not.toHaveBeenCalled();
  });
});
