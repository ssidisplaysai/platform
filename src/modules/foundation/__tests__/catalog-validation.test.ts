import { validateCategoryHierarchy } from "@/modules/foundation/catalog-validation";
import type { ProductCategory } from "@/modules/foundation/types";

describe("catalog validation", () => {
  test("rejects category cycles", () => {
    const categories: ProductCategory[] = [
      {
        categoryId: "cat-a",
        organizationId: "led-display-warehouse",
        name: "A",
        slug: "a",
        description: null,
        parentCategoryId: "cat-b",
        status: "active",
        sortOrder: 1,
        siteAssignments: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        categoryId: "cat-b",
        organizationId: "led-display-warehouse",
        name: "B",
        slug: "b",
        description: null,
        parentCategoryId: "cat-a",
        status: "active",
        sortOrder: 2,
        siteAssignments: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const validation = validateCategoryHierarchy(categories);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.message.includes("cycle"))).toBe(true);
  });
});
