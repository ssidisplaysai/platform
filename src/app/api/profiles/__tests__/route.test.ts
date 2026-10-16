jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/profiles/route";
import {
  authenticateOperator,
  createScryptPasswordHash,
  OPERATOR_CSRF_COOKIE,
  OPERATOR_CSRF_HEADER,
  OPERATOR_SESSION_COOKIE,
} from "@/modules/foundation/operator-session";
import { createOnboardingProfileId } from "@/modules/foundation/onboarding-profile-creation";
import { getIntegrationProfileById, resetIntegrationProfileRepositoryForTests } from "@/modules/foundation/integration-profile-repository";

const organizationId = "pageengines";
const profileName = "PageEngines Premium Brand";
const profileId = createOnboardingProfileId({
  organizationId,
  profileType: "brand",
  profileName,
});

function profilePayload() {
  return {
    profileId,
    profileType: "brand" as const,
    organizationId,
    profileName,
    description: "Professional brand authority for PageEngines staging onboarding.",
    status: "active" as const,
    enabled: true,
    version: "1.0.0",
    assignedSiteIds: [],
    defaultForOrganization: false,
    references: {
      logoReference: "assetref-pageengines-logo",
      colorPaletteReference: "paletteref-pageengines-default",
      typographyReference: "typographyref-pageengines-default",
      voiceReference: "voiceref-pageengines-professional",
      defaultCtaReference: "ctaref-pageengines-contact",
    },
    notes: null,
  };
}

function makeRequest(input: {
  cookie: string;
  csrfHeader?: string;
  origin: string;
}) {
  return new NextRequest(
    "https://genesi-runti-8hl31agbz6rt-743202067.us-west-2.elb.amazonaws.com/api/profiles",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: input.cookie,
        origin: input.origin,
        ...(input.csrfHeader ? { [OPERATOR_CSRF_HEADER]: input.csrfHeader } : {}),
        "x-gcp-roles": "ops_manager",
        "x-gcp-organization-id": organizationId,
      },
      body: JSON.stringify(profilePayload()),
    },
  );
}

describe("profiles create API mutation authorization", () => {
  const originalEnvironment = { ...process.env };
  let persistenceRoot = "";

  beforeEach(async () => {
    persistenceRoot = mkdtempSync(join(tmpdir(), "genesis-profiles-route-"));
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
    resetIntegrationProfileRepositoryForTests();
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
    rmSync(persistenceRoot, { recursive: true, force: true });
  });

  test("creates profile with valid session, trusted staging origin, and csrf header", async () => {
    const session = await authenticateOperator({
      identity: "rk@ssidisplays.com",
      password: "correct horse battery staple",
      environment: process.env,
    });
    const cookie = `${OPERATOR_SESSION_COOKIE}=${session.token}; ${OPERATOR_CSRF_COOKIE}=${session.csrfToken}`;
    const response = await POST(makeRequest({
      cookie,
      csrfHeader: session.csrfToken,
      origin: "https://staging.glwplatform.com",
    }));

    expect(response.status).toBe(201);
    const payload = await response.json() as { profile?: { profileId: string } };
    expect(payload.profile?.profileId).toBe(profileId);
    expect(getIntegrationProfileById(profileId)).not.toBeNull();
  });

  test("rejects profile creation when csrf header is missing", async () => {
    const session = await authenticateOperator({
      identity: "rk@ssidisplays.com",
      password: "correct horse battery staple",
      environment: process.env,
    });
    const cookie = `${OPERATOR_SESSION_COOKIE}=${session.token}; ${OPERATOR_CSRF_COOKIE}=${session.csrfToken}`;
    const response = await POST(makeRequest({
      cookie,
      origin: "https://staging.glwplatform.com",
    }));

    expect(response.status).toBe(403);
    const payload = await response.json() as { error?: string };
    expect(payload.error).toBe("Forbidden");
  });

  test("rejects profile creation for untrusted origin", async () => {
    const session = await authenticateOperator({
      identity: "rk@ssidisplays.com",
      password: "correct horse battery staple",
      environment: process.env,
    });
    const cookie = `${OPERATOR_SESSION_COOKIE}=${session.token}; ${OPERATOR_CSRF_COOKIE}=${session.csrfToken}`;
    const response = await POST(makeRequest({
      cookie,
      csrfHeader: session.csrfToken,
      origin: "https://evil.example",
    }));

    expect(response.status).toBe(403);
    const payload = await response.json() as { error?: string };
    expect(payload.error).toBe("Forbidden");
  });
});

