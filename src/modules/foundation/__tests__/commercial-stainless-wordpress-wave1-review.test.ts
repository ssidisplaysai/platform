import fs from "node:fs";
import path from "node:path";

const component = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/CommercialStainlessWordPressWave1Review.tsx"), "utf8");
const route = fs.readFileSync(path.join(process.cwd(), "src/app/sites/[siteId]/build/rich-composition-wave-1-wordpress/page.tsx"), "utf8");

describe("Commercial Stainless actual WordPress Wave 1 review", () => {
  test("renders actual autosave HTML beside current public pages", () => {
    expect(route).toContain("renderCommercialStainlessWordPressStagedPage");
    expect(route).toContain("listCommercialStainlessWordPressStageRecords");
    for (const text of ["Approved compositions and public receipts", "Desktop evidence", "Mobile evidence", "Autosave", "Public body", "Rollback"]) expect(component).toContain(text);
  });

  test("shows authorized receipt-backed publication state without a Wave 2 action", () => {
    expect(component).not.toMatch(/<button|onClick|fetch\(/i);
    for (const text of ["PUBLICATION AUTHORIZED", 'receipt?.publishedAt ? "COMPLETED"', 'receipt?.status === "PUBLIC_CERTIFIED"', '"CERTIFIED" : "PENDING"', "REVIEW PUBLIC PAGE", "Wave 2 and Wave 3 remain locked"]) expect(component).toContain(text);
    expect(route).toContain("listCommercialStainlessWordPressPublicationReceipts");
    expect(route).not.toMatch(/POST|publishGenesis|writeGenesis|saveRecord/);
  });
});