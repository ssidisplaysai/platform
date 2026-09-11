import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("Generation Readiness owner workflow UI", () => {
  const workflow = read("src/modules/foundation/SiteGenerationReadinessWorkflow.tsx");
  const page = read("src/app/sites/[siteId]/generation-readiness/page.tsx");
  const buildPage = read("src/app/sites/[siteId]/build/page.tsx");
  const build = read("src/modules/foundation/SiteBuildWorkflow.tsx");

  test("explains draft generation separately from publication and avoids an enum dump", () => {
    for (const text of ["Final checks before Genesis builds the site", "allows draft site generation; it does not enable publication", "READY TO BUILD", "ACTION REQUIRED", "Publication remains disabled"]) expect(workflow).toContain(text);
    for (const group of ["FOUNDATION", "DIRECTION", "CONTENT_AUTHORITY", "BUILD_SAFETY"]) expect(workflow).toContain(group);
  });

  test("requires explicit certification and exposes exact source-authority counts", () => {
    expect(workflow).toContain("CERTIFY GENERATION READINESS"); expect(workflow).toContain("CERTIFY_GENERATION_READINESS");
    for (const text of ["Approved factual sources", "Owner-attested authority", "Evidence-verified authority", "Reference-only sources", "Publishable assets", "Non-publishable references"]) expect(workflow).toContain(text);
  });

  test("binds route authority and keeps Site Build a separate explicit action", () => {
    expect(page).toContain("resourceSite={createSiteContext(site)}"); expect(page).toContain("getSiteGenerationReadiness(site)");
    expect(buildPage).toContain("resourceSite={createSiteContext(site)}"); expect(buildPage).toContain("getSiteBuildWorkspace(site)");
    expect(build).toContain("START SITE BUILD"); expect(build).toContain("START_SITE_BUILD"); expect(build).toContain("does not create WordPress pages");
  });
});