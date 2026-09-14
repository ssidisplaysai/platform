import fs from "node:fs";
import path from "node:path";

const component = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/CommercialStainlessWave1Review.tsx"), "utf8");
const route = fs.readFileSync(path.join(process.cwd(), "src/app/sites/[siteId]/build/rich-composition-wave-1/page.tsx"), "utf8");

describe("Commercial Stainless Wave 1 owner review route", () => {
  test("is exact-site scoped and renders all five profile comparisons", () => {
    expect(route).toContain("COMMERCIAL_STAINLESS_SITE_ID");
    expect(route).toContain("COMMERCIAL_STAINLESS_WAVE_1_PATHS");
    for (const text of ["Wave 1 owner review", "Desktop before / after", "Mobile before / after", "Remaining 14-page profile map", "Wave 2 Plan Only", "Wave 3 Plan Only", "Homepage Preservation", "Owner Review Required"]) expect(component).toContain(text);
  });

  test("contains no action or mutation surface", () => {
    expect(route).not.toMatch(/POST|writeGenesis|saveSite|updateSite|publishGenesis|attachGenesis/i);
    expect(component).not.toMatch(/<button|onClick|fetch\(/i);
    expect(component).toContain("No Apply, Publish, Wave 2, or WordPress action is available");
  });

  test("shows SEO, media, profile, diversity, and staging evidence", () => {
    for (const text of ["Approved reference", "Profiles covered", "WordPress mutation", "Hero variants", "Section sequences", "Media layouts", "CTA placements", "SEO", "Media", 'stage.status.replaceAll("_", " ")']) expect(component).toContain(text);
  });
});