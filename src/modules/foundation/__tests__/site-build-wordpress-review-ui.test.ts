import fs from "node:fs";
import path from "node:path";

describe("WordPress draft review workspace UI", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SiteBuildWordPressDraftReview.tsx"), "utf8");
  test("shows all owner review fields and safe review actions", () => {
    for (const text of ["WordPress Draft Review", "WordPress object", "Last synchronized revision", "Sync status", "VIEW WORDPRESS DRAFT", "VIEW GENESIS APPROVED VERSION", "COMPARE / VERIFY", "may require the owner to sign in"]) expect(source).toContain(text);
  });
  test("keeps media, navigation, QA, and publication boundaries explicit", () => {
    for (const text of ["Media Sync Required", "Site QA", "REVIEW ONLY", "Publication stays disabled", "WordPress Content Update", "CURRENT", "NEXT"]) expect(source).toContain(text);
    expect(source).not.toContain("PUBLISH SITE");
  });
});