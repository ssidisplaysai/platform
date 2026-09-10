import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { GET as getCapabilities } from "@/app/api/glw/capabilities/route";
import { GET as getHealth } from "@/app/api/glw/health/route";
import { GET as getVersion } from "@/app/api/glw/version/route";

const originalEnv = { ...process.env };

function setReadyRuntimeEnvironment(): void {
  process.env.GLW_APP_URL = "https://app.ssiai.app";
  process.env.GLW_N8N_PAGE_WEBHOOK_URL = "https://n8n.example.test/webhook/glw-page";
  process.env.GLW_N8N_WEBHOOK_SECRET = "callback-secret";
  process.env.DATABASE_URL = "postgresql://example.test/glw";
}

beforeEach(() => { process.env = { ...originalEnv }; });
afterEach(() => { process.env = { ...originalEnv }; });

describe("GLW production observability contracts", () => {
  it("reports integration-backed runtime health and capabilities", async () => {
    setReadyRuntimeEnvironment();

    const healthResponse = await getHealth();
    const health = await healthResponse.json();
    expect(healthResponse.status).toBe(200);
    expect(health.record).toMatchObject({ source: "INTEGRATION", status: { state: "HEALTHY", readiness: "READY", liveness: "LIVE" } });
    expect(health.record.capabilities.availableCapabilities).toEqual(expect.arrayContaining(["catalog", "order-management", "page-generation"]));

    const capabilityResponse = await getCapabilities();
    const capabilityPayload = await capabilityResponse.json();
    expect(capabilityResponse.status).toBe(200);
    expect(capabilityPayload.capabilities.statuses).toEqual(expect.arrayContaining([expect.objectContaining({ capability: "page-generation", availability: "AVAILABLE" })]));
  });

  it("fails page-generation readiness closed when a callback dependency is absent", async () => {
    setReadyRuntimeEnvironment();
    delete process.env.GLW_N8N_WEBHOOK_SECRET;

    const response = await getHealth();
    const payload = await response.json();
    expect(payload.record.status).toMatchObject({ state: "WARNING", readiness: "NOT_READY", liveness: "LIVE" });
    expect(payload.record.capabilities.statuses).toEqual(expect.arrayContaining([expect.objectContaining({ capability: "page-generation", availability: "UNAVAILABLE", reason: "Capability not available in latest evaluation." })]));
  });

  it("exposes the production runtime identity contract", async () => {
    process.env.GIT_COMMIT = "observability-contract-sha";
    const response = await getVersion();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ application: "GLW", git_commit: "observability-contract-sha", qa_contract_version: 16, callback_contract_version: 16, schema_version: "glw-job-schema-v1", planner_version: "genesis-planner-v1", publishing_engine_version: "glw-publishing-engine-v1.0" });
    expect(payload.started_at).toEqual(expect.any(String));
    expect(payload.uptime).toMatch(/^\d{2,}:\d{2}:\d{2}$/);
  });
});