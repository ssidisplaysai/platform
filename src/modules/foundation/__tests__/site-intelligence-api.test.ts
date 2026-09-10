import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

describe("site intelligence API boundary", () => {
  const oldDir = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let dir: string;

  beforeEach(() => {
    jest.resetModules();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "site-intelligence-api-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = dir;
  });

  afterEach(() => {
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = oldDir;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function request(method = "GET", organizationId = "led-display-warehouse", body?: unknown) {
    return new NextRequest("http://localhost/api/sites/site-led-display-warehouse-production/intelligence", {
      method,
      headers: {
        "content-type": "application/json",
        "x-gcp-roles": "ops_manager",
        "x-gcp-organization-id": organizationId,
        "x-gcp-site-id": "site-led-display-warehouse-production",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  const context = { params: Promise.resolve({ siteId: "site-led-display-warehouse-production" }) };

  test("GET exposes the start boundary without creating persistence", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const response = await route.GET(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ workspace: null, startBoundary: "START_SITE_INTELLIGENCE" });
    expect(fs.existsSync(path.join(dir, "site-intelligence-repository.json"))).toBe(false);
  });

  test("explicit START creates only the intelligence workspace", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const response = await route.POST(request("POST", "led-display-warehouse", { action: "START", expectedRevision: 0, publicBrandIdentity: "Test Brand", providerReference: "provider-test" }), context);
    expect(response.status).toBe(200);
    expect((await response.json()).workspace).toMatchObject({ intelligenceState: "INTELLIGENCE_RESEARCHING", publicBrandIdentity: "Test Brand" });
    expect(fs.readdirSync(dir)).toEqual(["site-intelligence-repository.json"]);
  });

  test("workspace organization mismatch cannot access another site", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const response = await route.GET(request("GET", "rj-metal"), context);
    expect(response.status).toBe(404);
  });
});