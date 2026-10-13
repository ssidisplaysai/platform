import fs from "node:fs";
import path from "node:path";
import { createSiteContext } from "../context";
import type { SiteConfiguration } from "../types";

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("resource workspace context authority", () => {
  const shell = read("src/components/layout/app-shell.tsx");
  const detail = read("src/app/sites/[siteId]/page.tsx");
  const intelligence = read("src/app/sites/[siteId]/intelligence/page.tsx");
  const onboarding = read("src/app/sites/[siteId]/onboarding/page.tsx");
  const settings = read("src/app/sites/[siteId]/settings/page.tsx");
  const health = read("src/app/sites/[siteId]/health/page.tsx");
  const productAuthority = read("src/app/products/new/page.tsx");
  const workflowResume = read("src/modules/foundation/site-workflow-resume.ts");

  test("canonical site record maps all visible workspace identity and status fields", () => {
    const site = { siteId: "site-rj", slug: "commercial-stainless", organizationId: "rj-metal", displayName: "Commercial Stainless Counters", environment: "production", healthStatus: "healthy", publishingStatus: "not_ready", enabled: true } as SiteConfiguration;
    expect(createSiteContext(site)).toEqual({ id: "site-rj", slug: "commercial-stainless", organizationId: "rj-metal", name: "Commercial Stainless Counters", region: "US-CENTRAL", environment: "production", health: "healthy", publishing: "not_ready", enabled: true });
  });

  test("AppShell route resource overrides defaults and persisted/query restoration", () => {
    expect(shell).toContain("resourceSite?.organizationId ?? foundationContext.selectedOrganizationId");
    expect(shell).toContain("resourceSite?.id ?? foundationContext.selectedSiteId");
    expect(shell.match(/if \(resourceSite\) \{\s*return;/g)?.length).toBeGreaterThanOrEqual(3);
    expect(shell).toContain('window.location.href = `/sites/${encodeURIComponent(nextSite.siteId)}`');
    expect(shell).toContain('window.location.href = `/sites/${encodeURIComponent(nextSiteId)}`');
  });

  test("all directly addressed site routes pass canonical resource context", () => {
    for (const source of [detail, intelligence, onboarding, settings, health]) expect(source).toContain("resourceSite=");
    for (const source of [detail, intelligence, onboarding, settings, health]) expect(source).toContain("createSiteContext");
  });

  test("Site Detail downstream links preserve route organization and site", () => {
    for (const segment of ["intelligence", "settings", "health"]) expect(detail).toContain(`/sites/\${site.siteId}/${segment}?organizationId=\${encodeURIComponent(site.organizationId)}&siteId=\${encodeURIComponent(site.siteId)}`);
    expect(workflowResume).toContain('scoped(`/sites/${site.siteId}/onboarding`, site)');
  });

  test("Product Authority rejects mismatched query scope and binds matching site", () => {
    expect(productAuthority).toContain("site?.organizationId === organizationId");
    expect(productAuthority).toContain("resourceSite={scopedSite ? createSiteContext(scopedSite) : null}");
    expect(productAuthority).toContain("organizationId={scopedSite.organizationId}");
    expect(productAuthority).toContain("siteId={scopedSite.siteId}");
  });

  test("generic route behavior remains available when no resource site is supplied", () => {
    expect(shell).toContain("resourceSite = null");
    expect(shell).toContain("if (!resourceSite)");
    expect(shell).toContain("params.set(\"organizationId\", nextOrganizationId)");
    expect(shell).toContain("params.set(\"siteId\", nextSite.siteId)");
  });
});