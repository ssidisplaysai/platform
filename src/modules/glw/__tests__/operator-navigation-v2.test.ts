jest.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FOUNDATION_NAVIGATION_ITEMS } from "@/modules/foundation/navigation";
import { deriveOperatorNavigationSummary } from "../operator-navigation-summary";

describe("Genesis operator navigation V2", () => {
  test("uses the approved hierarchy without legacy global labels", () => {
    const labels = FOUNDATION_NAVIGATION_ITEMS.map((item) => item.label);
    expect(labels[0]).toBe("Dashboard");
    for (const label of ["Campaigns", "Targets", "Generated Pages", "Sites", "WordPress", "Research", "Media", "Products", "Executions", "Scheduler", "Settings", "Notifications", "Audit", "Help & Documentation"]) expect(labels).toContain(label);
    expect(labels).not.toContain("Mission Control");
    expect(labels).not.toContain("LED Display Warehouse");
    expect(FOUNDATION_NAVIGATION_ITEMS.find((item) => item.label === "Reports")?.disabled).toBe(true);
    expect(FOUNDATION_NAVIGATION_ITEMS.find((item) => item.label === "Profiles")?.group).toBe("MORE");
    expect(FOUNDATION_NAVIGATION_ITEMS.find((item) => item.label === "Enterprise Search")?.group).toBe("MORE");
  });

  test("derives global and site-scoped badges without hard-coded inventory values", () => {
    const campaigns = [
      { campaignId: "a", organizationId: "ssi", siteId: "projector" },
      { campaignId: "b", organizationId: "rj", siteId: "stainless" },
    ] as never;
    const targets = [
      { campaignId: "a", status: "draft_ready" },
      { campaignId: "a", status: "published" },
      { campaignId: "b", status: "queued" },
    ] as never;
    expect(deriveOperatorNavigationSummary({ campaigns, targets, organizationId: "rj", siteId: "stainless" })).toEqual({
      global: { campaigns: 2, targets: 3, generatedPagesRequiringReview: 1 },
      scoped: { campaigns: 1, targets: 1, generatedPagesRequiringReview: 0 },
      generatedPagesCountDefinition: "draft_ready campaign targets",
    });
  });

  test("preserves context and exposes all-sites, aggregate, accessible, and narrow navigation contracts", () => {
    const shell = readFileSync(join(process.cwd(), "src/components/layout/app-shell.tsx"), "utf8");
    const campaigns = readFileSync(join(process.cwd(), "src/app/glw/campaigns/page.tsx"), "utf8");
    const targets = readFileSync(join(process.cwd(), "src/app/glw/targets/page.tsx"), "utf8");
    expect(shell).toContain('new URLSearchParams({ scope: "all" })');
    expect(shell).toContain("effectiveOrganizationId");
    expect(shell).toContain("effectiveSiteId");
    expect(shell).toContain('aria-label="Primary operator navigation"');
    expect(shell).toContain('aria-current={active ? "page" : undefined}');
    expect(shell).toContain("focus-visible:ring-2");
    expect(shell).toContain("overflow-y-auto");
    expect(shell).toContain("truncate");
    expect(campaigns).toContain('first(params.scope) === "all"');
    expect(campaigns).toContain("Selected workspace");
    expect(targets).toContain('aria-label="Target filters"');
    expect(targets).not.toMatch(/method:\s*["']POST["']/);
  });
});