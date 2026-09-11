import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

const siteId = "site-led-display-warehouse-production";
const organizationId = "led-display-warehouse";
const context = { params: Promise.resolve({ siteId }) };

function png(index: number, size = 8) {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, index & 0xff]);
  return new File([bytes], `reference-${index}.png`, { type: "image/png" });
}

function request(files: File[], expectedRevision = 0) {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  form.set("classification", "OWNER_SUPPLIED_REFERENCE");
  form.set("sentiment", "REFERENCE_ONLY");
  form.set("notes", "Batch reference notes");
  form.set("expectedRevision", String(expectedRevision));
  return new NextRequest(`http://localhost/api/sites/${siteId}/intelligence/assets`, {
    method: "POST",
    headers: { "x-gcp-roles": "ops_manager", "x-gcp-organization-id": organizationId, "x-gcp-site-id": siteId },
    body: form,
  });
}

describe("Site Intelligence multi-file reference upload", () => {
  const old = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let directory: string;
  beforeEach(() => { jest.resetModules(); directory = fs.mkdtempSync(path.join(os.tmpdir(), "site-reference-upload-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = directory; });
  afterEach(() => { process.env.GCP_FOUNDATION_PERSISTENCE_DIR = old; fs.rmSync(directory, { recursive: true, force: true }); });

  test("accepts ten files and retains them when a later batch is added", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/assets/route");
    const first = await route.POST(request(Array.from({ length: 10 }, (_, index) => png(index + 1))), context);
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    expect(firstBody.assets).toHaveLength(10);
    expect(firstBody.workspace.creativeInputs).toHaveLength(10);
    const second = await route.POST(request([png(99)], firstBody.workspace.revision), context);
    expect(second.status).toBe(201);
    const secondBody = await second.json();
    expect(secondBody.workspace.creativeInputs).toHaveLength(11);
    expect(secondBody.workspace.creativeInputs.every((input: { sentiment: string }) => input.sentiment === "REFERENCE_ONLY")).toBe(true);
  });

  test("rejects more than ten files before creating a workspace", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/assets/route");
    const response = await route.POST(request(Array.from({ length: 11 }, (_, index) => png(index))), context);
    expect(response.status).toBe(400);
    expect(fs.existsSync(path.join(directory, "site-intelligence-repository.json"))).toBe(false);
  });

  test("rejects an oversized individual file and oversized batch", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/assets/route");
    const oversized = await route.POST(request([png(1, 25 * 1024 * 1024 + 1)]), context);
    expect(oversized.status).toBe(422);
    const batch = await route.POST(request([png(2, 17 * 1024 * 1024), png(3, 17 * 1024 * 1024), png(4, 17 * 1024 * 1024)]), context);
    expect(batch.status).toBe(413);
  });

  test("rejects duplicate binary authority records without partial input persistence", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/assets/route");
    const duplicate = png(7);
    const response = await route.POST(request([duplicate, png(7)]), context);
    expect(response.status).toBe(422);
    const repository = await import("../site-intelligence-repository");
    expect(repository.getSiteIntelligenceWorkspace(siteId)?.creativeInputs).toEqual([]);
  });

  test("does not create product, campaign, or WordPress persistence", async () => {
    const route = await import("@/app/api/sites/[siteId]/intelligence/assets/route");
    expect((await route.POST(request([png(1)]), context)).status).toBe(201);
    for (const name of ["product-repository.json", "glw-campaign-repository.json", "glw-page-execution-repository.json", "wordpress-credential-store.json"]) expect(fs.existsSync(path.join(directory, name))).toBe(false);
  });
});