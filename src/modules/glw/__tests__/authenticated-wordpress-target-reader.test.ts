import {
  createAuthenticatedWordPressTargetReader,
  type AuthenticatedWordPressTargetReader,
} from "../authenticated-wordpress-target-reader";
import { resolveGlwTargetPreflight, type GlwCanonicalTargetIdentity } from "../target-preflight";
import { createLiveCertificationTargetAuthorization } from "@/modules/foundation/live-certification-target-authorization";

const identity: GlwCanonicalTargetIdentity = {
  applicationPath: "indoor-led-video-wall/texas/austin-002d3-cert-20260828",
  canonicalPath: "direct-view-led-video-walls/texas/austin-002d3-cert-20260828",
  canonicalProduct: "LED Video Walls",
  canonicalProductSlug: "direct-view-led-video-walls",
  canonicalSlug: "austin-002d3-cert-20260828",
  canonicalParentId: "2563",
};

const configuration = {
  apiBaseUrl: "https://example.test/wp-json/wp/v2",
  username: "read-user",
  applicationPassword: "sensitive-application-password",
  timeoutMs: 1_000,
};

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

function reader(body: unknown, status = 200): AuthenticatedWordPressTargetReader {
  return createAuthenticatedWordPressTargetReader({
    configuration,
    fetcher: async () => response(status, body),
  });
}

describe("002D.2A authenticated WordPress target reader", () => {
  test("1. public zero remains UNKNOWN", () => {
    expect(resolveGlwTargetPreflight({
      identity,
      wordpressPages: [],
      siteId: "site-led-display-warehouse-production",
      productId: "prod-indoor-led-video-wall",
      stateName: "Texas",
      cityName: "Austin",
    }).state).toBe("UNKNOWN");
  });

  test("2. authenticated exact zero becomes ABSENT", async () => {
    expect(await reader([]).readExactTargetBySlugParent({ identity })).toMatchObject({
      preflight: { state: "ABSENT", confidence: "AUTHORITATIVE" },
      reason: "EXACT_ZERO_RESULTS",
      exactResultCount: 0,
    });
  });

  test("3. authenticated draft becomes EXISTS_DRAFT with exact ID", async () => {
    expect(await reader([{ id: 19613, slug: identity.canonicalSlug, parent: 2563, status: "draft" }]).readExactTargetBySlugParent({ identity })).toMatchObject({
      preflight: { state: "EXISTS_DRAFT", wordpressObjectId: "19613" },
      reason: "EXACT_DRAFT_FOUND",
    });
  });

  test("4. authenticated publish becomes EXISTS_PUBLISHED with exact ID", async () => {
    expect(await reader([{ id: 18846, slug: identity.canonicalSlug, parent: 2563, status: "publish" }]).readExactTargetBySlugParent({ identity })).toMatchObject({
      preflight: { state: "EXISTS_PUBLISHED", wordpressObjectId: "18846" },
      reason: "EXACT_PUBLISHED_FOUND",
    });
  });

  test.each([401, 403])("5. auth response %i remains UNKNOWN", async (status) => {
    expect(await reader({ code: "forbidden" }, status).readExactTargetBySlugParent({ identity })).toMatchObject({
      preflight: { state: "UNKNOWN" },
      reason: "AUTH_FAILURE",
      exactResultCount: null,
    });
  });

  test("7. timeout remains UNKNOWN", async () => {
    const authenticated = createAuthenticatedWordPressTargetReader({
      configuration,
      fetcher: async (_url, init) => new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    });
    expect(await authenticated.readExactTargetBySlugParent({ identity })).toMatchObject({ preflight: { state: "UNKNOWN" }, reason: "READ_TIMEOUT" });
  });

  test("8. network failure remains UNKNOWN", async () => {
    const authenticated = createAuthenticatedWordPressTargetReader({ configuration, fetcher: async () => { throw new Error("password=sensitive"); } });
    expect(await authenticated.readExactTargetBySlugParent({ identity })).toMatchObject({ preflight: { state: "UNKNOWN" }, reason: "NETWORK_ERROR" });
  });

  test("9. malformed response remains UNKNOWN", async () => {
    expect(await reader({ not: "an array" }).readExactTargetBySlugParent({ identity })).toMatchObject({ preflight: { state: "UNKNOWN" }, reason: "MALFORMED_RESPONSE" });
  });

  test("10. multiple exact matches are BLOCKED", async () => {
    const pages = [1, 2].map((id) => ({ id, slug: identity.canonicalSlug, parent: 2563, status: "draft" }));
    expect(await reader(pages).readExactTargetBySlugParent({ identity })).toMatchObject({
      preflight: { state: "BLOCKED" },
      reason: "MULTIPLE_EXACT_WORDPRESS_OBJECTS",
      exactResultCount: 2,
    });
  });

  test("11. wrong parent, wrong slug, and fuzzy title are never adopted", async () => {
    const pages = [
      { id: 1, slug: identity.canonicalSlug, parent: 9999, status: "draft" },
      { id: 2, slug: "similar-certification", parent: 2563, status: "draft", title: { rendered: identity.canonicalSlug } },
    ];
    expect(await reader(pages).readExactTargetBySlugParent({ identity })).toMatchObject({ preflight: { state: "ABSENT" }, exactResultCount: 0 });
  });

  test("12. exact ID read preserves shared identity and retains the ID", async () => {
    expect(await reader({ id: 19613, slug: identity.canonicalSlug, parent: 2563, status: "draft", author: 3 }).readExactPageById({ identity, wordpressObjectId: "19613" })).toMatchObject({
      preflight: { ...identity, state: "EXISTS_DRAFT", wordpressObjectId: "19613" },
      pageMetadata: { authorId: "3" },
    });
  });

  test("13. exact ID read rejects identity mismatch", async () => {
    expect(await reader({ id: 19613, slug: "wrong", parent: 2563, status: "draft" }).readExactPageById({ identity, wordpressObjectId: "19613" })).toMatchObject({ preflight: { state: "UNKNOWN" }, reason: "IDENTITY_MISMATCH" });
  });

  test("14. slug-parent query is exact, authenticated, edit-context, status-any GET", async () => {
    const fetcher = jest.fn(async () => response(200, []));
    const authenticated = createAuthenticatedWordPressTargetReader({ configuration, fetcher });
    await authenticated.readExactTargetBySlugParent({ identity });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(init.method).toBe("GET");
    expect(url).toContain(`slug=${identity.canonicalSlug}`);
    expect(url).toContain("parent=2563");
    expect(url).toContain("per_page=100");
    expect(url).toContain("status=any");
    expect(url).toContain("context=edit");
  });

  test("site-root configuration normalizes to the WordPress v2 REST root", async () => {
    const fetcher = jest.fn(async () => response(200, []));
    const authenticated = createAuthenticatedWordPressTargetReader({
      configuration: { ...configuration, apiBaseUrl: "https://example.test/" },
      fetcher,
    });
    await authenticated.readExactTargetBySlugParent({ identity });
    expect(fetcher.mock.calls[0][0]).toMatch(/^https:\/\/example\.test\/wp-json\/wp\/v2\/pages\?/);
  });

  test("15. adapter exposes no POST, PUT, PATCH, DELETE, or generic request surface", () => {
    const authenticated = reader([]) as unknown as Record<string, unknown>;
    expect(Object.keys(authenticated).sort()).toEqual(["readExactPageById", "readExactTargetBySlugParent"]);
    expect(authenticated.request).toBeUndefined();
    expect(authenticated.post).toBeUndefined();
    expect(authenticated.put).toBeUndefined();
    expect(authenticated.patch).toBeUndefined();
    expect(authenticated.delete).toBeUndefined();
  });

  test("16. credential material is absent from results and errors", async () => {
    const result = await reader([], 401).readExactTargetBySlugParent({ identity });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(configuration.username);
    expect(serialized).not.toContain(configuration.applicationPassword);
    expect(serialized).not.toContain("Basic ");
  });

  test("17. authorization artifact is deterministic, timestamp-independent, and secret-free", () => {
    const base = {
      targetId: "target-certification",
      siteId: "site-led-display-warehouse-production",
      identity,
      productId: "prod-indoor-led-video-wall",
      productFamilyId: "family-standard-dvled",
      state: "Texas",
      city: "Austin",
      pageBlueprintId: "page-blueprint-product-city",
      pageBlueprintVersion: 1,
      authenticatedExactResultCount: 0 as const,
      preflightPolicyVersion: "1.0.0",
      readAuthorityReference: "wordpress-read:leddisplaywarehouse.com:application-password",
    };
    const first = createLiveCertificationTargetAuthorization({ ...base, authenticatedAbsenceCheckedAt: "2026-08-28T01:00:00.000Z" });
    const second = createLiveCertificationTargetAuthorization({ ...base, authenticatedAbsenceCheckedAt: "2026-08-28T01:01:00.000Z" });
    expect(second.authorizationFingerprint).toBe(first.authorizationFingerprint);
    expect(JSON.stringify(first)).not.toContain(configuration.applicationPassword);
    expect(first).toMatchObject({ publicationIntent: "draft", operation: "CREATE", authenticatedExactResultCount: 0 });
  });

  test("18. reader and authorization expose zero generation or mutation capability", () => {
    const authenticated = reader([]) as unknown as Record<string, unknown>;
    expect(authenticated.generatePage).toBeUndefined();
    expect(authenticated.executeWorkflow).toBeUndefined();
    expect(authenticated.createPage).toBeUndefined();
    expect(authenticated.updatePage).toBeUndefined();
    expect(authenticated.deletePage).toBeUndefined();
    expect(authenticated.uploadMedia).toBeUndefined();
  });
});