jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/sites/onboarding-preflight/route";
import {
  authenticateOperator,
  createScryptPasswordHash,
  OPERATOR_CSRF_COOKIE,
  OPERATOR_CSRF_HEADER,
  OPERATOR_SESSION_COOKIE,
} from "@/modules/foundation/operator-session";
import { runPublicWordPressPreflight } from "@/modules/foundation/wordpress-public-preflight";

jest.mock("@/modules/foundation/wordpress-public-preflight", () => ({
  runPublicWordPressPreflight: jest.fn(async () => ({
    ready: true,
    domain: "staging.pageengines.com",
    canonicalUrl: "https://staging.pageengines.com",
    apiBaseUrl: "https://staging.pageengines.com/wp-json/wp/v2",
    intent: "existing",
  })),
}));

function request(headers: Record<string, string>, body: Record<string, unknown>) {
  return new NextRequest(
    "https://genesi-runti-8hl31agbz6rt-743202067.us-west-2.elb.amazonaws.com/api/sites/onboarding-preflight",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    },
  );
}

describe("site onboarding preflight authorization", () => {
  const originalEnvironment = { ...process.env };
  let persistenceRoot = "";

  beforeEach(async () => {
    persistenceRoot = mkdtempSync(join(tmpdir(), "genesis-onboarding-preflight-"));
    const passwordHash = await createScryptPasswordHash("correct horse battery staple", Buffer.alloc(16, 29));
    process.env = {
      ...originalEnvironment,
      NODE_ENV: "production",
      GENESIS_ENVIRONMENT: "staging",
      GENESIS_TRUSTED_LOCAL_OPERATOR: "false",
      GCP_FOUNDATION_PERSISTENCE_DIR: persistenceRoot,
      GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR: persistenceRoot,
      GENESIS_OPERATOR_DIRECTORY_JSON: JSON.stringify([
        {
          principalId: "operator-001",
          email: "rk@ssidisplays.com",
          roles: ["platform_admin"],
          passwordHash,
          enabled: true,
        },
      ]),
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
    rmSync(persistenceRoot, { recursive: true, force: true });
  });

  test("accepts staging public origin with session + CSRF for preflight POST", async () => {
    const session = await authenticateOperator({
      identity: "rk@ssidisplays.com",
      password: "correct horse battery staple",
      environment: process.env,
    });
    const cookie = `${OPERATOR_SESSION_COOKIE}=${session.token}; ${OPERATOR_CSRF_COOKIE}=${session.csrfToken}`;
    const response = await POST(request({
      cookie,
      origin: "https://staging.glwplatform.com",
      [OPERATOR_CSRF_HEADER]: session.csrfToken,
      "x-gcp-organization-id": "pageengines",
      "x-gcp-roles": "ops_manager",
    }, {
      domain: "staging.pageengines.com",
      apiBaseUrl: "https://staging.pageengines.com/wp-json/wp/v2",
      intent: "existing",
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as { result?: { ready: boolean } };
    expect(payload.result?.ready).toBe(true);
    expect(runPublicWordPressPreflight).toHaveBeenCalledTimes(1);
  });

  test("rejects preflight POST when CSRF mutation header is missing", async () => {
    const session = await authenticateOperator({
      identity: "rk@ssidisplays.com",
      password: "correct horse battery staple",
      environment: process.env,
    });
    const cookie = `${OPERATOR_SESSION_COOKIE}=${session.token}; ${OPERATOR_CSRF_COOKIE}=${session.csrfToken}`;
    const response = await POST(request({
      cookie,
      origin: "https://staging.glwplatform.com",
      "x-gcp-organization-id": "pageengines",
      "x-gcp-roles": "ops_manager",
    }, {
      domain: "staging.pageengines.com",
      intent: "existing",
    }));

    expect(response.status).toBe(403);
    const payload = await response.json() as { error?: string };
    expect(payload.error).toBe("Forbidden");
    expect(runPublicWordPressPreflight).not.toHaveBeenCalled();
  });
});

