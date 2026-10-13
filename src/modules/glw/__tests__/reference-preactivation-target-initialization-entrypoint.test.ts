import { readFileSync } from "node:fs";
import { join } from "node:path";

const route = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reference-page/route.ts"), "utf8");
const helper = readFileSync(join(process.cwd(), "src/modules/glw/reference-continuation-targets.ts"), "utf8");

describe("reference pre-activation target initialization entrypoint", () => {
  test("runs target initialization only after owner authority and before generation forwarding", () => {
    const consume = route.indexOf("ownerClaim = consumeGlwReferenceOwnerGrant({");
    const initialize = route.indexOf("ensureDraftCampaignContinuationTarget({");
    const forward = route.indexOf("const generationResponse = await fetch(");

    expect(consume).toBeGreaterThan(0);
    expect(initialize).toBeGreaterThan(consume);
    expect(forward).toBeGreaterThan(initialize);
    expect(route).toContain("Exact campaign target was not found for continuation.");
  });

  test("uses canonical preview/initializer only and does not activate or dispatch", () => {
    expect(helper).toContain("previewGlwCampaignTargets");
    expect(helper).toContain("initializeGlwCampaignTargets");
    expect(helper).toContain("initializeGlwCityCampaignTargets");

    expect(helper).not.toContain("activateGlwCampaign");
    expect(helper).not.toContain("leaseGlwCampaignTargets");
    expect(helper).not.toContain("/api/glw/page-generation");
    expect(helper).not.toContain("fetch(");
  });

  test("continuation authority gate remains mandatory before initialization", () => {
    const authorityRequired = route.indexOf("REFERENCE_OWNER_AUTHORITY_REQUIRED");
    const initialize = route.indexOf("ensureDraftCampaignContinuationTarget({");
    expect(authorityRequired).toBeGreaterThan(0);
    expect(initialize).toBeGreaterThan(authorityRequired);
  });
});
