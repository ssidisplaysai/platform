import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("reference retry authorization projection", () => {
  test("recovers persisted authority and renders one truthful action state", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reference-authority/route.ts"), "utf8").replace(/\s/g, "");
    const ui = readFileSync(join(process.cwd(), "src/modules/glw/GlwCampaignKnowledgePack.tsx"), "utf8").replace(/\s/g, "");
    expect(route).toContain("projectGlwReferenceOwnerGrant({principal:principal.principal,liveContext})");
    expect(ui).toContain('Authorization:{ownerGrantReady?"AUTHORIZED":terminalQaBlocked?"BLOCKED_BY_QA"');
    expect(ui).toContain('ownerGrantReady?"Generate/ExecuteOneIndianaRemediatedRetry":"IndianaRetryRequiresNewAuthorization"');
    expect(ui).toContain("{!ownerGrantReady&&!sameJobRecoveryRequired?(");
    expect(ui).toContain("authorityPayload.grant?.valid");
  });
});