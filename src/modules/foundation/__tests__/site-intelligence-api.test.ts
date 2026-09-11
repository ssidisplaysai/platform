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

  test("explicit START fails closed without a configured dedicated provider", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const response = await route.POST(request("POST", "led-display-warehouse", { action: "START", expectedRevision: 0, publicBrandIdentity: "Test Brand", providerReference: "provider-test" }), context);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("SITE_INTELLIGENCE_PROVIDER_NOT_CONFIGURED");
    expect(fs.existsSync(path.join(dir, "site-intelligence-repository.json"))).toBe(false);
  });

  test("workspace organization mismatch cannot access another site", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const response = await route.GET(request("GET", "rj-metal"), context);
    expect(response.status).toBe(404);
  });

  test("adds multiple URL references and updates one independently", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const first = await route.POST(request("POST", "led-display-warehouse", { action: "ADD_URL_REFERENCE", expectedRevision: 0, reference: "https://example.com/one/", classification: "COMPETITOR_REFERENCE_ONLY", sentiment: "LIKE", notes: "One" }), context);
    const firstBody = await first.json();
    const second = await route.POST(request("POST", "led-display-warehouse", { action: "ADD_URL_REFERENCE", expectedRevision: firstBody.workspace.revision, reference: "https://example.com/two", classification: "EXTERNAL_INSPIRATION_ONLY", sentiment: "DISLIKE", notes: "Two" }), context);
    const secondBody = await second.json();
    expect(secondBody.workspace.creativeInputs).toHaveLength(2);
    const updated = await route.POST(request("POST", "led-display-warehouse", { action: "UPDATE_CREATIVE_INPUT", expectedRevision: secondBody.workspace.revision, inputId: secondBody.workspace.creativeInputs[0].inputId, sentiment: "REFERENCE_ONLY", notes: "Updated" }), context);
    const updatedBody = await updated.json();
    expect(updatedBody.workspace.creativeInputs).toHaveLength(2);
    expect(updatedBody.workspace.creativeInputs[0]).toMatchObject({ sentiment: "REFERENCE_ONLY", notes: "Updated" });
    expect(updatedBody.workspace.creativeInputs[1]).toMatchObject({ sentiment: "DISLIKE", notes: "Two" });
  });

  test("returns deterministic duplicate URL error", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/route");
    const first = await route.POST(request("POST", "led-display-warehouse", { action: "ADD_URL_REFERENCE", expectedRevision: 0, reference: "https://example.com/path/#one", classification: "OWNER_SUPPLIED_REFERENCE", sentiment: "REFERENCE_ONLY" }), context);
    const firstBody = await first.json();
    const duplicate = await route.POST(request("POST", "led-display-warehouse", { action: "ADD_URL_REFERENCE", expectedRevision: firstBody.workspace.revision, reference: "https://EXAMPLE.com/path/", classification: "OWNER_SUPPLIED_REFERENCE", sentiment: "REFERENCE_ONLY" }), context);
    expect(duplicate.status).toBe(422);
    expect((await duplicate.json()).error).toMatch(/^REFERENCE_ALREADY_EXISTS:/);
  });
});