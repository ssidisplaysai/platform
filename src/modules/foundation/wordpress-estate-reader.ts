import type {
  AuthenticatedWordPressReadAuthority,
  AuthenticatedWordPressReadFailureReason,
} from "./authenticated-wordpress-read-authority";

export type WordPressEstateObjectKind =
  | "page"
  | "post"
  | "media"
  | "post_type"
  | "taxonomy"
  | "category"
  | "tag";

export type WordPressEstateObject = {
  kind: WordPressEstateObjectKind;
  id: string;
  slug: string | null;
  status: string | null;
  parentId: string | null;
  link: string | null;
  title: string | null;
  modifiedGmt: string | null;
  authorId: string | null;
  raw: unknown;
};

export type WordPressEstateCollection = {
  kind: WordPressEstateObjectKind;
  objects: readonly WordPressEstateObject[];
  total: number | null;
  totalPages: number | null;
};

export type WordPressEstateReadFailure = {
  ok: false;
  reason: AuthenticatedWordPressReadFailureReason | "MALFORMED_COLLECTION";
  path: string;
};

export type WordPressEstateReadSuccess = {
  ok: true;
  collection: WordPressEstateCollection;
};

export type WordPressEstateReadResult =
  | WordPressEstateReadSuccess
  | WordPressEstateReadFailure;

export type WordPressEstateReader = {
  readPages(): Promise<WordPressEstateReadResult>;
  readPosts(): Promise<WordPressEstateReadResult>;
  readMedia(): Promise<WordPressEstateReadResult>;
  readPostTypes(): Promise<WordPressEstateReadResult>;
  readTaxonomies(): Promise<WordPressEstateReadResult>;
  readCategories(): Promise<WordPressEstateReadResult>;
  readTags(): Promise<WordPressEstateReadResult>;
};

type WordPressObject = {
  id?: number;
  slug?: string;
  status?: string;
  parent?: number;
  link?: string;
  title?: { rendered?: string };
  modified_gmt?: string;
  author?: number;
  name?: string;
};

function normalizeObject(
  kind: WordPressEstateObjectKind,
  value: WordPressObject,
): WordPressEstateObject {
  return {
    kind,
    id: value.id !== undefined ? String(value.id) : "",
    slug: value.slug ?? null,
    status: value.status ?? null,
    parentId: value.parent !== undefined ? String(value.parent) : null,
    link: value.link ?? null,
    title: value.title?.rendered ?? value.name ?? null,
    modifiedGmt: value.modified_gmt ?? null,
    authorId: value.author !== undefined ? String(value.author) : null,
    raw: value,
  };
}

function collectionPath(kind: WordPressEstateObjectKind): string {
  switch (kind) {
    case "page":
      return "/pages";
    case "post":
      return "/posts";
    case "media":
      return "/media";
    case "post_type":
      return "/types";
    case "taxonomy":
      return "/taxonomies";
    case "category":
      return "/categories";
    case "tag":
      return "/tags";
  }
}

function requiresPagination(kind: WordPressEstateObjectKind): boolean {
  return kind === "page"
    || kind === "post"
    || kind === "media"
    || kind === "category"
    || kind === "tag";
}

export function createWordPressEstateReader(input: {
  authority: AuthenticatedWordPressReadAuthority;
  perPage?: number;
}): WordPressEstateReader {
  const perPage = Math.min(Math.max(input.perPage ?? 100, 1), 100);

  const readCollection = async (
    kind: WordPressEstateObjectKind,
  ): Promise<WordPressEstateReadResult> => {
    const path = collectionPath(kind);

    if (!requiresPagination(kind)) {
      const query = new URLSearchParams({
        context: "edit",
      });

      const read = await input.authority.getJson({
        path,
        query,
      });

      if (read.ok === false) {
        return {
          ok: false,
          reason: read.reason,
          path,
        };
      }

      if (!read.body || typeof read.body !== "object" || Array.isArray(read.body)) {
        return {
          ok: false,
          reason: "MALFORMED_COLLECTION",
          path,
        };
      }

      const values = Object.values(read.body as Record<string, WordPressObject>);

      return {
        ok: true,
        collection: {
          kind,
          objects: values.map((value) => normalizeObject(kind, value)),
          total: values.length,
          totalPages: 1,
        },
      };
    }

    const objects: WordPressEstateObject[] = [];
    let page = 1;
    let total: number | null = null;
    let totalPages: number | null = null;

    while (true) {
      const query = new URLSearchParams({
        context: "edit",
        status: "any",
        per_page: String(perPage),
        page: String(page),
      });

      const read = await input.authority.getJson({
        path,
        query,
      });

      if (read.ok === false) {
        return {
          ok: false,
          reason: read.reason,
          path,
        };
      }

      if (!Array.isArray(read.body)) {
        return {
          ok: false,
          reason: "MALFORMED_COLLECTION",
          path,
        };
      }

      if (page === 1) {
        total = read.pagination.total;
        totalPages = read.pagination.totalPages;
      }

      const batch = (read.body as WordPressObject[])
        .map((value) => normalizeObject(kind, value));

      objects.push(...batch);

      if (totalPages !== null) {
        if (page >= totalPages) break;
      } else if (batch.length < perPage) {
        break;
      }

      page += 1;

      if (page > 10_000) {
        return {
          ok: false,
          reason: "MALFORMED_COLLECTION",
          path,
        };
      }
    }

    return {
      ok: true,
      collection: {
        kind,
        objects,
        total,
        totalPages,
      },
    };
  };

  return {
    readPages: () => readCollection("page"),
    readPosts: () => readCollection("post"),
    readMedia: () => readCollection("media"),
    readPostTypes: () => readCollection("post_type"),
    readTaxonomies: () => readCollection("taxonomy"),
    readCategories: () => readCollection("category"),
    readTags: () => readCollection("tag"),
  };
}

