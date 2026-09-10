import fs from "node:fs";
import path from "node:path";
import { findFreshSiteCollision } from "../fresh-site-create-mode";
import type { SiteConfiguration } from "../types";

const existingSite = {
  siteId: "site-ssi-screen-solutions-international",
  displayName: "SSI Displays",
  domain: "ssidisplays.com",
} as SiteConfiguration;

describe("fresh site create mode", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/modules/foundation/FreshSiteOnboardingFlow.tsx"),
    "utf8",
  );
  const route = fs.readFileSync(
    path.join(process.cwd(), "src/app/sites/new/page.tsx"),
    "utf8",
  );

  test("the new route uses create mode and never mounts the legacy hydration form", () => {
    expect(route).toContain("FreshSiteOnboardingFlow");
    expect(route).not.toContain("SiteCreateFoundationForm");
    expect(source).not.toMatch(/discoverExistingSite|Existing site loaded|applyOnboardingPreset/);
  });

  test("identity starts blank while organization and production environment may default", () => {
    expect(source).toContain('useState(organizations[0]?.id ?? "")');
    expect(source).toContain('const [siteName, setSiteName] = useState("")');
    expect(source).toContain('const [displayName, setDisplayName] = useState("")');
    expect(source).toContain('const [domain, setDomain] = useState("")');
    expect(source).toContain('useState<SiteEnvironment>("production")');
    expect(source).toContain('cleanDomain ? `https://${cleanDomain}/wp-json/wp/v2` : ""');
  });

  test("detects domain and generated identity collisions without hydrating the form", () => {
    expect(findFreshSiteCollision({
      sites: [existingSite],
      prospectiveSiteId: "site-ssi-new-site",
      domain: "SSIDisplays.com",
    })).toEqual(existingSite);
    expect(findFreshSiteCollision({
      sites: [existingSite],
      prospectiveSiteId: existingSite.siteId,
      domain: "another.example",
    })).toEqual(existingSite);
    expect(findFreshSiteCollision({
      sites: [existingSite],
      prospectiveSiteId: "site-ssi-new-site",
      domain: "new.example",
    })).toBeNull();
    expect(source).toContain("SITE_ALREADY_EXISTS");
    expect(source).toContain("The create form remains unchanged.");
  });

  test("preserves the five create stages including Location", () => {
    for (const label of ["Site Details", "Location", "WordPress", "Connect", "Complete"]) {
      expect(source).toContain(label);
    }
    expect(source).toContain("saveLocation");
    expect(source).toContain("setStep(3)");
  });

  test("opening create mode contains no WordPress or campaign mutation calls", () => {
    expect(source).not.toContain("onboarding-test-page");
    expect(source).not.toContain("/api/glw/campaign-launch");
    expect(source).not.toMatch(/localStorage|sessionStorage/);
  });
});