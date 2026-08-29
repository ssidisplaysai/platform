import { createWordPressEstateReader } from "../wordpress-estate-reader";
import type {
  AuthenticatedWordPressReadAuthority,
  AuthenticatedWordPressReadResult,
} from "../authenticated-wordpress-read-authority";

function authorityFrom(
  handler: (
    path: string,
    query?: URLSearchParams,
  ) => Promise<AuthenticatedWordPressReadResult>,
): AuthenticatedWordPressReadAuthority {
  return {
    getJson: ({ path, query }) => handler(path, query),
  };
}

describe("Genesis WordPress estate reader", () => {
  test("reads and paginates pages with authenticated edit context", async () => {
    const calls: Array<{ path: string; query?: URLSearchParams }> = [];

    const authority = authorityFrom(async (path, query) => {
      calls.push({ path, query });

      const page = query?.get("page");

      if (page === "1") {
        return {
          ok: true,
          body: [
            {
              id: 1,
              slug: "home",
              status: "publish",
              parent: 0,
              title: { rendered: "Home" },
            },
          ],
          pagination: {
            total: 2,
            totalPages: 2,
          },
        };
      }

      return {
        ok: true,
        body: [
          {
            id: 2,
            slug: "draft-page",
            status: "draft",
            parent: 1,
            title: { rendered: "Draft Page" },
          },
        ],
        pagination: {
          total: 2,
          totalPages: 2,
        },
      };
    });

    const reader = createWordPressEstateReader({ authority });

    const result = await reader.readPages();

    expect(result).toMatchObject({
      ok: true,
      collection: {
        kind: "page",
        total: 2,
        totalPages: 2,
      },
    });

    if (!result.ok) throw new Error("Expected success");

    expect(result.collection.objects).toHaveLength(2);
    expect(result.collection.objects[1]).toMatchObject({
      id: "2",
      slug: "draft-page",
      status: "draft",
      parentId: "1",
      title: "Draft Page",
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].path).toBe("/pages");
    expect(calls[0].query?.get("context")).toBe("edit");
    expect(calls[0].query?.get("status")).toBe("any");
    expect(calls[0].query?.get("per_page")).toBe("100");
  });

  test("falls back to batch length when pagination headers are absent", async () => {
    let callCount = 0;

    const authority = authorityFrom(async () => {
      callCount += 1;

      return {
        ok: true,
        body: callCount === 1
          ? [{ id: 1 }, { id: 2 }]
          : [{ id: 3 }],
        pagination: {
          total: null,
          totalPages: null,
        },
      };
    });

    const reader = createWordPressEstateReader({
      authority,
      perPage: 2,
    });

    const result = await reader.readPosts();

    expect(result).toMatchObject({
      ok: true,
      collection: {
        kind: "post",
      },
    });

    if (!result.ok) throw new Error("Expected success");

    expect(result.collection.objects).toHaveLength(3);
    expect(callCount).toBe(2);
  });

  test.each([
    ["media", "/media", "readMedia"],
    ["categories", "/categories", "readCategories"],
    ["tags", "/tags", "readTags"],
  ] as const)(
    "reads %s with edit context and without a status filter",
    async (_label, expectedPath, method) => {
      const calls: Array<{ path: string; query?: URLSearchParams }> = [];
      const authority = authorityFrom(async (path, query) => {
        calls.push({ path, query });

        return {
          ok: true,
          body: [],
          pagination: {
            total: 0,
            totalPages: 0,
          },
        };
      });
      const reader = createWordPressEstateReader({ authority });

      await reader[method]();

      expect(calls).toHaveLength(1);
      expect(calls[0].path).toBe(expectedPath);
      expect(calls[0].query?.get("context")).toBe("edit");
      expect(calls[0].query?.has("status")).toBe(false);
      expect(calls[0].query?.get("per_page")).toBe("100");
    },
  );

  test("reads post types as bounded object map", async () => {
    const authority = authorityFrom(async (path, query) => {
      expect(path).toBe("/types");
      expect(query?.get("context")).toBe("edit");

      return {
        ok: true,
        body: {
          post: { slug: "post", name: "Posts" },
          page: { slug: "page", name: "Pages" },
        },
        pagination: {
          total: null,
          totalPages: null,
        },
      };
    });

    const reader = createWordPressEstateReader({ authority });

    const result = await reader.readPostTypes();

    expect(result).toMatchObject({
      ok: true,
      collection: {
        kind: "post_type",
        total: 2,
        totalPages: 1,
      },
    });
  });

  test("propagates bounded authenticated-read failures", async () => {
    const authority = authorityFrom(async () => ({
      ok: false,
      reason: "AUTH_FAILURE",
    }));

    const reader = createWordPressEstateReader({ authority });

    await expect(reader.readMedia()).resolves.toEqual({
      ok: false,
      reason: "AUTH_FAILURE",
      path: "/media",
    });
  });

  test("rejects malformed collection body", async () => {
    const authority = authorityFrom(async () => ({
      ok: true,
      body: { unexpected: true },
      pagination: {
        total: 1,
        totalPages: 1,
      },
    }));

    const reader = createWordPressEstateReader({ authority });

    await expect(reader.readPages()).resolves.toEqual({
      ok: false,
      reason: "MALFORMED_COLLECTION",
      path: "/pages",
    });
  });

  test("reader exposes only read operations", () => {
    const authority = authorityFrom(async () => ({
      ok: true,
      body: [],
      pagination: {
        total: 0,
        totalPages: 0,
      },
    }));

    const reader = createWordPressEstateReader({
      authority,
    }) as unknown as Record<string, unknown>;

    expect(Object.keys(reader).sort()).toEqual([
      "readCategories",
      "readMedia",
      "readPages",
      "readPostTypes",
      "readPosts",
      "readTags",
      "readTaxonomies",
    ]);

    expect(reader.createPage).toBeUndefined();
    expect(reader.updatePage).toBeUndefined();
    expect(reader.deletePage).toBeUndefined();
    expect(reader.uploadMedia).toBeUndefined();
    expect(reader.executeWorkflow).toBeUndefined();
  });
});
