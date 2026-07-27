import { describe, expect, it, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "mocked.session.token" }),
    set: () => undefined,
    delete: () => undefined,
  }),
}), { virtual: true });

import {
  createInMemoryMemoryApiDependencies,
  handleContext,
  handleContextBuild,
  handleContextCache,
  handleContextHealth,
  handleContextProvenance,
  handleContextReplay,
  handleContextValidation,
  handleContextVersions,
  handleGetMemory,
  handleMemory,
} from "@/lib/gea/memory-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const noSessionLoader = async () => null;

describe("gea memory api", () => {
  it("enforces authentication", async () => {
    const deps = createInMemoryMemoryApiDependencies();
    const response = await handleMemory(makeRequest("/api/gea/memory"), {
      ...deps,
      sessionLoader: noSessionLoader,
    });

    expect(response.status).toBe(401);
  });

  it("registers and retrieves memory references", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryMemoryApiDependencies();
    const depSet = { ...deps, sessionLoader: adminSessionLoader };

    const register = await handleMemory(makeRequest("/api/gea/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registryIdentity: "gmp.knowledge.snapshot.alpha",
        referenceType: "EVIDENCE_SNAPSHOT",
        referenceId: "evidence-1",
        referenceVersion: "v1",
        sourceType: "EVIDENCE",
        sourceId: "gmp-evidence",
        sourceVersion: "v2026.07",
        authoritative: true,
        authorityState: "CERTIFIED",
        immutable: true,
      }),
    }), depSet);

    expect(register.status).toBe(201);
    const payload = await register.json() as { reference: { memoryReferenceId: string } };

    const list = await handleMemory(makeRequest("/api/gea/memory"), depSet);
    expect(list.status).toBe(200);

    const detail = await handleGetMemory(makeRequest(`/api/gea/memory/${payload.reference.memoryReferenceId}`), payload.reference.memoryReferenceId, depSet);
    expect(detail.status).toBe(200);
  });

  it("builds deterministic context, reuses cache, and supports replay", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryMemoryApiDependencies();
    const depSet = { ...deps, sessionLoader: adminSessionLoader };

    const register = await handleMemory(makeRequest("/api/gea/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registryIdentity: "gmp.page.brief.alpha",
        referenceType: "DOCUMENT",
        referenceId: "brief-1",
        referenceVersion: "v4",
        sourceType: "DOCUMENT",
        sourceId: "gmp-page",
        sourceVersion: "v4",
        authoritative: true,
        authorityState: "VERIFIED",
        immutable: true,
      }),
    }), depSet);

    const reference = (await register.json() as { reference: { memoryReferenceId: string } }).reference;

    const build1 = await handleContextBuild(makeRequest("/api/gea/context/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        referenceIds: [reference.memoryReferenceId],
      }),
    }), depSet);

    expect(build1.status).toBe(201);
    const built1 = await build1.json() as { fromCache: boolean; contextPackage: { contextPackageId: string }; cache: { hitCount: number } };
    expect(built1.fromCache).toBe(false);

    const build2 = await handleContextBuild(makeRequest("/api/gea/context/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        referenceIds: [reference.memoryReferenceId],
      }),
    }), depSet);

    expect(build2.status).toBe(201);
    const built2 = await build2.json() as { fromCache: boolean; cache: { hitCount: number } };
    expect(built2.fromCache).toBe(true);
    expect(built2.cache.hitCount).toBeGreaterThanOrEqual(1);

    const replay = await handleContextReplay(makeRequest("/api/gea/context/replay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contextPackageId: built1.contextPackage.contextPackageId }),
    }), depSet);

    expect(replay.status).toBe(201);
    const replayBody = await replay.json() as { replay: { deterministicMatch?: boolean } };
    expect(replayBody.replay.deterministicMatch).toBe(true);

    const listContext = await handleContext(makeRequest("/api/gea/context"), depSet);
    const health = await handleContextHealth(makeRequest("/api/gea/context/health"), depSet);
    const versions = await handleContextVersions(makeRequest("/api/gea/context/versions"), depSet);
    const provenance = await handleContextProvenance(makeRequest("/api/gea/context/provenance"), depSet);
    const cache = await handleContextCache(makeRequest("/api/gea/context/cache"), depSet);
    const validations = await handleContextValidation(makeRequest("/api/gea/context/validation"), depSet);

    expect(listContext.status).toBe(200);
    expect(health.status).toBe(200);
    expect(versions.status).toBe(200);
    expect(provenance.status).toBe(200);
    expect(cache.status).toBe(200);
    expect(validations.status).toBe(200);
  });

  it("returns empty list for unmatched catalog query", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const deps = createInMemoryMemoryApiDependencies();
    const depSet = { ...deps, sessionLoader: adminSessionLoader };

    await handleMemory(makeRequest("/api/gea/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registryIdentity: "workspace-a.reference",
        referenceType: "DOCUMENT",
        referenceId: "doc-a",
        referenceVersion: "v1",
        sourceType: "DOCUMENT",
        sourceId: "docs",
        sourceVersion: "v1",
        authoritative: true,
        authorityState: "CERTIFIED",
        immutable: true,
      }),
    }), depSet);

    const listOther = await handleMemory(makeRequest("/api/gea/memory?q=does-not-exist"), depSet);
    expect(listOther.status).toBe(200);
    const payload = await listOther.json() as { references: unknown[] };
    expect(payload.references.length).toBe(0);
  });
});
