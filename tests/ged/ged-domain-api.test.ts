import { describe, expect, it, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "mocked.session.token" }),
    set: () => undefined,
    delete: () => undefined,
  }),
}), { virtual: true });
import { createInMemoryEnterpriseDomainApiDependencies, handleEnterpriseAudit, handleEnterpriseEntities, handleEnterpriseEntity, handleEnterpriseHealth, handleEnterpriseRelationships, handleEnterpriseValidation, handleEnterpriseVersions } from "@/lib/ged/enterprise-domain-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const viewerSessionLoader = async () => ({ email: "viewer@example.com", expiresAt: Date.now() + 100000 });
const noSessionLoader = async () => null;

describe("ged domain api", () => {
  it("enforces authentication", async () => {
    const response = await handleEnterpriseEntities(makeRequest("/api/ged/entities"), { ...createInMemoryEnterpriseDomainApiDependencies(), sessionLoader: noSessionLoader });
    expect(response.status).toBe(401);
  });

  it("serves canonical metadata to authorized viewers", async () => {
    const deps = createInMemoryEnterpriseDomainApiDependencies();
    const response = await handleEnterpriseEntities(makeRequest("/api/ged/entities?workspaceId=glw-led-display-warehouse"), { ...deps, sessionLoader: viewerSessionLoader });

    expect(response.status).toBe(200);
  });

  it("returns an individual entity record", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryEnterpriseDomainApiDependencies();
    const response = await handleEnterpriseEntity(makeRequest("/api/ged/entities/organization?entityKey=organization"), { ...deps, sessionLoader: adminSessionLoader });

    expect(response.status).toBe(200);
  });

  it("returns relationship, version, validation, health, and audit surfaces", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryEnterpriseDomainApiDependencies();

    const relationships = await handleEnterpriseRelationships(makeRequest("/api/ged/relationships?entityKey=project"), { ...deps, sessionLoader: adminSessionLoader });
    const versions = await handleEnterpriseVersions(makeRequest("/api/ged/versions?entityKey=project"), { ...deps, sessionLoader: adminSessionLoader });
    const validation = await handleEnterpriseValidation(makeRequest("/api/ged/validation"), { ...deps, sessionLoader: adminSessionLoader });
    const health = await handleEnterpriseHealth(makeRequest("/api/ged/health"), { ...deps, sessionLoader: adminSessionLoader });
    const audit = await handleEnterpriseAudit(makeRequest("/api/ged/audit?entityKey=project"), { ...deps, sessionLoader: adminSessionLoader });

    expect(relationships.status).toBe(200);
    expect(versions.status).toBe(200);
    expect(validation.status).toBe(200);
    expect(health.status).toBe(200);
    expect(audit.status).toBe(200);
  });

  it("denies validation to viewers", async () => {
    const deps = createInMemoryEnterpriseDomainApiDependencies();
    const response = await handleEnterpriseValidation(makeRequest("/api/ged/validation"), { ...deps, sessionLoader: viewerSessionLoader });
    expect(response.status).toBe(403);
  });
});
