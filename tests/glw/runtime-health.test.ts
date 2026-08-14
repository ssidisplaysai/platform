import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { GET as getGlwHealth } from "@/app/api/glw/health/route";
import { GET as getGlwCapabilities } from "@/app/api/glw/capabilities/route";
import { resetEnterpriseHealthServiceForTests } from "@/platform/ehc";

const originalEnv = { ...process.env };

function setBaseRuntimeEnv() {
  process.env.GLW_APP_URL = "https://app.ssiai.app";
  process.env.GLW_N8N_PAGE_WEBHOOK_URL = "https://n8n.example.test/webhook/glw-page";
  process.env.GLW_N8N_WEBHOOK_SECRET = "callback-secret";
  process.env.DATABASE_URL = "postgresql://example.test/glw";
}

beforeEach(() => {
  process.env = { ...originalEnv };
  resetEnterpriseHealthServiceForTests();
});

afterEach(() => {
  process.env = { ...originalEnv };
  resetEnterpriseHealthServiceForTests();
});

describe("GLW runtime health truthfulness", () => {
  it("evaluates live GLW health and capabilities from integration-backed runtime checks", async () => {
    setBaseRuntimeEnv();

    const healthResponse = await getGlwHealth();
    expect(healthResponse.status).toBe(200);

    const healthPayload = await healthResponse.json() as {
      record: {
        source: string;
        status: { state: string; readiness: string; liveness: string };
        capabilities: {
          availableCapabilities: string[];
          statuses: Array<{ capability: string; availability: string }>;
        };
      };
    };

    expect(healthPayload.record.source).toBe("INTEGRATION");
    expect(healthPayload.record.status).toMatchObject({
      state: "HEALTHY",
      readiness: "READY",
      liveness: "LIVE",
    });
    expect(healthPayload.record.capabilities.availableCapabilities).toEqual(
      expect.arrayContaining(["catalog", "order-management", "page-generation"]),
    );
    expect(healthPayload.record.capabilities.statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capability: "page-generation", availability: "AVAILABLE" }),
      ]),
    );

    const capabilityResponse = await getGlwCapabilities();
    expect(capabilityResponse.status).toBe(200);

    const capabilityPayload = await capabilityResponse.json() as {
      capabilities: {
        statuses: Array<{ capability: string; availability: string }>;
      };
    };

    expect(capabilityPayload.capabilities.statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capability: "page-generation", availability: "AVAILABLE" }),
      ]),
    );
  });

  it("marks page-generation unavailable when callback-path runtime dependencies are incomplete", async () => {
    setBaseRuntimeEnv();
    delete process.env.GLW_N8N_WEBHOOK_SECRET;

    const healthResponse = await getGlwHealth();
    expect(healthResponse.status).toBe(200);

    const payload = await healthResponse.json() as {
      record: {
        source: string;
        status: { state: string; readiness: string; liveness: string };
        capabilities: {
          unavailableCapabilities: string[];
          statuses: Array<{ capability: string; availability: string; reason?: string }>;
        };
      };
    };

    expect(payload.record.source).toBe("INTEGRATION");
    expect(payload.record.status.readiness).toBe("NOT_READY");
    expect(payload.record.status.liveness).toBe("LIVE");
    expect(payload.record.status.state).toBe("WARNING");
    expect(payload.record.capabilities.unavailableCapabilities).toContain("page-generation");
    expect(payload.record.capabilities.statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: "page-generation",
          availability: "UNAVAILABLE",
          reason: "Capability not available in latest evaluation.",
        }),
      ]),
    );
  });
});