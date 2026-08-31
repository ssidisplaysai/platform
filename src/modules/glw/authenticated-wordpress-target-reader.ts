import {
  createAuthenticatedWordPressReadAuthority,
  type AuthenticatedWordPressGetFetcher,
  type AuthenticatedWordPressReadConfiguration,
} from "@/modules/foundation/authenticated-wordpress-read-authority";
import type {
  GlwCanonicalTargetIdentity,
  GlwTargetPreflightResult,
  GlwWordPressTargetPage,
} from "./target-preflight";

export type { AuthenticatedWordPressReadConfiguration };

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
  preflight: Omit<GlwTargetPreflightResult, "state"> & {
    state: GlwTargetPreflightResult["state"] | "BLOCKED";
  };
  reason: AuthenticatedWordPressReadReason;
  exactResultCount: number | null;
  pageMetadata: {
    modifiedGmt: string | null;
    featuredMediaId: string | null;
    authorId: string | null;
  } | null;
};

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
      featuredMediaId: page.featured_media
        ? String(page.featured_media)
        : null,
      authorId: page.author ? String(page.author) : null,
    },
  };
}

export function createAuthenticatedWordPressTargetReader(input: {
  configuration: AuthenticatedWordPressReadConfiguration;
  fetcher?: AuthenticatedWordPressGetFetcher;
}): AuthenticatedWordPressTargetReader {
  const authority = createAuthenticatedWordPressReadAuthority({
    configuration: input.configuration,
    fetcher: input.fetcher,
  });

  return {
    async readExactTargetBySlugParent({ identity }) {
      const query = new URLSearchParams({
        slug: identity.canonicalSlug,
        parent: identity.canonicalParentId ?? "",
        per_page: "100",
        status: "any",
        context: "edit",
        _fields:
          "id,slug,parent,status,link,title,modified_gmt,featured_media,author",
      });

      const read = await authority.getJson({
        path: "/pages",
        query,
      });

      if (!read.ok) {
        return {
          preflight: safeIdentity(identity),
          reason: read.reason,
          exactResultCount: null,
          pageMetadata: null,
        };
      }

      if (!Array.isArray(read.body)) {
        return {
          preflight: safeIdentity(identity),
          reason: "MALFORMED_RESPONSE",
          exactResultCount: null,
          pageMetadata: null,
        };
      }

      const exact = (read.body as GlwWordPressTargetPage[]).filter(
        (page) =>
          page.slug === identity.canonicalSlug
          && String(page.parent ?? "")
            === String(identity.canonicalParentId ?? ""),
      );

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
        return {
          preflight: safeIdentity(identity),
          reason: "IDENTITY_MISMATCH",
          exactResultCount: null,
          pageMetadata: null,
        };
      }

      const query = new URLSearchParams({
        context: "edit",
        _fields:
          "id,slug,parent,status,link,title,modified_gmt,featured_media,author",
      });

      const read = await authority.getJson({
        path: `/pages/${wordpressObjectId}`,
        query,
      });

      if (!read.ok) {
        return {
          preflight: safeIdentity(identity),
          reason: read.reason,
          exactResultCount: null,
          pageMetadata: null,
        };
      }

      if (!read.body || typeof read.body !== "object" || Array.isArray(read.body)) {
        return {
          preflight: safeIdentity(identity),
          reason: "MALFORMED_RESPONSE",
          exactResultCount: null,
          pageMetadata: null,
        };
      }

      const page = read.body as GlwWordPressTargetPage;

      if (
        String(page.id ?? "") !== wordpressObjectId
        || page.slug !== identity.canonicalSlug
        || String(page.parent ?? "")
          !== String(identity.canonicalParentId ?? "")
      ) {
        return {
          preflight: safeIdentity(identity),
          reason: "IDENTITY_MISMATCH",
          exactResultCount: 0,
          pageMetadata: null,
        };
      }

      return pageResult(identity, page);
    },
  };
}
