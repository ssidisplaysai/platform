import { describe, expect, it } from "@jest/globals";
import {
  createAnalyticsAdapterRegistry,
  createCustomFixtureAnalyticsAdapter,
  createFixtureGa4Adapter,
  createFixtureSearchConsoleAdapter,
  createFixtureWordpressAdapter,
  resolveAnalyticsAdapter,
} from "@/lib/gmp/analytics-adapters";
import { createAnalyticsSource } from "@/lib/gmp/analytics-models";

function fixtureSource(sourceType: string, scenario = "success") {
  return createAnalyticsSource({
    projectId: "proj_adapter",
    workspaceId: "glw-led-display-warehouse",
    sourceType,
    sourceName: `${sourceType} Fixture`,
    configuration: { scenario },
    providerReference: "provider-demo",
  });
}

describe("gmp analytics adapters", () => {
  it("resolves adapters from registry and rejects unsupported adapters", () => {
    const registry = createAnalyticsAdapterRegistry();
    const source = fixtureSource("GOOGLE_SEARCH_CONSOLE");
    const adapter = registry.resolveBySource(source);

    expect(adapter?.adapterKey).toBe("fixture.gsc");
    expect(() => resolveAnalyticsAdapter(fixtureSource("UNKNOWN_PROVIDER"))).toThrow("Unsupported analytics adapter");
  });

  it("search console adapter supports success, pagination, partial, and error classification", async () => {
    const adapter = createFixtureSearchConsoleAdapter();
    const source = fixtureSource("GOOGLE_SEARCH_CONSOLE", "success");

    const page1 = await adapter.collect({ source, startCursor: { page: 1 }, metrics: [], dimensions: [] });
    expect(page1.observations.length).toBeGreaterThan(0);
    expect(page1.complete).toBe(false);
    expect(page1.nextCursor).toBeDefined();

    const page2 = await adapter.collect({ source, startCursor: page1.nextCursor, metrics: [], dimensions: [] });
    expect(page2.complete).toBe(true);

    const partial = await adapter.collect({ source: fixtureSource("GOOGLE_SEARCH_CONSOLE", "partial"), metrics: [], dimensions: [] });
    expect(partial.partial).toBe(true);
    expect(partial.warnings.length).toBeGreaterThan(0);

    await expect(adapter.collect({ source: fixtureSource("GOOGLE_SEARCH_CONSOLE", "rate_limit"), metrics: [], dimensions: [] })).rejects.toThrow("rate_limit");
    await expect(adapter.collect({ source: fixtureSource("GOOGLE_SEARCH_CONSOLE", "timeout"), metrics: [], dimensions: [] })).rejects.toThrow("timeout");
    await expect(adapter.collect({ source: fixtureSource("GOOGLE_SEARCH_CONSOLE", "malformed"), metrics: [], dimensions: [] })).rejects.toThrow("malformed");

    const rateLimit = adapter.classifyError(new Error("rate_limit"));
    const timeout = adapter.classifyError(new Error("timeout"));
    const malformed = adapter.classifyError(new Error("malformed payload"));
    expect(rateLimit.category).toBe("RATE_LIMIT");
    expect(timeout.category).toBe("TIMEOUT");
    expect(malformed.category).toBe("INVALID_RESPONSE");
  });

  it("ga4 adapter supports success, pagination, partial and auth failure", async () => {
    const adapter = createFixtureGa4Adapter();
    const source = fixtureSource("GOOGLE_ANALYTICS_4", "success");

    const page1 = await adapter.collect({ source, startCursor: { page: 1 }, metrics: [], dimensions: [] });
    const page2 = await adapter.collect({ source, startCursor: page1.nextCursor, metrics: [], dimensions: [] });
    expect(page1.observations.length).toBeGreaterThan(0);
    expect(page2.complete).toBe(true);

    const partial = await adapter.collect({ source: fixtureSource("GOOGLE_ANALYTICS_4", "partial"), metrics: [], dimensions: [] });
    expect(partial.partial).toBe(true);

    await expect(adapter.collect({ source: fixtureSource("GOOGLE_ANALYTICS_4", "auth_failure"), metrics: [], dimensions: [] })).rejects.toThrow("authentication failed");
    await expect(adapter.collect({ source: fixtureSource("GOOGLE_ANALYTICS_4", "malformed"), metrics: [], dimensions: [] })).rejects.toThrow("malformed");
  });

  it("wordpress adapter preserves remote identity dimensions and supports partial mode", async () => {
    const adapter = createFixtureWordpressAdapter();
    const response = await adapter.collect({ source: fixtureSource("WORDPRESS", "success"), metrics: [], dimensions: [] });

    expect(response.observations[0]?.dimensions?.remotePostId).toBeDefined();

    const partial = await adapter.collect({ source: fixtureSource("WORDPRESS", "partial"), metrics: [], dimensions: [] });
    expect(partial.partial).toBe(true);
  });

  it("custom fixture is deterministic, cursor normalization is stable, and diagnostics redact secrets", async () => {
    const adapter = createCustomFixtureAnalyticsAdapter();
    const source = fixtureSource("CUSTOM", "success");

    const a = await adapter.collect({ source, startCursor: { page: 1 }, metrics: [], dimensions: [] });
    const b = await adapter.collect({ source, startCursor: { page: 1 }, metrics: [], dimensions: [] });
    expect(a.observations).toEqual(b.observations);

    expect(adapter.normalizeCursor({ page: -4 })).toEqual({ page: 1 });

    const redacted = adapter.redactDiagnostic({
      access_token: "A",
      refresh_token: "B",
      api_key: "C",
      password: "D",
      authorization: "E",
      client_secret: "F",
      private_key: "G",
      service_account: "H",
      note: "safe",
    });

    expect(redacted).toContain("[REDACTED]");
    expect(redacted).not.toContain("private_key\":\"G\"");
    expect(redacted).toContain("\"note\":\"safe\"");
  });
});
