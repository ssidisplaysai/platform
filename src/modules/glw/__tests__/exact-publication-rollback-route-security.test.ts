jest.mock("server-only", () => ({}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/glw/campaigns/[campaignId]/rich-reference-publication/route";

const route = { params: Promise.resolve({ campaignId: "campaign-outdoor" }) };

async function spoof(headers: Record<string, string>) {
  return POST(new NextRequest("http://localhost/api/glw/campaigns/campaign-outdoor/rich-reference-publication?organizationId=led-display-warehouse&siteId=site-led-display-warehouse-production", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ action: "RUN_PREFLIGHT", targetId: "target-campaign-outdoor-in", operation: "EXACT_WORDPRESS_PUBLICATION", visualCertificationId: "draft-certification" }) }), route);
}

describe("shared exact publication route security", () => {
  test("caller role headers do not authorize publication", async () => {
    const response = await spoof({ "x-gcp-roles": "platform_admin", "x-gcp-organization-id": "led-display-warehouse", "x-gcp-site-id": "site-led-display-warehouse-production" });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ callerSuppliedRoleHeadersAuthorize: false, callerSuppliedEmailHeadersAuthorize: false });
  });

  test("caller email and owner headers do not authorize publication", async () => {
    const response = await spoof({ "x-gcp-email": "owner@example.com", "x-gcp-owner": "true", "x-gcp-principal-id": "owner", "x-gcp-session-id": "session", "x-gcp-organization-id": "led-display-warehouse", "x-gcp-site-id": "site-led-display-warehouse-production" });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ callerSuppliedRoleHeadersAuthorize: false, callerSuppliedEmailHeadersAuthorize: false });
  });
});
