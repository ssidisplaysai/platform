import fs from "node:fs";
import path from "node:path";

describe("multi-site list view contract", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/modules/foundation/MultiSiteListView.tsx"),
    "utf8",
  );

  test("loads persisted registry data through bounded site and organization APIs", () => {
    expect(source).toContain('fetch("/api/sites"');
    expect(source).toContain('fetch("/api/organizations?status=active"');
    expect(source).not.toContain("listFoundationSitesForContext");
    expect(source).not.toContain("CompanyRepository.getAll()");
  });

  test("provides explicit resume onboarding action for incomplete sites", () => {
    expect(source).toContain("Resume Onboarding (Step");
    expect(source).toContain("/onboarding?organizationId=");
    expect(source).toContain("isOnboardingResumable(site)");
    expect(source).toContain("resolveOnboardingResumeStep(site)");
  });
});

