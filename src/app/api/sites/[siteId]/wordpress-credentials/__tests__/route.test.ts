jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { PUT } from "@/app/api/sites/[siteId]/wordpress-credentials/route";
import {
  authenticateOperator,
  createScryptPasswordHash,
  OPERATOR_CSRF_COOKIE,
  OPERATOR_CSRF_HEADER,
  OPERATOR_SESSION_COOKIE,
} from "@/modules/foundation/operator-session";
import { createSite, getSiteById, resetSiteRepositoryForTests } from "@/modules/foundation/site-repository";

function createRequest(input: {
  siteId: string;
  cookie: string;
  csrfToken: string;
  organizationId: string;
  username: string;
  applicationPassword: string;
  origin?: string;
}) {
  return new NextRequest(
    `https://genesi-runti-8hl31agbz6rt-743202067.us-west-2.elb.amazonaws.com/api/sites/${encodeURIComponent(input.siteId)}/wordpress-credentials`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: input.cookie,
        origin: input.origin ?? "https://staging.glwplatform.com",
        [OPERATOR_CSRF_HEADER]: input.csrfToken,
        "x-gcp-roles": "ops_manager",
        "x-gcp-organization-id": input.organizationId,
        "x-gcp-site-id": input.siteId,
      },
      body: JSON.stringify({
        username: input.username,
        applicationPassword: input.applicationPassword,
      }),
    },
  );
}

describe("site wordpress credential storage route", () => {
  const originalEnvironment = { ...process.env };
  let persistenceRoot = "";
  const organizationId = "led-display-warehouse";
  const siteId = "site-led-display-warehouse-pageengines-staging";

  beforeEach(async () => {
    persistenceRoot = mkdtempSync(join(tmpdir(), "genesis-site-wp-credentials-"));
    const passwordHash = await createScryptPasswordHash("correct horse battery staple", Buffer.alloc(16, 31));
    process.env = {
      ...originalEnvironment,
      NODE_ENV: "production",
      GENESIS_ENVIRONMENT: "staging",
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
    resetSiteRepositoryForTests();
    createSite({
      organizationId,
      siteName: "PageEngines Staging",
      displayName: "PageEngines",
      slug: "pageengines-staging",
      domain: "staging.pageengines.com",
      canonicalUrl: "https://staging.pageengines.com",
      environment: "staging",
      enabled: false,
      defaultContentType: "article",
      defaultPublicationStatus: "draft",
      defaultAuthorReference: null,
      defaultCategoryReferences: [],
      integrations: {
        wordpressApiBaseUrl: "https://staging.pageengines.com/wp-json/wp/v2",
        wordpressCredentialReference: null,
        workflowReference: null,
      },
      profiles: {
        promptProfileReference: null,
        imageProfileReference: null,
        seoProfileReference: null,
        brandProfileReference: null,
        analyticsProfileReference: null,
      },
      notes: null,
    });
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
    rmSync(persistenceRoot, { recursive: true, force: true });
  });

  test("stores credentials in staging without explicit master key using persisted fallback authority", async () => {
    const session = await authenticateOperator({
      identity: "rk@ssidisplays.com",
      password: "correct horse battery staple",
      environment: process.env,
    });
    const cookie = `${OPERATOR_SESSION_COOKIE}=${session.token}; ${OPERATOR_CSRF_COOKIE}=${session.csrfToken}`;
    const response = await PUT(
      createRequest({
        siteId,
        cookie,
        csrfToken: session.csrfToken,
        organizationId,
        username: "genesis-api",
        applicationPassword: "abcd efgh ijkl mnop",
        origin: "https://genesi-runti-8hl31agbz6rt-743202067.us-west-2.elb.amazonaws.com",
      }),
      { params: Promise.resolve({ siteId }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as { configured?: boolean; managedByGenesis?: boolean };
    expect(payload).toEqual({ configured: true, managedByGenesis: true });
    const updatedSite = getSiteById(siteId);
    expect(updatedSite?.integrations.wordpressCredentialReference).toMatch(/^credref-wp-/);
  });

});
