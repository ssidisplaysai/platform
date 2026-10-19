jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/sites/[siteId]/intelligence/assets/route";
import {
  authenticateOperator,
  createScryptPasswordHash,
  OPERATOR_CSRF_COOKIE,
  OPERATOR_CSRF_HEADER,
  OPERATOR_SESSION_COOKIE,
} from "@/modules/foundation/operator-session";

const siteId = "site-led-display-warehouse-production";
const organizationId = "led-display-warehouse";
const context = { params: Promise.resolve({ siteId }) };

function jpg(name: string, size = 8): File {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  return new File([bytes], name, { type: "image/jpeg" });
}

function request(input: {
  cookie: string;
  csrfHeader?: string;
  origin: string;
  organizationScope?: string;
}) {
  const form = new FormData();
  form.append("files", jpg("shared-image-84.jpg"));
  form.set("classification", "OWNER_SUPPLIED_REFERENCE");
  form.set("sentiment", "LIKE");
  form.set("notes", "Provided");
  form.set("expectedRevision", "0");

  return new NextRequest(
    `https://genesi-runti-8hl31agbz6rt-743202067.us-west-2.elb.amazonaws.com/api/sites/${encodeURIComponent(siteId)}/intelligence/assets`,
    {
      method: "POST",
      headers: {
        cookie: input.cookie,
        origin: input.origin,
        "x-gcp-roles": "ops_manager",
        "x-gcp-organization-id": input.organizationScope ?? organizationId,
        "x-gcp-site-id": siteId,
        ...(input.csrfHeader ? { [OPERATOR_CSRF_HEADER]: input.csrfHeader } : {}),
      },
      body: form,
    },
  );
}

describe("site intelligence asset upload mutation authorization", () => {
  const originalEnvironment = { ...process.env };
  let persistenceRoot = "";

  beforeEach(async () => {
    persistenceRoot = mkdtempSync(join(tmpdir(), "genesis-site-intel-assets-route-"));
    const passwordHash = await createScryptPasswordHash("correct horse battery staple", Buffer.alloc(16, 37));
    process.env = {
      ...originalEnvironment,
      NODE_ENV: "production",
      GENESIS_ENVIRONMENT: "staging",
      GENESIS_TRUSTED_LOCAL_OPERATOR: "false",
      GCP_FOUNDATION_PERSISTENCE_DIR: persistenceRoot,
      GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR: persistenceRoot,
      GENESIS_OPERATOR_DIRECTORY_JSON: JSON.stringify([{
        principalId: "operator-001",
        email: "rk@ssidisplays.com",
        roles: ["platform_admin"],
        passwordHash,
        enabled: true,
      }]),
    };
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
    rmSync(persistenceRoot, { recursive: true, force: true });
  });

  test("accepts authorized multipart upload with trusted origin and csrf header", async () => {
    const session = await authenticateOperator({
      identity: "rk@ssidisplays.com",
      password: "correct horse battery staple",
      environment: process.env,
    });
    const cookie = `${OPERATOR_SESSION_COOKIE}=${session.token}; ${OPERATOR_CSRF_COOKIE}=${session.csrfToken}`;

    const response = await POST(request({
      cookie,
      csrfHeader: session.csrfToken,
      origin: "https://staging.glwplatform.com",
    }), context);

    expect(response.status).toBe(201);
    const payload = await response.json() as { workspace?: { creativeInputs: unknown[] } };
    expect(payload.workspace?.creativeInputs.length).toBe(1);
  });

  test("rejects multipart upload when csrf header is missing", async () => {
    const session = await authenticateOperator({
      identity: "rk@ssidisplays.com",
      password: "correct horse battery staple",
      environment: process.env,
    });
    const cookie = `${OPERATOR_SESSION_COOKIE}=${session.token}; ${OPERATOR_CSRF_COOKIE}=${session.csrfToken}`;

    const response = await POST(request({
      cookie,
      origin: "https://staging.glwplatform.com",
    }), context);

    expect(response.status).toBe(403);
    const payload = await response.json() as { error?: string };
    expect(payload.error).toBe("Forbidden");
  });

  test("rejects multipart upload with organization scope mismatch", async () => {
    const session = await authenticateOperator({
      identity: "rk@ssidisplays.com",
      password: "correct horse battery staple",
      environment: process.env,
    });
    const cookie = `${OPERATOR_SESSION_COOKIE}=${session.token}; ${OPERATOR_CSRF_COOKIE}=${session.csrfToken}`;

    const response = await POST(request({
      cookie,
      csrfHeader: session.csrfToken,
      origin: "https://staging.glwplatform.com",
      organizationScope: "ssi",
    }), context);

    expect(response.status).toBe(404);
    const payload = await response.json() as { error?: string };
    expect(payload.error).toBe("Site not found");
  });
});
