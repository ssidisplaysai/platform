import fs from "node:fs";
import path from "node:path";

const component = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/CommercialStainlessRichCompositionReview.tsx"), "utf8");
const route = fs.readFileSync(path.join(process.cwd(), "src/app/sites/[siteId]/build/rich-composition-review/page.tsx"), "utf8");

describe("Commercial Stainless rich composition owner review", () => {
  test("is exact-site scoped and exposes comparison at all required widths", () => {
    expect(route).toContain("COMMERCIAL_STAINLESS_SITE_ID");
    for (const width of ["1440", "1024", "768", "375"]) expect(component).toContain(width);
    for (const text of ["Current Public Page", "Proposed Rich Composition", "Desktop Comparison", "Mobile Comparison", "Owner Review Stop"]) expect(component).toContain(text);
  });

  test("has no mutation, publication, media generation, or bulk rollout controls", () => {
    expect(route).not.toMatch(/POST|writeGenesis|attachGenesis|saveSite|updateSite|publish/i);
    expect(component).not.toMatch(/onClick|fetch\(|<button/i);
    expect(component).toContain("No Apply or bulk rollout control exists");
  });

  test("shows preservation, provenance, inventory, and remaining-page planning", () => {
    for (const text of ["SEO hash", "Canonical", "Header/footer", "Existing media reused", "Links retained", "15-page profile inventory", "Remaining 14-page rollout plan"]) expect(component).toContain(text);
  });
});