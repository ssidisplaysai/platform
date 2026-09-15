import { readFileSync } from "node:fs";
import { join } from "node:path";

const route = readFileSync(
  join(process.cwd(), "src/app/glw/campaigns/[campaignId]/page.tsx"),
  "utf8",
);
const readModel = readFileSync(
  join(process.cwd(), "src/modules/glw/campaign-operator-read-model.ts"),
  "utf8",
);
const referenceWorkflow = readFileSync(
  join(process.cwd(), "src/modules/glw/GlwCampaignKnowledgePack.tsx"),
  "utf8",
);

describe("GLW campaign detail route", () => {
  test("imports and invokes the operator read model without stale legacy variables", () => {
    expect(route).toContain('import { buildGlwCampaignOperatorReadModel }');
    expect(route).toContain("await buildGlwCampaignOperatorReadModel(campaignId)");
    expect(route).toContain('listParams.set("organizationId"');
    expect(route).toContain("<GlwCampaignOperationsOverview model={model} />");
    expect(route).not.toContain("listGlwCampaignTargets(");
    expect(route).not.toContain("summarizeGlwCampaignTargets(");
    expect(route).not.toContain("labelStatus(");
  });

  test("mounts the existing reference workflow for draft campaigns with the full campaign model", () => {
    expect(route).toContain('model.campaign.status === "draft"');
    expect(route).toContain("<GlwCampaignKnowledgePack campaign={model.campaign}");
    expect(readModel).toContain("campaign: GlwCampaign;");
    expect(readModel).toContain("campaign: input.campaign,");
    expect(referenceWorkflow).toMatch(/import \{[^}]*\buseRef\b[^}]*\} from "react"/);
  });
});