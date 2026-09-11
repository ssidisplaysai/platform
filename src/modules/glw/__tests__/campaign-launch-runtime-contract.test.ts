jest.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/glw/campaign-launch/route";

describe("campaign launch runtime endpoint and lifecycle contract", () => {
  test("requires authenticated schedule creation authority", async () => {
    const response = await POST(new NextRequest("http://localhost/api/glw/campaign-launch", { method: "POST", body: JSON.stringify({ operation: "LAUNCH_CITY_CAMPAIGN" }), headers: { "content-type": "application/json" } }));
    expect(response.status).toBe(401);
  });

  test("requires the explicit launch operation before resolving runtime authority", async () => {
    const response = await POST(new NextRequest("http://localhost/api/glw/campaign-launch", { method: "POST", body: JSON.stringify({ operation: "UNKNOWN" }), headers: { "content-type": "application/json", "x-gcp-roles": "platform_admin", "x-gcp-organization-id": "ssi" } }));
    expect(response.status).toBe(400);
  });

  test("derives policy server-side and never dispatches or publishes", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/glw/campaign-launch/route.ts"), "utf8");
    expect(route).toContain("authoritativePublicationPolicy: policies[0]");
    expect(route).toContain("publicationPolicyAcknowledgement: body.publicationPolicyAcknowledgement");
    expect(route).toContain("publicationPerformed: false");
    expect(route).toContain("dispatchPerformed: false");
    expect(route).not.toContain("RUN_EXACT_DRAFT_TARGETS");
    expect(route).not.toContain("PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS");
  });

  test("shares promotion authority with the UI and rechecks it at the mutation boundary", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/glw/campaign-launch/route.ts"), "utf8");
    const page = readFileSync(join(process.cwd(), "src/modules/glw/CampaignLaunchpadPage.tsx"), "utf8");
    const initialCheck = route.indexOf("const initialPromotion = readGlwCampaignLaunchPromotion()");
    const mutationBoundaryCheck = route.indexOf("const mutationBoundaryPromotion = readGlwCampaignLaunchPromotion()");
    const mutation = route.indexOf("const result = launchGlwCityCampaign(");

    expect(page).toContain("const launchPromotion = readGlwCampaignLaunchPromotion()");
    expect(page).toContain("atomicLaunchAvailable={launchPromotion.available}");
    expect(initialCheck).toBeGreaterThan(-1);
    expect(mutationBoundaryCheck).toBeGreaterThan(initialCheck);
    expect(mutationBoundaryCheck).toBeLessThan(mutation);
    expect(route.slice(mutationBoundaryCheck, mutation)).toContain("if (!mutationBoundaryPromotion.available)");
  });

  test("keeps draft-only preparation separate from promoted atomic launch", () => {
    const drafts = readFileSync(join(process.cwd(), "src/app/api/glw/campaign-drafts/route.ts"), "utf8");
    const launch = readFileSync(join(process.cwd(), "src/app/api/glw/campaign-launch/route.ts"), "utf8");
    expect(drafts).toContain("activationPerformed: false");
    expect(drafts).toContain("targetsCreated: 0");
    expect(drafts).toContain("publicationPerformed: false");
    expect(drafts).not.toContain("GLW_CAMPAIGN_LAUNCH_PRODUCTION_ENABLED");
    expect(launch).toContain('code: "PRODUCTION_PROMOTION_REQUIRED"');
  });

  test("revalidates current site and product authority before generation dispatch", () => {
    const generation = readFileSync(join(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    const siteReadiness = generation.indexOf("const siteReadiness = evaluateSiteReadiness(");
    const productReadiness = generation.indexOf("const productReadiness = evaluateProductReadiness(");
    const targetPreflight = generation.indexOf("const target = await readGlwTargetPreflight(");
    const execute = generation.indexOf("service.execute(preview.request)");
    expect(siteReadiness).toBeGreaterThan(-1);
    expect(productReadiness).toBeGreaterThan(siteReadiness);
    expect(targetPreflight).toBeGreaterThan(productReadiness);
    expect(execute).toBeGreaterThan(targetPreflight);
    expect(generation.slice(productReadiness, targetPreflight)).toContain("GENERATION_AUTHORITY_NOT_READY");
  });

  test("preserves reference approval, activation, and scheduler ownership boundaries", () => {
    const reference = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reference-page/route.ts"), "utf8");
    const activation = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/activate/route.ts"), "utf8");
    const scheduler = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/scheduler/route.ts"), "utf8");
    expect(reference.indexOf("approveGlwCampaignReference")).toBeLessThan(reference.indexOf("recordGlwCampaignLaunchReferenceApproved"));
    expect(activation.lastIndexOf("requireGlwCampaignLaunchReservationOwnership")).toBeLessThan(activation.lastIndexOf("initializeGlwCityCampaignTargets"));
    expect(activation.lastIndexOf("activateGlwCampaign")).toBeLessThan(activation.lastIndexOf("recordGlwCampaignLaunchActivated"));
    expect(activation.indexOf('campaign.status === "active"')).toBeLessThan(activation.indexOf("recordGlwCampaignLaunchActivated(campaign, targets)"));
    expect(activation).toContain("activationRecoveryRequired: true");
    expect(scheduler).toContain("buildGlwCampaignProductionGenerationForm");
    expect(scheduler).toContain("recordGlwCampaignLaunchDispatch");
  });

  test("checks production promotion before activation can resolve or mutate a campaign", () => {
    const activation = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/activate/route.ts"), "utf8");
    const promotion = activation.indexOf("const promotion = readGlwCampaignLaunchPromotion()");
    const campaignLookup = activation.indexOf("const campaign = listGlwCampaigns().find(", promotion);
    const mutation = activation.indexOf("const activation = activateGlwCampaign(");
    expect(promotion).toBeGreaterThan(-1);
    expect(promotion).toBeLessThan(campaignLookup);
    expect(promotion).toBeLessThan(mutation);
    expect(activation.slice(promotion, campaignLookup)).toContain("PRODUCTION_PROMOTION_REQUIRED");
  });
});