import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("campaign publication reconciliation contract", () => {
  test("verifies city leaves under the canonical state parent and transitions exact city identity", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/publication-reconcile/route.ts"),
      "utf8",
    );

    expect(route).toContain("if (target.citySlug)");
    expect(route).toContain("parent: expectedParentId");
    expect(route).toContain("expectedSlug: target.citySlug ?? state.slug");
    expect(route).toContain("expectedParentId: expectedLeafParentId");
    expect(route).toContain("citySlug: target.citySlug,");
  });
});