import fs from "node:fs";
import path from "node:path";

describe("site intelligence UI contract", () => {
  const workspace = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SiteIntelligenceWorkspace.tsx"), "utf8");
  const onboarding = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/FreshSiteOnboardingFlow.tsx"), "utf8");
  const route = fs.readFileSync(path.join(process.cwd(), "src/app/sites/[siteId]/intelligence/page.tsx"), "utf8");

  test("completed onboarding recommends intelligence before product authority", () => {
    expect(onboarding).toContain("START SITE INTELLIGENCE");
    expect(onboarding).toContain("Expert bypass");
    expect(onboarding.indexOf("START SITE INTELLIGENCE")).toBeLessThan(onboarding.indexOf("Add Product by URL"));
  });

  test("real identity transition preserves internal ID and public brand", () => {
    expect(route).toContain("getIntegrationProfileById");
    expect(route).toContain("brandProfile?.organizationId === site?.organizationId");
    expect(route).not.toContain('site.organizationId === "rj-metal"');
    expect(workspace).toContain("Internal organization");
    expect(workspace).toContain("Public brand");
  });

  test("workspace exposes intelligence, strategy, creative and approval controls", () => {
    for (const text of ["Opportunity Board", "APPROVE INTELLIGENCE", "Site Strategy", "Creative Inputs", "Creative Direction", "Product authority boundary"]) expect(workspace).toContain(text);
    for (const decision of ["RESEARCH_MORE", "HOLD", "REJECTED", "APPROVED", "VERIFIED", "QUALIFIED", "FUTURE_CAPABILITY"]) expect(workspace).toContain(decision);
  });

  test("workspace exposes real multiple-file upload with conservative classification", () => {
    expect(workspace).toContain('type="file"'); expect(workspace).toContain("multiple"); expect(workspace).toContain("UPLOAD FILES");
    expect(workspace).toContain('useState<SiteAssetClassification>("OWNER_SUPPLIED_REFERENCE")');
    expect(workspace).toContain("Uploaded Assets"); expect(workspace).toContain("Not publishable");
  });

  test("workspace has no campaign, product creation, generation, or WordPress mutation endpoint", () => {
    expect(workspace).not.toContain("/api/glw/");
    expect(workspace).not.toContain("/api/products");
    expect(workspace).not.toContain("wp-json");
    expect(workspace).toContain("Generation remains disabled in V1");
    expect(onboarding).toContain('useState<SitePublicationPolicy>("draft_only")');
  });
});