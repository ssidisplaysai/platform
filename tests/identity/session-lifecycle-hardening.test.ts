import { GlwSessionCodec, GenesisSessionService } from "@/platform/identity/session";
import { InMemorySessionRecordStore } from "@/platform/identity/persistence";

describe("gid-1002b session lifecycle hardening", () => {
  it("persists issued sessions and validates by token", async () => {
    const store = new InMemorySessionRecordStore();
    const service = new GenesisSessionService(new GlwSessionCodec("hardening-secret", 300), store);

    const issued = await service.issueToken("admin@example.com");
    const validation = await service.validateSession({ token: issued.token });

    expect(validation.valid).toBe(true);
    expect(validation.principalId).toBe("admin@example.com");
  });

  it("revokes sessions durably and blocks subsequent validation", async () => {
    const store = new InMemorySessionRecordStore();
    const service = new GenesisSessionService(new GlwSessionCodec("hardening-secret", 300), store);

    const issued = await service.issueToken("admin@example.com");
    await service.revokeToken(issued.token, "SESSION_REVOKED", "admin@example.com");

    const validation = await service.validateSession({ token: issued.token });
    expect(validation.valid).toBe(false);
    expect(validation.reasonCode).toBe("REVOKED_SESSION");
  });

  it("rotates session tokens during renewal and revokes prior token", async () => {
    const store = new InMemorySessionRecordStore();
    const service = new GenesisSessionService(new GlwSessionCodec("hardening-secret", 300), store);

    const issued = await service.issueToken("admin@example.com");
    const renewed = await service.renewToken(issued.token);

    expect(renewed).not.toBeNull();

    const oldValidation = await service.validateSession({ token: issued.token });
    const newValidation = await service.validateSession({ token: renewed!.token });

    expect(oldValidation.valid).toBe(false);
    expect(oldValidation.reasonCode).toBe("REVOKED_SESSION");
    expect(newValidation.valid).toBe(true);
  });

  it("returns EXPIRED_SESSION for expired tokens", async () => {
    const codec = new GlwSessionCodec("hardening-secret", 300);
    const service = new GenesisSessionService(codec, new InMemorySessionRecordStore());

    const expired = codec.encode({
      email: "admin@example.com",
      expiresAt: Date.now() - 10,
    });

    const validation = await service.validateSession({ token: expired });
    expect(validation.valid).toBe(false);
    expect(validation.reasonCode).toBe("EXPIRED_SESSION");
  });

  it("remains revoked after service restart when storage is shared", async () => {
    const sharedStore = new InMemorySessionRecordStore();
    const first = new GenesisSessionService(new GlwSessionCodec("hardening-secret", 300), sharedStore);
    const issued = await first.issueToken("admin@example.com");
    await first.revokeToken(issued.token, "SESSION_REVOKED", "admin@example.com");

    const second = new GenesisSessionService(new GlwSessionCodec("hardening-secret", 300), sharedStore);
    const validation = await second.validateSession({ token: issued.token });

    expect(validation.valid).toBe(false);
    expect(validation.reasonCode).toBe("REVOKED_SESSION");
  });

  it("implements createSession and revokeSession semantics", async () => {
    const service = new GenesisSessionService(
      new GlwSessionCodec("hardening-secret", 300),
      new InMemorySessionRecordStore(),
    );

    const descriptor = await service.createSession({
      principalId: "admin@example.com",
      identityId: "admin@example.com",
      authenticationContextId: "context-1",
    });

    expect(descriptor.active).toBe(true);

    const beforeRevoke = await service.validateSession({ sessionId: descriptor.sessionId });
    expect(beforeRevoke.valid).toBe(true);

    await service.revokeSession(descriptor.sessionId, "MANUAL_REVOKE");
    const afterRevoke = await service.validateSession({ sessionId: descriptor.sessionId });

    expect(afterRevoke.valid).toBe(false);
  });
});
