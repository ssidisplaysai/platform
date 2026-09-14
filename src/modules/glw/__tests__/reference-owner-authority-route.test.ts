jest.mock("server-only", () => ({}));

import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/glw/campaigns/[campaignId]/reference-authority/route";

describe("GLW reference owner authority API authentication", () => {
  let root: string;
  const original = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "glw-ref-owner-route-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; });
  afterEach(() => { if (original === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR; else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = original; rmSync(root, { recursive: true, force: true }); });

  test.each([
    ["unauthenticated", {}],
    ["caller role headers only", { "x-gcp-roles": "platform_admin", "x-gcp-organization-id": "org", "x-gcp-site-id": "site" }],
  ])("fails closed for %s without creating authority state", async (_label, headers) => {
    const request = new NextRequest("http://localhost/api/glw/campaigns/campaign/reference-authority", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "RUN_PREFLIGHT" }),
    });
    const response = await POST(request, { params: Promise.resolve({ campaignId: "campaign" }) });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "TRUSTED_OPERATOR_SESSION_UNAVAILABLE", downstreamSideEffectsPerformed: false });
    expect(readdirSync(root)).toEqual([]);
  });

  test("capability endpoint reports the exact trusted-session prerequisite", async () => {
    const response = await GET(new NextRequest("http://localhost/api/glw/campaigns/campaign/reference-authority", { headers: { "x-gcp-roles": "platform_admin" } }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ authorityPrimitive: "GLW_REFERENCE_GENERATION_OWNER_AUTHORITY_V1", principalAuthority: "UNAVAILABLE", principalSessionBound: false, callerSuppliedRoleHeadersAuthorize: false, available: false });
  });
});