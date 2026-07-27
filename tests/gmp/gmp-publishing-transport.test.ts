import { describe, expect, it, beforeEach, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });

import { createEnvironmentDestinationCredentialProvider } from "@/lib/gmp/publishing-credentials";
import { createWordpressTransport } from "@/lib/gmp/publishing-wordpress-transport";
import type { GmpPublishingDestination } from "@/lib/gmp/publishing-models";

function destination(credentialReference: string): GmpPublishingDestination {
  const now = new Date().toISOString();
  return {
    destinationId: "dest-1",
    projectId: "project-1",
    siteId: "site-1",
    destinationType: "WORDPRESS",
    name: "WP",
    baseUrl: "https://example.com",
    environment: "production",
    connectionStatus: "HEALTHY",
    credentialReference,
    capabilityProfile: {},
    createdAt: now,
    updatedAt: now,
  };
}

describe("gmp publishing credential and transport", () => {
  beforeEach(() => {
    delete process.env.TEST_WP_CREDENTIAL;
  });

  it("rejects malformed credential reference payload", async () => {
    const provider = createEnvironmentDestinationCredentialProvider();
    process.env.TEST_WP_CREDENTIAL = "{";

    const resolved = await provider.resolveDestinationCredential(destination("env:TEST_WP_CREDENTIAL"));
    expect(resolved).toBeNull();
  });

  it("validates credential presence and fields", async () => {
    const provider = createEnvironmentDestinationCredentialProvider();
    process.env.TEST_WP_CREDENTIAL = JSON.stringify({ username: "user", applicationPassword: "app-pass" });

    const status = await provider.validateDestinationCredential(destination("env:TEST_WP_CREDENTIAL"));
    expect(status.ok).toBe(true);
  });

  it("redacts secrets from transport failures", async () => {
    process.env.TEST_WP_CREDENTIAL = JSON.stringify({ username: "user", applicationPassword: "secret-pass" });

    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ message: "authorization=secret-pass" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }));

    const originalFetch = global.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = fetchMock;

    const transport = createWordpressTransport();
    const result = await transport.upsertContent({
      destination: destination("env:TEST_WP_CREDENTIAL"),
      payload: { title: "Title", slug: "slug", content: { html: "<p>x</p>" } },
    });

    expect(result.success).toBe(false);
    expect(String(result.response.error)).toContain("[REDACTED]");
    expect(String(result.response.error)).not.toContain("secret-pass");

    global.fetch = originalFetch;
  });
});
