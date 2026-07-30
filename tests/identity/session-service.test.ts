import { GlwSessionCodec } from "@/platform/identity/session";

describe("glw session codec", () => {
  it("encodes and decodes a valid session", () => {
    const codec = new GlwSessionCodec("test-secret", 60);
    const issued = codec.create("user@example.com");

    const decoded = codec.decode(issued.token);
    expect(decoded).not.toBeNull();
    expect(decoded?.email).toBe("user@example.com");
  });

  it("returns invalid for tampered token", () => {
    const codec = new GlwSessionCodec("test-secret", 60);
    const issued = codec.create("user@example.com");
    const tampered = `${issued.token}tampered`;

    const validation = codec.validate(tampered);
    expect(validation.valid).toBe(false);
    expect(validation.reasonCode).toBe("INVALID_SESSION");
  });

  it("revokes and invalidates token", () => {
    const codec = new GlwSessionCodec("test-secret", 60);
    const issued = codec.create("user@example.com");

    codec.revoke(issued.token);
    const validation = codec.validate(issued.token);
    expect(validation.valid).toBe(false);
  });

  it("supports renewal for valid tokens", () => {
    const codec = new GlwSessionCodec("test-secret", 60);
    const issued = codec.create("user@example.com");

    const renewed = codec.renew(issued.token);
    expect(renewed).not.toBeNull();
    expect(renewed?.payload.email).toBe("user@example.com");
  });
});
