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

  test("propagates persisted city identity while preserving state-target compatibility", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/publish/route.ts"),
      "utf8",
    );
    expect(route).toContain("citySlug: target.citySlug ?? null");
    expect(route).toContain("citySlug: target.citySlug,");
    expect(route).not.toMatch(/citySlug:\s*(?:request|body|title)/);
  });

  test("publishes before transitioning and never transitions after a failed WordPress result", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/publish/route.ts"),
      "utf8",
    );
    const publishCall = route.indexOf("await publishGenesisWordPressDraft");
    const failedWriteGuard = route.indexOf("if (!published.ok)", publishCall);
    const transition = route.indexOf("markGlwCampaignTargetPublished", failedWriteGuard);
    expect(publishCall).toBeGreaterThan(-1);
    expect(failedWriteGuard).toBeGreaterThan(publishCall);
    expect(transition).toBeGreaterThan(failedWriteGuard);
  });
});