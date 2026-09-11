import fs from "node:fs";
import path from "node:path";

describe("bounded Site Build owner workspace", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SiteBuildWorkflow.tsx"), "utf8");
  test("shows the progress ladder, current next step, and progressive authority disclosure", () => {
    for (const text of ["Build Started", "Build Plan", "Draft Seeds", "Full Pages", "Owner Review", "WordPress Drafts", "Publication", "Current Next Step", "Advanced Details", "Authority used"]) expect(source).toContain(text);
    expect(source).toContain('publication ? "DISABLED"');
  });
  test("supports explicit plan review, revision instructions, local draft review, and WordPress handoff", () => {
    for (const text of ["APPROVE BUILD PLAN", "REQUEST CHANGES", "REJECT / RETURN", "What should Genesis change?", "GENERATE SITE DRAFTS", "APPROVE SITE DRAFTS", "CREATE WORDPRESS DRAFTS"]) expect(source).toContain(text);
  });
  test("shows requested changes and a four-way revision diff before full plan review", () => {
    for (const text of ["Requested changes", "Changes from Revision", "Added", "Removed", "Changed", "Unchanged"]) expect(source).toContain(text);
    expect(source.indexOf("Changes from Revision")).toBeLessThan(source.indexOf("plan.pages.map"));
  });
  test("does not expose publishing or automatic site activation actions", () => {
    expect(source).not.toContain("PUBLISH SITE"); expect(source).not.toContain("ENABLE SITE");
  });
  test("gates WordPress creation on authenticated read-only collision readiness", () => {
    expect(source).toContain("/site-build/wordpress-readiness");
    expect(source).toContain("!wordpressReadiness?.ready");
    expect(source).toContain("Authenticated WordPress access and collision preflight passed");
  });
  test("continues through local full-page review before exact WordPress content updates", () => {
    for (const text of ["GENERATE FULL PAGE CONTENT", "REVIEW GENERATED SITE", "UPDATE WORDPRESS DRAFT CONTENT"]) expect(source).toContain(text);
  });
});