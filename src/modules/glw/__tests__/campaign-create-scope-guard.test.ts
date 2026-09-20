import { NextRequest } from "next/server";
import { POST } from "@/app/api/glw/campaigns/route";

const BASE_URL = "http://localhost/api/glw/campaigns";

function createRequest(input: {
  body: Record<string, unknown>;
  organizationId?: string;
  siteId?: string;
  includeOrigin?: boolean;
}): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-gcp-roles": "platform_admin",
  };

  if (input.organizationId) {
    headers["x-gcp-organization-id"] = input.organizationId;
  }
  if (input.siteId) {
    headers["x-gcp-site-id"] = input.siteId;
  }
  if (input.includeOrigin !== false) {
    headers.origin = "http://localhost";
  }

  return new NextRequest(BASE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(input.body),
  });
}

describe("GLW campaign create scope guard diagnostics", () => {
  beforeEach(() => {
    process.env.GENESIS_TRUSTED_LOCAL_OPERATOR = "true";
  });

  test("returns AUTH_SCOPE_MISSING_ORG when organization scope is absent", async () => {
    const request = createRequest({
      body: {
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        name: "Test campaign",
        pageType: "state_service",
        stateCodes: ["DE", "MI"],
        pagesPerDay: 10,
        publicationPolicy: "draft_only",
        imageRequired: true,
      },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      error: "Forbidden",
      code: "AUTH_SCOPE_MISSING_ORG",
    });
  });

  test("returns AUTH_SCOPE_ORG_MISMATCH when body organization differs from resolved scope", async () => {
    const request = createRequest({
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      body: {
        organizationId: "ssi",
        siteId: "site-led-display-warehouse-production",
        productId: "prod-outdoor-digital-sphere",
        name: "Test campaign",
        pageType: "state_service",
        stateCodes: ["DE", "MI"],
        pagesPerDay: 10,
        publicationPolicy: "draft_only",
        imageRequired: true,
      },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      error: "Forbidden",
      code: "AUTH_SCOPE_ORG_MISMATCH",
    });
  });

  test("returns AUTH_SCOPE_SITE_MISMATCH when body site differs from resolved scope", async () => {
    const request = createRequest({
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      body: {
        organizationId: "led-display-warehouse",
        siteId: "site-secondary-test",
        productId: "prod-outdoor-digital-sphere",
        name: "Test campaign",
        pageType: "state_service",
        stateCodes: ["DE", "MI"],
        pagesPerDay: 10,
        publicationPolicy: "draft_only",
        imageRequired: true,
      },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      error: "Forbidden",
      code: "AUTH_SCOPE_SITE_MISMATCH",
    });
  });

});
