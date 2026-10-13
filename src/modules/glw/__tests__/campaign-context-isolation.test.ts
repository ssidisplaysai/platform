import fs from "node:fs";
import path from "node:path";
import { filterCampaignsForWorkspace, filterProductsForWorkspace, resolveCampaignWorkspace } from "../campaign-workspace-context";
import type { GlwCampaign } from "../campaign-types";

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

const sites = [
  { siteId: "site-led-display-warehouse-production", organizationId: "led-display-warehouse", displayName: "LEDDisplayWarehouse.com" },
  { siteId: "site-ssi-projectorenclosure", organizationId: "ssi", displayName: "ProjectorEnclosure.com" },
  { siteId: "site-ssi-screen-solutions-international", organizationId: "ssi", displayName: "SSI Displays" },
] as const;

const campaigns: readonly GlwCampaign[] = [
  {
    campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2",
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    productId: "prod-led",
    name: "Indoor LED Sphere - 50 State Overview",
    pageType: "state_service",
    stateCodes: ["TX"],
    pagesPerDay: 10,
    publicationPolicy: "draft_only",
    imageRequired: true,
    status: "active",
    completedTargetCount: 0,
    failedTargetCount: 0,
    createdAt: "2030-01-01T00:00:00.000Z",
    updatedAt: "2030-01-01T00:00:00.000Z",
  },
  {
    campaignId: "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-texas-cities",
    organizationId: "ssi",
    siteId: "site-ssi-projectorenclosure",
    productId: "prod-ssi",
    name: "Fan Cooled Projector Enclosures Texas Cities",
    pageType: "city_service",
    stateCodes: ["TX"],
    cityTargets: [{ stateCode: "TX", citySlug: "san-antonio", cityName: "San Antonio" }],
    pagesPerDay: 10,
    publicationPolicy: "draft_only",
    imageRequired: true,
    status: "active",
    completedTargetCount: 0,
    failedTargetCount: 0,
    createdAt: "2030-01-01T00:00:00.000Z",
    updatedAt: "2030-01-01T00:00:00.000Z",
  },
];

describe("GLW organization/site context isolation", () => {
  test("direct SSI + ProjectorEnclosure URL resolves valid site under active organization", () => {
    const resolution = resolveCampaignWorkspace({
      sites: sites as never,
      requestedOrganizationId: "ssi",
      requestedSiteId: "site-ssi-projectorenclosure",
    });

    expect(resolution.organizationId).toBe("ssi");
    expect(resolution.requestedSiteValid).toBe(true);
    expect(resolution.resolvedSiteId).toBe("site-ssi-projectorenclosure");
  });

  test("switching from LEDW context to SSI clears mismatched stale site fail-closed", () => {
    const resolution = resolveCampaignWorkspace({
      sites: sites as never,
      requestedOrganizationId: "ssi",
      requestedSiteId: "site-led-display-warehouse-production",
    });

    expect(resolution.organizationId).toBe("ssi");
    expect(resolution.requestedSiteValid).toBe(false);
    expect(resolution.resolvedSiteId).toBe("site-ssi-projectorenclosure");
  });

  test("campaign inventory is filtered to active organization and active site", () => {
    const visible = filterCampaignsForWorkspace({
      campaigns,
      organizationId: "ssi",
      siteId: "site-ssi-projectorenclosure",
      allSites: false,
    });

    expect(visible.map((item) => item.campaignId)).toEqual([
      "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-texas-cities",
    ]);
  });

  test("invalid site for active organization is rejected while valid site is retained", () => {
    const invalid = resolveCampaignWorkspace({
      sites: sites as never,
      requestedOrganizationId: "ssi",
      requestedSiteId: "site-led-display-warehouse-production",
    });
    const valid = resolveCampaignWorkspace({
      sites: sites as never,
      requestedOrganizationId: "ssi",
      requestedSiteId: "site-ssi-screen-solutions-international",
    });

    expect(invalid.requestedSiteValid).toBe(false);
    expect(valid.requestedSiteValid).toBe(true);
    expect(valid.resolvedSiteId).toBe("site-ssi-screen-solutions-international");
  });

  test("no cross-org campaign or product leakage in non-all-sites workspace", () => {
    const visibleCampaigns = filterCampaignsForWorkspace({
      campaigns,
      organizationId: "ssi",
      siteId: "site-ssi-projectorenclosure",
      allSites: false,
    });

    const visibleProducts = filterProductsForWorkspace({
      products: [
        { productId: "prod-led", organizationId: "led-display-warehouse" },
        { productId: "prod-ssi", organizationId: "ssi" },
      ],
      organizationId: "ssi",
      allSites: false,
    });

    expect(visibleCampaigns.every((item) => item.organizationId === "ssi")).toBe(true);
    expect(visibleCampaigns.every((item) => item.siteId === "site-ssi-projectorenclosure")).toBe(true);
    expect(visibleProducts).toEqual([{ productId: "prod-ssi", organizationId: "ssi" }]);
  });

  test("campaign manager resets stale draft fields when workspace changes", () => {
    const manager = read("src/modules/glw/GlwCampaignManager.tsx");
    expect(manager).toContain("workspaceRef.current === nextWorkspace");
    expect(manager).toContain("setName(\"\")");
    expect(manager).toContain("setProductId(\"\")");
    expect(manager).toContain("setGeographyMode(\"ALL_STATES\")");
    expect(manager).toContain("setSelectedStateCodes([])");
    expect(manager).toContain("setSelectedCityIdentities([])");
    expect(manager).toContain("setOperatorSummaries(initialOperatorSummaries)");
  });

  test("campaigns page binds validated resolved site context into manager", () => {
    const page = read("src/app/glw/campaigns/page.tsx");
    expect(page).toContain("resolveCampaignWorkspace");
    expect(page).toContain("siteId={resolvedSiteId}");
    expect(page).toContain("filterCampaignsForWorkspace");
    expect(page).toContain("filterProductsForWorkspace");
  });
});
