import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("FL theme title suppression repair route", () => {
  test("is exact-scope, draft-only, and suppresses only scoped theme title", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/app/api/glw/campaigns/[campaignId]/theme-title-suppression-repair/route.ts",
      ),
      "utf8",
    );

    expect(source).toContain('REQUIRED_CANONICAL_PATH = "outdoor-digital-sphere/florida"');
    expect(source).toContain('REQUIRED_WORDPRESS_OBJECT_ID = "20163"');
    expect(source).toContain('confirm !== "REPAIR_THEME_TITLE_SUPPRESSION"');
    expect(source).toContain("target.stateCode !== \"FL\"");
    expect(source).toContain("target.pageType !== \"state_service\"");
    expect(source).toContain('visualCertificationExpectedState: "STALE"');
    expect(source).toContain(".page-title.the-title{display:none!important}");
    expect(source).toContain("publicationPerformed: false");
  });
});
