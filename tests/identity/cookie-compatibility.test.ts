import { createHmac } from "node:crypto";
import { GlwSessionCodec } from "@/platform/identity/session";

function legacySign(secret: string, payload: string): string {
  return createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

describe("glw cookie compatibility", () => {
  it("preserves legacy token shape payload.signature", () => {
    const codec = new GlwSessionCodec("compat-secret", 60);
    const payload = {
      email: "admin@example.com",
      expiresAt: Date.now() + 60_000,
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const expected = `${encodedPayload}.${legacySign("compat-secret", encodedPayload)}`;
    const actual = codec.encode(payload);

    expect(actual).toBe(expected);
    expect(actual.split(".")).toHaveLength(2);
  });
});
