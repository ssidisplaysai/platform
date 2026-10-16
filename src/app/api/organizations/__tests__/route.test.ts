import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/organizations/route";
import {
  listOrganizations,
  reloadOrganizationRepositoryFromPersistence,
  resetOrganizationRepositoryForTests,
} from "@/modules/foundation/organization-repository";

function request(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

function authHeaders(input: {
  role?: "platform_admin" | "ops_manager" | "company_operator" | "analyst" | "viewer";
  includeMutationContext?: boolean;
}): Record<string, string> {
  const headers: Record<string, string> = {};
  if (input.role) {
    headers["x-gcp-roles"] = input.role;
  }
  if (input.includeMutationContext) {
    headers.origin = "http://localhost";
  }
  return headers;
}

describe("organization API owner onboarding", () => {
  beforeEach(() => {
    resetOrganizationRepositoryForTests();
  });

  test("authorized owner can create an active organization", async () => {
    const response = await POST(request("http://localhost/api/organizations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ role: "platform_admin", includeMutationContext: true }),
      },
      body: JSON.stringify({
        id: "pageengines",
        name: "PageEngines",
        status: "active",
        ownerAuthorization: "OWNER_AUTHORIZED_CREATE_ORGANIZATION",
      }),
    }));

    expect(response.status).toBe(201);

    const payload = await response.json() as { organization?: { id: string; name: string } };
    expect(payload.organization).toMatchObject({
      id: "pageengines",
      name: "PageEngines",
    });
  });

  test("unauthorized role is rejected", async () => {
    const response = await POST(request("http://localhost/api/organizations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ role: "viewer", includeMutationContext: true }),
      },
      body: JSON.stringify({
        id: "pageengines",
        name: "PageEngines",
        status: "active",
        ownerAuthorization: "OWNER_AUTHORIZED_CREATE_ORGANIZATION",
      }),
    }));

    expect(response.status).toBe(403);
  });

  test("duplicate organization ID is rejected", async () => {
    await POST(request("http://localhost/api/organizations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ role: "platform_admin", includeMutationContext: true }),
      },
      body: JSON.stringify({
        id: "pageengines",
        name: "PageEngines",
        status: "active",
        ownerAuthorization: "OWNER_AUTHORIZED_CREATE_ORGANIZATION",
      }),
    }));

    const duplicate = await POST(request("http://localhost/api/organizations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ role: "platform_admin", includeMutationContext: true }),
      },
      body: JSON.stringify({
        id: "pageengines",
        name: "PageEngines Duplicate",
        status: "active",
        ownerAuthorization: "OWNER_AUTHORIZED_CREATE_ORGANIZATION",
      }),
    }));

    expect(duplicate.status).toBe(409);
  });

  test("organization persists across reload and is visible through listing", async () => {
    await POST(request("http://localhost/api/organizations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ role: "platform_admin", includeMutationContext: true }),
      },
      body: JSON.stringify({
        id: "pageengines",
        name: "PageEngines",
        status: "active",
        ownerAuthorization: "OWNER_AUTHORIZED_CREATE_ORGANIZATION",
      }),
    }));

    reloadOrganizationRepositoryFromPersistence();

    const listResponse = await GET(request("http://localhost/api/organizations?status=active", {
      headers: authHeaders({ role: "ops_manager" }),
    }));
    expect(listResponse.status).toBe(200);
    const payload = await listResponse.json() as {
      organizations: Array<{ id: string; name: string }>;
    };
    expect(payload.organizations.some((organization) => organization.id === "pageengines")).toBe(true);
  });

  test("seeded organizations remain intact after creating a new organization", async () => {
    const baselineIds = new Set(listOrganizations().map((organization) => organization.id));
    expect(baselineIds.has("led-display-warehouse")).toBe(true);

    await POST(request("http://localhost/api/organizations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ role: "platform_admin", includeMutationContext: true }),
      },
      body: JSON.stringify({
        id: "pageengines",
        name: "PageEngines",
        status: "active",
        ownerAuthorization: "OWNER_AUTHORIZED_CREATE_ORGANIZATION",
      }),
    }));

    const currentIds = new Set(listOrganizations().map((organization) => organization.id));
    expect(currentIds.has("led-display-warehouse")).toBe(true);
    baselineIds.forEach((id) => expect(currentIds.has(id)).toBe(true));
  });
});
