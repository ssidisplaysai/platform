import { AuthenticationAuditWriter } from "@/platform/identity/services";
import { InMemoryAuthenticationAuditStore } from "@/platform/identity/persistence";

describe("gid-1002b durable audit behavior", () => {
  it("appends timestamped authentication audit events and supports querying", async () => {
    const store = new InMemoryAuthenticationAuditStore();
    const writer = new AuthenticationAuditWriter(store);

    await writer.loginSuccess("admin@example.com", "glw-local");
    await writer.loginFailure("glw-local", "INVALID_CREDENTIAL");

    const records = await writer.listRecent(10);

    expect(records.length).toBe(2);
    expect(records[0]?.occurredAt).toBeDefined();
    expect(records[0]?.eventType).toBe("AUTHENTICATION_FAILED");
    expect(records[1]?.eventType).toBe("AUTHENTICATION_SUCCEEDED");
  });

  it("records session lifecycle audit events", async () => {
    const store = new InMemoryAuthenticationAuditStore();
    const writer = new AuthenticationAuditWriter(store);

    await writer.sessionCreated("admin@example.com");
    await writer.sessionRevoked("admin@example.com");
    await writer.logout("admin@example.com");

    const records = await writer.listRecent(10);
    const eventTypes = records.map((record) => record.eventType);

    expect(eventTypes).toContain("SESSION_CREATED");
    expect(eventTypes.filter((eventType) => eventType === "SESSION_REVOKED").length).toBeGreaterThanOrEqual(2);
  });
});
