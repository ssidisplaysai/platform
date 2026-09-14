import fs from "node:fs";
import path from "node:path";

const component = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/CommercialStainlessWordPressWave1Review.tsx"), "utf8");
const route = fs.readFileSync(path.join(process.cwd(), "src/app/sites/[siteId]/build/rich-composition-wave-1-wordpress/page.tsx"), "utf8");

describe("Commercial Stainless actual WordPress Wave 1 review", () => {
  test("renders actual autosave HTML beside current public pages", () => {
    expect(route).toContain("renderCommercialStainlessWordPressStagedPage");
    expect(route).toContain("listCommercialStainlessWordPressStageRecords");
    for (const text of ["Wave 1 actual autosave renders", "Desktop evidence", "Mobile evidence", "Autosave", "Public body", "Rollback"]) expect(component).toContain(text);
  });

  test("has no publication or mutation control", () => {
    expect(component).not.toMatch(/<button|onClick|fetch\(/i);
    expect(component).toContain("PUBLICATION UNAVAILABLE");
    expect(component).toContain("Publication remains unauthorized");
    expect(route).not.toMatch(/POST|publishGenesis|writeGenesis|saveRecord/);
  });
});