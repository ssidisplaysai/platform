import fs from "node:fs";
import path from "node:path";

describe("fresh-site generated page owner review", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SitePageReviewWorkflow.tsx"), "utf8");
  test("shows page content, SEO, links, images, quality, and traceability", () => {
    for (const text of ["SEO title", "Meta description", "H1", "Internal links", "Image requirements", "Factual traceability", "quality.blockers"]) expect(source).toContain(text);
  });
  test("supports page and site-level immutable review actions", () => {
    for (const text of ["APPROVE PAGE", "REQUEST CHANGES", "REGENERATE WITH INSTRUCTIONS", "APPROVE ALL READY PAGES", "REGENERATE AFFECTED PAGES"]) expect(source).toContain(text);
  });
  test("states that navigation is proposal-only and WordPress is not updated by review", () => {
    expect(source).toContain("No WordPress menu has been changed");
    expect(source).toContain("before any existing WordPress draft is updated");
  });
  test("shows the explicit exact-draft update action only after page review completes", () => {
    for (const text of ["Page Review Complete", "UPDATE WORDPRESS DRAFT CONTENT", "workspace.next.detail", "contentUpdateReady", "exact WordPress draft identities"]) expect(source).toContain(text);
    expect(source).toContain('onClick={() => act("UPDATE_WORDPRESS_DRAFT_CONTENT")}');
    expect(source).not.toContain('useEffect(() => { act("UPDATE_WORDPRESS_DRAFT_CONTENT")');
  });
});