jest.mock("server-only", () => ({}));

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/glw/campaign-launch/route";

const release = "4".repeat(40);
const originalEnvironment = {
  nodeEnvironment: process.env.NODE_ENV,
  productionEnabled: process.env.GLW_CAMPAIGN_LAUNCH_PRODUCTION_ENABLED,
  certifiedRelease: process.env.GLW_CAMPAIGN_LAUNCH_CERTIFIED_RELEASE,
  runningRelease: process.env.GIT_COMMIT,
};

function request(headers: Record<string, string> = {}, body: unknown = {}) {
  return new NextRequest("http://localhost/api/glw/campaign-launch", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.NODE_ENV = "production";
  delete process.env.GLW_CAMPAIGN_LAUNCH_PRODUCTION_ENABLED;
  delete process.env.GLW_CAMPAIGN_LAUNCH_CERTIFIED_RELEASE;
  process.env.GIT_COMMIT = release;
});

afterAll(() => {
  if (originalEnvironment.nodeEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnvironment.nodeEnvironment;
  if (originalEnvironment.productionEnabled === undefined) delete process.env.GLW_CAMPAIGN_LAUNCH_PRODUCTION_ENABLED;
  else process.env.GLW_CAMPAIGN_LAUNCH_PRODUCTION_ENABLED = originalEnvironment.productionEnabled;
  if (originalEnvironment.certifiedRelease === undefined) delete process.env.GLW_CAMPAIGN_LAUNCH_CERTIFIED_RELEASE;
  else process.env.GLW_CAMPAIGN_LAUNCH_CERTIFIED_RELEASE = originalEnvironment.certifiedRelease;
  if (originalEnvironment.runningRelease === undefined) delete process.env.GIT_COMMIT;
  else process.env.GIT_COMMIT = originalEnvironment.runningRelease;
});

describe("Campaign launch production promotion boundary", () => {
  test("preserves authentication and organization scope before promotion checks", async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request({ "x-gcp-roles": "administrator" }))).status).toBe(403);
  });

  test("rejects browser-provided promotion values while server promotion is disabled", async () => {
    const response = await POST(request({ "x-gcp-roles": "administrator", "x-gcp-organization-id": "org-1" }, {
      operation: "LAUNCH_CITY_CAMPAIGN",
      productionEnabled: "true",
      certifiedRelease: release,
      runningRelease: release,
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "PRODUCTION_PROMOTION_REQUIRED", promotion: { state: "DISABLED" } });
  });

  test("rejects a different deployed release", async () => {
    process.env.GLW_CAMPAIGN_LAUNCH_PRODUCTION_ENABLED = "true";
    process.env.GLW_CAMPAIGN_LAUNCH_CERTIFIED_RELEASE = "a".repeat(40);
    const response = await POST(request({ "x-gcp-roles": "administrator", "x-gcp-organization-id": "org-1" }, { operation: "LAUNCH_CITY_CAMPAIGN" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ promotion: { state: "RELEASE_MISMATCH" } });
  });

  test("an exact promoted release reaches normal request validation", async () => {
    process.env.GLW_CAMPAIGN_LAUNCH_PRODUCTION_ENABLED = "true";
    process.env.GLW_CAMPAIGN_LAUNCH_CERTIFIED_RELEASE = release;
    const response = await POST(request({ "x-gcp-roles": "administrator", "x-gcp-organization-id": "org-1" }, { operation: "LAUNCH_CITY_CAMPAIGN" }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Configured site and product authority is required." });
  });

  test("reports exact promotion state through the authenticated read-only endpoint", async () => {
    process.env.GLW_CAMPAIGN_LAUNCH_PRODUCTION_ENABLED = "true";
    process.env.GLW_CAMPAIGN_LAUNCH_CERTIFIED_RELEASE = release;
    const response = await GET(new NextRequest("http://localhost/api/glw/campaign-launch", {
      headers: { "x-gcp-roles": "administrator", "x-gcp-organization-id": "org-1" },
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      promotion: { available: true, state: "ENABLED_CERTIFIED_RELEASE", runningRelease: release, certifiedRelease: release },
      mutationPerformed: false,
    });
  });
});
