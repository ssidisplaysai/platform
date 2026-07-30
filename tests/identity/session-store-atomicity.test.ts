import { InMemorySessionRecordStore } from "@/platform/identity/persistence";

describe("gid-1002b session store atomicity", () => {
  it("rotates a session atomically with old token revocation and new token issuance", async () => {
    const store = new InMemorySessionRecordStore();

    await store.saveIssuedSession({
      sessionId: "session-1",
      tokenHash: "token-hash-1",
      principalId: "admin@example.com",
      identityId: "admin@example.com",
      authenticationContextId: "ctx-1",
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    });

    const rotated = await store.rotateSession({
      oldTokenHash: "token-hash-1",
      replacement: {
        sessionId: "session-2",
        tokenHash: "token-hash-2",
        principalId: "admin@example.com",
        identityId: "admin@example.com",
        authenticationContextId: "ctx-2",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      },
      reasonCode: "SESSION_RENEWED",
      actorPrincipalId: "admin@example.com",
    });

    expect(rotated).toBe(true);

    const oldRecord = await store.findByTokenHash("token-hash-1");
    const newRecord = await store.findByTokenHash("token-hash-2");

    expect(oldRecord?.active).toBe(false);
    expect(oldRecord?.revocationReasonCode).toBe("SESSION_RENEWED");
    expect(newRecord?.active).toBe(true);
  });
});
