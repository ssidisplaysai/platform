import fs from "node:fs";
import path from "node:path";

describe("bounded Site Build owner workspace", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SiteBuildWorkflow.tsx"), "utf8");
  test("shows the progress ladder, current next step, and progressive authority disclosure", () => {
    for (const text of ["Build Started", "Build Plan", "Draft Generation", "Review", "WordPress Drafts", "Publication", "Current Next Step", "Advanced Details", "Authority used"]) expect(source).toContain(text);
    expect(source).toContain('publication ? "DISABLED"');
  });
  test("supports explicit plan review, revision instructions, local draft review, and WordPress handoff", () => {
    for (const text of ["APPROVE BUILD PLAN", "REQUEST CHANGES", "REJECT / RETURN", "What should Genesis change?", "GENERATE SITE DRAFTS", "APPROVE SITE DRAFTS", "CREATE WORDPRESS DRAFTS"]) expect(source).toContain(text);
  });
  test("does not expose publishing or automatic site activation actions", () => {
    expect(source).not.toContain("PUBLISH SITE"); expect(source).not.toContain("ENABLE SITE");
  });
});