import { NextRequest } from "next/server";
import { GET as getSites } from "@/app/api/sites/route";
import { GET as getSiteById, PATCH as patchSite } from "@/app/api/sites/[siteId]/route";
import { createSite, resetSiteRepositoryForTests } from "@/modules/foundation/site-repository";

function request(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

function authHeaders(input: {
  role?: "platform_admin" | "ops_manager" | "company_operator" | "analyst" | "viewer";
  organizationId?: string;
  siteId?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {};

  if (input.role) {
    headers["x-gcp-roles"] = input.role;
  }
  if (input.organizationId) {
    headers["x-gcp-organization-id"] = input.organizationId;
  }
  if (input.siteId) {
    headers["x-gcp-site-id"] = input.siteId;
  }

  return headers;
}

describe("GCP-0002C site API authorization conformance", () => {
  beforeEach(() => {
    resetSiteRepositoryForTests();
  });

  test("site collection read requires authentication and capability", async () => {
    const noAuth = await getSites(request("http://localhost/api/sites"));
    expect(noAuth.status).toBe(401);

    const viewer = await getSites(request("http://localhost/api/sites", {
      headers: authHeaders({ role: "viewer", organizationId: "led-display-warehouse" }),
    }));
    expect(viewer.status).toBe(403);

    const operator = await getSites(request("http://localhost/api/sites", {
      headers: authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse" }),
    }));
    expect(operator.status).toBe(200);
  });

  test("platform admin can list all authorized organizations and optional organization filter", async () => {
    createSite({
      organizationId: "ssi",
      siteName: "SSI Staging",
      displayName: "SSI Staging",
      slug: "ssi-staging",
      domain: "staging.ssidisplays.com",
      primaryAddress: {
        addressLine1: "100 Main St",
        addressLine2: null,
        city: "Dallas",
        stateRegion: "TX",
        postalCode: "75001",
        countryCode: "US",
      },
      canonicalUrl: "https://staging.ssidisplays.com",
      environment: "staging",
      enabled: false,
      publicationPolicy: "draft_only",
      defaultContentType: "article",
      defaultPublicationStatus: "draft",
      defaultAuthorReference: null,
      defaultCategoryReferences: [],
      integrations: {
        wordpressApiBaseUrl: "https://staging.ssidisplays.com/wp-json/wp/v2",
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
      notes: "staging test site",
    });

    const allOrganizations = await getSites(request("http://localhost/api/sites", {
      headers: authHeaders({ role: "platform_admin" }),
    }));
    expect(allOrganizations.status).toBe(200);
    const allPayload = await allOrganizations.json() as { sites: Array<{ organizationId: string }> };
    expect(allPayload.sites.some((site) => site.organizationId === "ssi")).toBe(true);
    expect(allPayload.sites.some((site) => site.organizationId === "led-display-warehouse")).toBe(true);

    const filtered = await getSites(request("http://localhost/api/sites?organizationId=ssi", {
      headers: authHeaders({ role: "platform_admin" }),
    }));
    expect(filtered.status).toBe(200);
    const filteredPayload = await filtered.json() as { sites: Array<{ organizationId: string }> };
    expect(filteredPayload.sites.length).toBeGreaterThan(0);
    expect(filteredPayload.sites.every((site) => site.organizationId === "ssi")).toBe(true);
  });

  test("site detail read cannot bypass collection scope", async () => {
    const scopedAllowed = await getSiteById(request("http://localhost/api/sites/site-led-display-warehouse-production", {
      headers: authHeaders({
        role: "ops_manager",
        organizationId: "led-display-warehouse",
        siteId: "site-led-display-warehouse-production",
      }),
    }), {
      params: Promise.resolve({ siteId: "site-led-display-warehouse-production" }),
    });

    expect(scopedAllowed.status).toBe(200);

    const scopedDenied = await getSiteById(request("http://localhost/api/sites/site-led-display-warehouse-production", {
      headers: authHeaders({
        role: "ops_manager",
        organizationId: "led-display-warehouse",
        siteId: "site-secondary-test-placeholder",
      }),
    }), {
      params: Promise.resolve({ siteId: "site-led-display-warehouse-production" }),
    });

    expect(scopedDenied.status).toBe(404);
  });

  test("site writes remain permission controlled", async () => {
    const denied = await patchSite(request("http://localhost/api/sites/site-led-display-warehouse-production", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ role: "viewer", organizationId: "led-display-warehouse" }),
      },
      body: JSON.stringify({ notes: "blocked" }),
    }), {
      params: Promise.resolve({ siteId: "site-led-display-warehouse-production" }),
    });

    expect(denied.status).toBe(403);
  });
});
