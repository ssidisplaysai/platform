import { describe, expect, it } from "@jest/globals";
import { issueWorkerToken, verifyWorkerToken } from "@/platform/gop";

describe("gop worker token", () => {
  it("issues and verifies signed worker token", () => {
    const token = issueWorkerToken({
      workerId: "worker.token.1",
      tokenId: "token-1",
      protocolVersion: "gop-worker/v1",
      secret: "test-secret",
      ttlMs: 10_000,
    });

    const verified = verifyWorkerToken(token, "test-secret");
    expect(verified?.workerId).toBe("worker.token.1");
    expect(verified?.tokenId).toBe("token-1");
    expect(verified?.protocolVersion).toBe("gop-worker/v1");
  });

  it("rejects tampered tokens", () => {
    const token = issueWorkerToken({
      workerId: "worker.token.2",
      tokenId: "token-2",
      protocolVersion: "gop-worker/v1",
      secret: "test-secret",
      ttlMs: 10_000,
    });

    const tampered = `${token}x`;
    expect(verifyWorkerToken(tampered, "test-secret")).toBeNull();
  });
});
