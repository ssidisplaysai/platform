import fs from "node:fs";
import path from "node:path";

const component=fs.readFileSync(path.join(process.cwd(),"src/modules/foundation/CommercialStainlessWave2Review.tsx"),"utf8");
const route=fs.readFileSync(path.join(process.cwd(),"src/app/sites/[siteId]/build/rich-composition-wave-2/page.tsx"),"utf8");

describe("Commercial Stainless Wave 2 owner review",()=>{
  test("renders the exact site-scoped five-page review surface",()=>{
    expect(route).toContain("COMMERCIAL_STAINLESS_SITE_ID");
    expect(route).toContain("COMMERCIAL_STAINLESS_WAVE_2_PATHS");
    for(const marker of ["Wave 2 owner review","Composition hash","Host preflight","Media policy","Desktop evidence","Mobile evidence","OWNER REVIEW ONLY"])expect(component).toContain(marker);
  });
  test("contains no mutation or publication action",()=>{
    expect(route).not.toMatch(/POST|savePersisted|writeGenesis|publishCommercial|stageCommercialStainlessWordPress/i);
    expect(component).not.toMatch(/<button|onClick|fetch\(/i);
    expect(component).toContain("No staging, Apply, Publish, Wave 3, or WordPress mutation action is exposed here.");
  });
});
