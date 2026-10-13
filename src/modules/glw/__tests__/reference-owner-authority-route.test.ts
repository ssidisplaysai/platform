jest.mock("server-only", () => ({}));

import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/glw/campaigns/[campaignId]/reference-authority/route";
import { authenticateOperator, createScryptPasswordHash, OPERATOR_SESSION_COOKIE } from "@/modules/foundation/operator-session";

describe("GLW reference owner authority API authentication", () => {
  let root: string;
  const original = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  const originalDirectory = process.env.GENESIS_OPERATOR_DIRECTORY_JSON;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "glw-ref-owner-route-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; });
  afterEach(() => { if (original === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR; else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = original; if (originalDirectory === undefined) delete process.env.GENESIS_OPERATOR_DIRECTORY_JSON; else process.env.GENESIS_OPERATOR_DIRECTORY_JSON = originalDirectory; rmSync(root, { recursive: true, force: true }); });

  test("fails closed without a session and does not create authority state", async () => {
    const request = new NextRequest("http://localhost/api/glw/campaigns/campaign/reference-authority", {
      method: "POST",
      body: JSON.stringify({ action: "RUN_PREFLIGHT" }),
    });
    const response = await POST(request, { params: Promise.resolve({ campaignId: "campaign" }) });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "TRUSTED_OPERATOR_SESSION_UNAVAILABLE", downstreamSideEffectsPerformed: false });
    expect(readdirSync(root)).toEqual([]);
  });

  test("capability endpoint reports the exact trusted-session prerequisite", async () => {
    const response = await GET(new NextRequest("http://localhost/api/glw/campaigns/campaign/reference-authority"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ authorityPrimitive: "GLW_REFERENCE_GENERATION_OWNER_AUTHORITY_V1", principalAuthority: "UNAVAILABLE", principalSessionBound: false, callerSuppliedRoleHeadersAuthorize: false, available: false });
  });

  test("server-issued session reaches capability without issuing a receipt or grant", async () => {
    const password = "correct horse battery staple";
    process.env.GENESIS_OPERATOR_DIRECTORY_JSON = JSON.stringify([{
      principalId: "operator-001",
      email: "operator@example.com",
      roles: ["platform_admin"],
      passwordHash: await createScryptPasswordHash(password, Buffer.alloc(16, 17)),
    }]);
    const session = await authenticateOperator({ identity: "operator-001", password });
    const response = await GET(new NextRequest("http://localhost/api/glw/campaigns/campaign/reference-authority", {
      headers: { cookie: `${OPERATOR_SESSION_COOKIE}=${session.token}` },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      principalAuthority: "GENESIS_SERVER_SESSION_V1",
      principalSessionBound: true,
      callerSuppliedRoleHeadersAuthorize: false,
      available: true,
    });
    expect(readdirSync(root)).toEqual(["genesis-server-verified-operator-session-v1.json"]);
  });
});