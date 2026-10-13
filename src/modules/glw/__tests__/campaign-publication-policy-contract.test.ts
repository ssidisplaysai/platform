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

  test("establishes protected claim before transition and records receipt before lifecycle publish", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/publish/route.ts"),
      "utf8",
    );
    const claim = route.indexOf("consumeExactPublicationRollbackGrant");
    const transition = route.indexOf("await transitionGenesisWordPressPageStatus", claim);
    const failedWriteGuard = route.indexOf("if (!published.ok)", transition);
    const receipt = route.indexOf("recordExactPublicationRollbackReceipt", failedWriteGuard);
    const lifecycle = route.indexOf("markGlwCampaignTargetPublished", receipt);
    expect(claim).toBeGreaterThan(-1);
    expect(transition).toBeGreaterThan(claim);
    expect(failedWriteGuard).toBeGreaterThan(transition);
    expect(receipt).toBeGreaterThan(failedWriteGuard);
    expect(lifecycle).toBeGreaterThan(receipt);
  });
});