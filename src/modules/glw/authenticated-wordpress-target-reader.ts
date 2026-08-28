import type {
  GlwCanonicalTargetIdentity,
  GlwTargetPreflightResult,
  GlwWordPressTargetPage,
} from "./target-preflight";

export type AuthenticatedWordPressReadConfiguration = {
  apiBaseUrl: string;
  username: string;
  applicationPassword: string;
  timeoutMs?: number;
};

export type AuthenticatedWordPressReadReason =
  | "EXACT_ZERO_RESULTS"
  | "EXACT_DRAFT_FOUND"
  | "EXACT_PUBLISHED_FOUND"
  | "AUTH_FAILURE"
  | "READ_TIMEOUT"
  | "NETWORK_ERROR"
  | "MALFORMED_RESPONSE"
  | "MULTIPLE_EXACT_WORDPRESS_OBJECTS"
  | "IDENTITY_MISMATCH";

export type AuthenticatedWordPressTargetReadResult = {
  preflight: GlwTargetPreflightResult & { state: GlwTargetPreflightResult["state"] | "BLOCKED" };
  reason: AuthenticatedWordPressReadReason;
  exactResultCount: number | null;
  pageMetadata: {
    modifiedGmt: string | null;
    featuredMediaId: string | null;
    authorId: string | null;
  } | null;
};

type FetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

type GetFetcher = (
  url: string,
  init: { method: "GET"; headers: Record<string, string>; signal: AbortSignal },
) => Promise<FetchResponse>;

export type AuthenticatedWordPressTargetReader = {
  readExactTargetBySlugParent(input: {
    identity: GlwCanonicalTargetIdentity;
  }): Promise<AuthenticatedWordPressTargetReadResult>;
  readExactPageById(input: {
    identity: GlwCanonicalTargetIdentity;
    wordpressObjectId: string;
  }): Promise<AuthenticatedWordPressTargetReadResult>;
};

function safeIdentity(
  identity: GlwCanonicalTargetIdentity,
  state: AuthenticatedWordPressTargetReadResult["preflight"]["state"] = "UNKNOWN",
): AuthenticatedWordPressTargetReadResult["preflight"] {
  return {
    ...identity,
    state,
    wordpressObjectId: null,
    wordpressStatus: null,
    wordpressTitle: null,
    wordpressUrl: null,
    source: "UNVERIFIED",
    confidence: "UNVERIFIED",
  };
}

function pageResult(
  identity: GlwCanonicalTargetIdentity,
  page: GlwWordPressTargetPage,
): AuthenticatedWordPressTargetReadResult {
  const published = page.status === "publish";
  return {
    preflight: {
      ...identity,
      state: published ? "EXISTS_PUBLISHED" : "EXISTS_DRAFT",
      wordpressObjectId: String(page.id),
      wordpressStatus: page.status ?? null,
      wordpressTitle: page.title?.rendered ?? null,
      wordpressUrl: page.link ?? null,
      source: "WORDPRESS_READ",
      confidence: "AUTHORITATIVE",
    },
    reason: published ? "EXACT_PUBLISHED_FOUND" : "EXACT_DRAFT_FOUND",
    exactResultCount: 1,
    pageMetadata: {
      modifiedGmt: page.modified_gmt ?? null,
      featuredMediaId: page.featured_media ? String(page.featured_media) : null,
      authorId: page.author ? String(page.author) : null,
    },
  };
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("WordPress read authority must use HTTPS outside localhost.");
  }
  const marker = "/wp-json/wp/v2";
  const markerIndex = url.pathname.indexOf(marker);
  const pathname = markerIndex >= 0
    ? url.pathname.slice(0, markerIndex + marker.length)
    : `${url.pathname.replace(/\/$/, "")}${marker}`;
  return `${url.protocol}//${url.host}${pathname}`;
}

function boundedErrorReason(error: unknown): AuthenticatedWordPressReadReason {
  return error instanceof DOMException && error.name === "AbortError" ? "READ_TIMEOUT" : "NETWORK_ERROR";
}

export function createAuthenticatedWordPressTargetReader(input: {
  configuration: AuthenticatedWordPressReadConfiguration;
  fetcher?: GetFetcher;
}): AuthenticatedWordPressTargetReader {
  const apiBaseUrl = normalizeBaseUrl(input.configuration.apiBaseUrl);
  const timeoutMs = Math.min(Math.max(input.configuration.timeoutMs ?? 10_000, 1_000), 30_000);
  const authorization = `Basic ${Buffer.from(`${input.configuration.username}:${input.configuration.applicationPassword}`).toString("base64")}`;
  const fetcher = input.fetcher ?? (fetch as unknown as GetFetcher);

  const get = async (
    url: string,
    identity: GlwCanonicalTargetIdentity,
  ): Promise<{ body: unknown; failure: AuthenticatedWordPressTargetReadResult | null }> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(url, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: authorization },
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        return {
          body: null,
          failure: { preflight: safeIdentity(identity), reason: "AUTH_FAILURE", exactResultCount: null, pageMetadata: null },
        };
      }
      if (!response.ok) {
        return {
          body: null,
          failure: { preflight: safeIdentity(identity), reason: "NETWORK_ERROR", exactResultCount: null, pageMetadata: null },
        };
      }
      try {
        return { body: await response.json(), failure: null };
      } catch {
        return {
          body: null,
          failure: { preflight: safeIdentity(identity), reason: "MALFORMED_RESPONSE", exactResultCount: null, pageMetadata: null },
        };
      }
    } catch (error) {
      return {
        body: null,
        failure: { preflight: safeIdentity(identity), reason: boundedErrorReason(error), exactResultCount: null, pageMetadata: null },
      };
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    async readExactTargetBySlugParent({ identity }) {
      const query = new URLSearchParams({
        slug: identity.canonicalSlug,
        parent: identity.canonicalParentId ?? "",
        per_page: "100",
        status: "any",
        context: "edit",
        _fields: "id,slug,parent,status,link,title,modified_gmt,featured_media,author",
      });
      const read = await get(`${apiBaseUrl}/pages?${query}`, identity);
      if (read.failure) return read.failure;
      if (!Array.isArray(read.body)) {
        return { preflight: safeIdentity(identity), reason: "MALFORMED_RESPONSE", exactResultCount: null, pageMetadata: null };
      }
      const exact = (read.body as GlwWordPressTargetPage[]).filter((page) =>
        page.slug === identity.canonicalSlug
        && String(page.parent ?? "") === String(identity.canonicalParentId ?? ""));
      if (exact.length === 0) {
        return {
          preflight: {
            ...safeIdentity(identity, "ABSENT"),
            source: "WORDPRESS_READ",
            confidence: "AUTHORITATIVE",
          },
          reason: "EXACT_ZERO_RESULTS",
          exactResultCount: 0,
          pageMetadata: null,
        };
      }
      if (exact.length > 1) {
        return {
          preflight: safeIdentity(identity, "BLOCKED"),
          reason: "MULTIPLE_EXACT_WORDPRESS_OBJECTS",
          exactResultCount: exact.length,
          pageMetadata: null,
        };
      }
      return pageResult(identity, exact[0]);
    },

    async readExactPageById({ identity, wordpressObjectId }) {
      if (!/^\d+$/.test(wordpressObjectId)) {
        return { preflight: safeIdentity(identity), reason: "IDENTITY_MISMATCH", exactResultCount: null, pageMetadata: null };
      }
      const query = new URLSearchParams({ context: "edit", _fields: "id,slug,parent,status,link,title,modified_gmt,featured_media,author" });
      const read = await get(`${apiBaseUrl}/pages/${wordpressObjectId}?${query}`, identity);
      if (read.failure) return read.failure;
      if (!read.body || typeof read.body !== "object" || Array.isArray(read.body)) {
        return { preflight: safeIdentity(identity), reason: "MALFORMED_RESPONSE", exactResultCount: null, pageMetadata: null };
      }
      const page = read.body as GlwWordPressTargetPage;
      if (String(page.id ?? "") !== wordpressObjectId
        || page.slug !== identity.canonicalSlug
        || String(page.parent ?? "") !== String(identity.canonicalParentId ?? "")) {
        return { preflight: safeIdentity(identity), reason: "IDENTITY_MISMATCH", exactResultCount: 0, pageMetadata: null };
      }
      return pageResult(identity, page);
    },
  };
}