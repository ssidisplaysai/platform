import fs from "node:fs";
import path from "node:path";

describe("Site Detail workflow resume UI contract", () => {
  const page = fs.readFileSync(path.join(process.cwd(), "src/app/sites/[siteId]/page.tsx"), "utf8");

  test("separates technical state from canonical workflow progress", () => {
    for (const text of ["Technical Status", "Site Build Progress", "Genesis workflow status", "Next Step"]) expect(page).toContain(text);
    expect(page).toContain("workflow.stages.map");
    expect(page).toContain("resolveSiteWorkflowResume");
  });

  test("renders one canonical primary resume action and owner-friendly blockers", () => {
    expect(page).toContain("workflow.primaryAction.title");
    expect(page).toContain("workflow.primaryAction.description");
    expect(page).toContain("workflow.primaryAction.href");
    expect(page).toContain("workflow.primaryAction.label");
    expect(page).toContain("What remains");
  });

  test("reads Product Authority progress without mutating it", () => {
    expect(page).toContain("getSiteAuthorityWorkspace");
    expect(page).toContain("authorityWorkspace.progress.proposed");
    expect(page).toContain("authorityWorkspace.progress.approved");
    expect(page).toContain("authorityWorkspace.progress.needReview");
    expect(page).not.toContain("decideAuthorityCandidate");
    expect(page).not.toContain("createProduct");
  });

  test("keeps intelligence and administration secondary without generic onboarding competition", () => {
    expect(page).toContain('aria-label="Secondary site actions"');
    expect(page).toContain("View Site Intelligence");
    expect(page).not.toContain(">Continue Onboarding</Link>");
    expect(page).not.toContain(">Site Onboarding</Link>");
    expect(page).toContain("Site Settings");
    expect(page).toContain("Site Health");
  });

  test("preserves route-authoritative organization and site scope", () => {
    expect(page).toContain("resourceSite={createSiteContext(site)}");
    expect(page).toContain("organizationId: site.organizationId");
    expect(page).toContain("siteId: site.siteId");
  });
});