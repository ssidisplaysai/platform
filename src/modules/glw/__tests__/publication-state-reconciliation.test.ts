import { classifyGlwPublicationRead } from "../publication-state-reconciliation";

const expected = {
  expectedWordpressObjectId: "19825",
  expectedSlug: "alabama",
  expectedParentId: "19812",
};

describe("GLW publication state reconciliation", () => {
  test("accepts only exact published identity", () => {
    expect(classifyGlwPublicationRead({
      ...expected,
      page: { id: 19825, slug: "alabama", parent: 19812, status: "publish" },
    })).toBe("RECONCILED_PUBLISHED");
  });

  test("blocks Alaska-style parent changes", () => {
    expect(classifyGlwPublicationRead({
      ...expected,
      page: { id: 19825, slug: "alabama", parent: 0, status: "publish" },
    })).toBe("HIERARCHY_MISMATCH");
  });

  test("does not reconcile an exact draft", () => {
    expect(classifyGlwPublicationRead({
      ...expected,
      page: { id: 19825, slug: "alabama", parent: 19812, status: "draft" },
    })).toBe("NOT_PUBLISHED");
  });

  test("fails closed on object identity mismatch", () => {
    expect(classifyGlwPublicationRead({
      ...expected,
      page: { id: 999, slug: "alabama", parent: 19812, status: "publish" },
    })).toBe("UNRESOLVED_ERROR");
  });
});