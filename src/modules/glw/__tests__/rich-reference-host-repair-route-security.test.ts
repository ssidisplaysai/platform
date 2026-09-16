jest.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/glw/campaigns/[campaignId]/rich-reference-host-repair/route";

const route = { params: Promise.resolve({ campaignId: "campaign-outdoor" }) };

describe("rich-reference host repair route", () => {
  test("caller-supplied scope headers do not authorize repair", async () => {
    const response = await POST(new NextRequest("http://localhost/api/glw/campaigns/campaign-outdoor/rich-reference-host-repair?targetId=target-campaign-outdoor-in&organizationId=led-display-warehouse&siteId=site-led-display-warehouse-production", { method: "POST", headers: { "content-type": "application/json", "x-gcp-roles": "platform_admin", "x-gcp-organization-id": "led-display-warehouse", "x-gcp-site-id": "site-led-display-warehouse-production" }, body: JSON.stringify({ action: "REPAIR_AND_CERTIFY" }) }), route);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ publicationTransactionPerformed: false, rollbackPerformed: false });
  });

  test("uses shared host repair and has no publication authority actions", () => {
    const source = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/rich-reference-host-repair/route.ts"), "utf8");
    expect(source).toContain("repairEligibleRichPageNativeTitle");
    expect(source).toContain("certifyExactPublicRichReference");
    expect(source).not.toContain("issueExactPublicationRollbackGrant");
    expect(source).not.toContain("consumeExactPublicationRollbackGrant");
    expect(source).not.toContain("transitionGenesisWordPressPageStatus");
    expect(source).not.toMatch(/Indiana|Alaska|20115|20114/);
  });
});
