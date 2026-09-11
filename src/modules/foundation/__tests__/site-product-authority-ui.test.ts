import fs from "node:fs";
import path from "node:path";

describe("site Product / Service Authority UI contract", () => {
  const page = fs.readFileSync(path.join(process.cwd(), "src/app/products/new/page.tsx"), "utf8");
  const workspace = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/SiteProductAuthorityWorkspace.tsx"), "utf8");
  const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/sites/[siteId]/product-authority/route.ts"), "utf8");

  test("replaces the API placeholder with a scoped owner workflow", () => {
    expect(page).toContain("SiteProductAuthorityWorkspace");
    expect(page).not.toContain("Use POST /api/products");
    for (const text of ["Product / Service Authority", "Site Sources of Truth", "Product / Service Candidates", "+ ADD URL", "+ UPLOAD SOURCE", "+ ADD OWNER KNOWLEDGE"]) expect(workspace).toContain(text);
  });

  test("supports editable classifications, authority decisions, source links, and completion", () => {
    for (const text of ["Product", "Service", "Product family", "Service family", "Display name", "Concise description", "Limitations, if any", "Supporting site sources", "YES — APPROVE FOR SITE", "YES, WITH LIMITATIONS", "NOT YET", "DO NOT OFFER", "CONTINUE TO SITE BUILD / GENERATION READINESS"]) expect(workspace).toContain(text);
    expect(workspace).toContain('action: "DECIDE_CANDIDATE"');
    expect(route).toContain("getSiteAuthorityWorkspace");
    expect(route).not.toContain("createProduct");
  });

  test("contains no campaign, WordPress, publication, or Launchpad dependency", () => {
    for (const forbidden of ["/api/glw/", "wp-json", "/publish", "PUBLISH", "/glw/campaigns"]) expect(workspace).not.toContain(forbidden);
    expect(route).not.toContain("createProduct");
  });
});