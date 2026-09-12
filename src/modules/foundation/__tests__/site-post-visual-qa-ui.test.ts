import fs from "node:fs";
import path from "node:path";

describe("post-visual approval Site QA UI", () => {
  const review = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SiteBuildWordPressDraftReview.tsx"), "utf8");
  const route = fs.readFileSync(path.join(process.cwd(), "src/app/sites/[siteId]/build/wordpress-review/page.tsx"), "utf8");
  const designsRoute = fs.readFileSync(path.join(process.cwd(), "src/app/sites/[siteId]/build/designs/page.tsx"), "utf8");

  test("removes stale Home and remaining-design continuation from WordPress Review", () => {
    expect(review).not.toContain("Review the designed Home");
    expect(review).not.toContain("blocked until approval");
    expect(route).not.toContain("SiteVisualPropagationAction");
    expect(route).toContain("All Site Designs Approved");
    expect(route).toContain("workspace.next.route");
  });

  test("shows the completed visual ladder and redirects completed design review to Site QA", () => {
    for (const label of ["WordPress Draft Review", "Site Visual Review", "Site QA"]) expect(review).toContain(label);
    expect(review).toContain('siteQaCurrent ? "COMPLETE" : "NEXT"');
    expect(designsRoute).toContain('workspace.stage === "SITE_QA"');
    expect(designsRoute).toContain("redirect(workspace.next.route)");
  });
});