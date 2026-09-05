import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("campaign publication policy contract", () => {
  test("blocks draft-only campaigns in both preflight and execution", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/publish/route.ts"),
      "utf8",
    );
    const policyChecks = route.match(/campaign\.publicationPolicy === "draft_only"/g) ?? [];
    expect(policyChecks).toHaveLength(2);
    expect(route).toContain("policyBlocked: true");
    expect(route).toContain("publicationPerformed: false");
    expect(route).toContain("{ status: 409 }");
  });
});