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
});