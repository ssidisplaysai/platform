import fs from "node:fs";
import path from "node:path";

describe("fresh-site onboarding UI contract", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/modules/foundation/FreshSiteOnboardingFlow.tsx"),
    "utf8",
  );
  const page = fs.readFileSync(
    path.join(process.cwd(), "src/app/sites/new/page.tsx"),
    "utf8",
  );
  const profileCreator = fs.readFileSync(
    path.join(process.cwd(), "src/modules/foundation/OnboardingProfileCreator.tsx"),
    "utf8",
  );

  test("exposes the native Add New Site fresh-site flow", () => {
    expect(page).toContain("FreshSiteOnboardingFlow");
    expect(source).toContain("Add New Site");
    expect(source).toContain("Fresh WordPress Site");
    expect(source).toContain("Existing WordPress Site");
    expect(source).toContain("Site Name");
    expect(source).toContain("Organization");
    expect(source).toContain("Domain");
    expect(source).toContain("Generated Site ID");
  });

  test("masks credentials and never uses browser storage", () => {
    expect(source).toContain('type="password"');
    expect(source).toContain("Application Password");
    expect(source).not.toMatch(/localStorage|sessionStorage/);
  });

  test("uses read-only assessment and contains no WordPress publication action", () => {
    expect(source).toContain("onboarding-assessment");
    expect(source).not.toContain("onboarding-test-page");
    expect(source).not.toMatch(/publishGenesisTestPage|Publish Genesis Test Page/);
  });

  test("provides both product handoffs and keeps Launchpad locked", () => {
    expect(source).toContain("Add Product by URL");
    expect(source).toContain("Manual / Source-Based Product");
    expect(source).toContain("Campaign Launchpad unlocks after a product is READY");
    expect(source).not.toContain("/api/glw/campaign-launch");
  });

  test("shows bounded loading states for each network transition", () => {
    expect(source).toContain("Checking...");
    expect(source).toContain("Creating...");
    expect(source).toContain("Storing...");
    expect(source).toContain("Testing...");
    expect(source).toContain("Saving...");
  });

  test("assessment persists only mutable site fields", () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/sites/[siteId]/onboarding-assessment/route.ts"),
      "utf8",
    );
    const updateCall = route.slice(route.indexOf("const updated = updateSite"));
    expect(updateCall).toContain("lifecycleState: connectedSite.lifecycleState");
    expect(updateCall).not.toContain("updateSite(existing.siteId, connectedSite)");
  });

  test("offers only bounded publication policies with draft-only default", () => {
    expect(source).toContain('useState<SitePublicationPolicy>("draft_only")');
    expect(source).toContain("Fresh-site onboarding remains Draft Only.");
    expect(source).not.toContain('value="publish_after_gates"');
    expect(source).not.toMatch(/direct_publish|publish_immediately/);
  });

  test("provides organization-locked creation beside all required profile categories", () => {
    expect(source).toContain("OnboardingProfileCreator");
    expect(source).toContain('profileType="workflow"');
    for (const type of ["seo", "prompt", "image", "brand"]) {
      expect(source).toContain(`type: "${type}"`);
    }
    expect(profileCreator).toContain("Create Another");
    expect(profileCreator).toContain("Create ${input.profileLabel}");
    expect(profileCreator).toContain("Organization");
    expect(profileCreator).toContain("disabled");
  });

  test("profile creation uses onboarding scope and has no campaign or WordPress mutation", () => {
    expect(profileCreator).toContain('"x-gcp-organization-id": input.organizationId');
    expect(profileCreator).toContain('fetch("/api/profiles"');
    expect(profileCreator).not.toContain("/api/glw/");
    expect(profileCreator).not.toContain("wp-json");
    expect(profileCreator).not.toMatch(/localStorage|sessionStorage/);
  });

  test("ready created profiles are added and selected through the organization guard", () => {
    expect(source).toContain("applyCreatedOnboardingProfile");
    expect(source).toContain("setProfiles(result.profiles)");
    expect(source).toContain("setSelectedProfiles(result.selection)");
    expect(source).toContain("filterReadyOnboardingProfiles");
  });
});