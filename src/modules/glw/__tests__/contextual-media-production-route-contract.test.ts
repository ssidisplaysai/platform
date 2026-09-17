import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("contextual media production route contract", () => {
  test("exposes generalized dry-run and execute modes through existing services", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/contextual-media-production/route.ts"), "utf8");
    const service = readFileSync(join(process.cwd(), "src/modules/glw/contextual-media-production-service.ts"), "utf8");
    const dependencies = readFileSync(join(process.cwd(), "src/modules/glw/contextual-media-production-dependencies.ts"), "utf8");
    expect(route).toContain('!["DRY_RUN", "EXECUTE"].includes');
    expect(route).toContain("preflightContextualMediaProduction");
    expect(route).toContain("executeContextualMediaProduction");
    expect(service.indexOf("patchPresentation: async")).toBeLessThan(service.indexOf("certify: async"));
    expect(service).toContain("runGovernedRenderCapture");
    expect(service).toContain("writeGenesisWordPressDraft");
    expect(dependencies).toContain("generateGenesisFeaturedImageWithCampaignReferences");
    expect(dependencies).toContain("uploadGenesisWordPressGeneratedMedia");
    expect(dependencies).toContain("saveSitePageMediaAssignment");
    for (const source of [route, service, dependencies]) expect(source).not.toMatch(/California|20139|20114|668610|outdoor-digital-sphere|led-display-warehouse/);
  });
});