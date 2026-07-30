import { getGenesisAuthenticationService } from "@/platform/identity/services";

describe("genesis authentication service", () => {
  beforeEach(() => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    process.env.GLW_ADMIN_PASSWORD = "secret-123";
    process.env.GLW_AUTH_SECRET = "auth-secret";
  });

  it("authenticates valid credentials", async () => {
    const service = getGenesisAuthenticationService();
    const result = await service.authenticatePassword("admin@example.com", "secret-123");

    expect(result.authenticated).toBe(true);
    expect(result.principalId).toBe("admin@example.com");
    expect(result.session).toBeDefined();
  });

  it("rejects invalid credentials", async () => {
    const service = getGenesisAuthenticationService();
    const result = await service.authenticatePassword("admin@example.com", "bad");

    expect(result.authenticated).toBe(false);
    expect(result.failureCode).toBe("INVALID_CREDENTIAL");
  });

  it("exposes health snapshot and metrics", async () => {
    const service = getGenesisAuthenticationService();
    const health = await service.healthSnapshot();
    const metrics = service.getMetrics();

    expect(["HEALTHY", "DEGRADED", "CRITICAL"]).toContain(health.status);
    expect(metrics).toHaveProperty("loginSuccessCount");
    expect(metrics).toHaveProperty("activeSessionCount");
  });
});
