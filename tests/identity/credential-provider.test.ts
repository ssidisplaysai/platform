import { LocalCredentialProvider } from "@/platform/identity/providers";

describe("local credential provider", () => {
  const provider = new LocalCredentialProvider({
    providerId: "glw-local",
    adminEmail: "admin@example.com",
    adminPassword: "secret-123",
  });

  it("accepts valid credentials", async () => {
    const result = await provider.verify({
      credentialId: "cred-1",
      kind: "PASSWORD",
      keyReference: "admin@example.com\nsecret-123",
    });

    expect(result.valid).toBe(true);
    expect(result.principalId).toBe("admin@example.com");
  });

  it("rejects invalid password", async () => {
    const result = await provider.verify({
      credentialId: "cred-2",
      kind: "PASSWORD",
      keyReference: "admin@example.com\nwrong",
    });

    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("INVALID_CREDENTIAL");
  });

  it("rejects malformed key reference", async () => {
    const result = await provider.verify({
      credentialId: "cred-3",
      kind: "PASSWORD",
      keyReference: "malformed",
    });

    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("INVALID_CREDENTIAL");
  });
});
