jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("GLW cold-start persistence durability", () => {
  const originalPersistence = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  const originalSessionPersistence = process.env.GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR;
  let root = "";

  const expandedCityTargets = [
    { stateCode: "TX", citySlug: "austin", cityName: "Austin" },
    { stateCode: "TX", citySlug: "dallas", cityName: "Dallas" },
    { stateCode: "TX", citySlug: "houston", cityName: "Houston" },
    { stateCode: "TX", citySlug: "san-antonio", cityName: "San Antonio" },
    { stateCode: "TX", citySlug: "fort-worth", cityName: "Fort Worth" },
    { stateCode: "TX", citySlug: "el-paso", cityName: "El Paso" },
    { stateCode: "TX", citySlug: "arlington", cityName: "Arlington" },
    { stateCode: "TX", citySlug: "corpus-christi", cityName: "Corpus Christi" },
    { stateCode: "TX", citySlug: "plano", cityName: "Plano" },
    { stateCode: "TX", citySlug: "lubbock", cityName: "Lubbock" },
    { stateCode: "TX", citySlug: "laredo", cityName: "Laredo" },
  ] as const;

  beforeEach(() => {
    jest.resetModules();
    root = mkdtempSync(join(tmpdir(), "glw-cold-start-durability-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root;
    process.env.GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR = root;
  });

  afterEach(() => {
    if (originalPersistence === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalPersistence;

    if (originalSessionPersistence === undefined) delete process.env.GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR;
    else process.env.GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR = originalSessionPersistence;

    rmSync(root, { recursive: true, force: true });
  });

  test("persisted site and city campaign survive two cold module reloads", async () => {
    const sitesFirst = await import("@/modules/foundation/site-repository");
    const campaignsFirst = await import("@/modules/glw/campaign-repository");
    const selectionsFirst = await import("@/modules/glw/reference-state-selection-repository");

    const createdSite = sitesFirst.createSite({
      organizationId: "ssi",
      siteName: "ProjectorEnclosure Durable",
      displayName: "ProjectorEnclosure Durable",
      slug: "projectorenclosure-durable",
      domain: "projectorenclosure.com",
      primaryAddress: null,
      canonicalUrl: "https://projectorenclosure.com",
      environment: "production",
      enabled: true,
      publicationPolicy: "draft_only",
      defaultContentType: "article",
      defaultPublicationStatus: "draft",
      defaultAuthorReference: null,
      defaultCategoryReferences: [],
      integrations: {
        wordpressApiBaseUrl: "https://projectorenclosure.com/wp-json",
        wordpressCredentialReference: "cred-ssi-projectorenclosure",
        workflowReference: null,
      },
      profiles: {
        promptProfileReference: null,
        imageProfileReference: null,
        seoProfileReference: null,
        brandProfileReference: null,
        analyticsProfileReference: null,
      },
      notes: null,
    });
    expect(createdSite.validation.valid).toBe(true);
    const siteId = createdSite.site?.siteId;
    expect(siteId).toBe("site-ssi-projectorenclosure-durable");
    const expectedEnabled = createdSite.site?.enabled;
    const expectedLifecycle = createdSite.site?.lifecycleState;

    const touchedSite = sitesFirst.updateSite(siteId!, {
      notes: "cold-start-durability",
    });
    expect(touchedSite.validation.valid).toBe(true);

    const createdCampaign = campaignsFirst.createGlwCampaign({
      organizationId: "ssi",
      siteId: siteId!,
      productId: "prod-ssi-fan-cooled-projector-enclosures",
      name: "Fan Cooled Projector Enclosures Texas Expanded Cities",
      pageType: "city_service",
      stateCodes: ["TX"],
      cityTargets: expandedCityTargets,
      pagesPerDay: 10,
      publicationPolicy: "draft_only",
      imageRequired: true,
    });

    expect(createdCampaign.errors).toEqual([]);
    const campaignId = createdCampaign.campaign?.campaignId;
    expect(campaignId).toContain("campaign-ssi-");
    expect(campaignId).toContain("fan-cooled-projector-enclosures-texas-expanded-cities");

    selectionsFirst.saveGlwReferenceStateSelection({
      campaignId: campaignId!,
      organizationId: "ssi",
      siteId: siteId!,
      stateCode: "TX",
      citySlug: "austin",
      selectedBy: "test-owner",
      selectedAt: "2030-01-01T00:00:00.000Z",
    });

    jest.resetModules();

    const sitesReload1 = await import("@/modules/foundation/site-repository");
    const campaignsReload1 = await import("@/modules/glw/campaign-repository");
    const selectionsReload1 = await import("@/modules/glw/reference-state-selection-repository");

    const persistedSite1 = sitesReload1.getSiteById(siteId!);
    expect(persistedSite1?.organizationId).toBe("ssi");
    expect(persistedSite1?.domain).toBe("projectorenclosure.com");
    expect(persistedSite1?.enabled).toBe(expectedEnabled);
    expect(persistedSite1?.lifecycleState).toBe(expectedLifecycle);

    const persistedCampaign1 = campaignsReload1.listGlwCampaigns().find((item) =>
      item.campaignId === campaignId,
    );
    expect(persistedCampaign1).toBeTruthy();
    expect(persistedCampaign1?.organizationId).toBe("ssi");
    expect(persistedCampaign1?.siteId).toBe(siteId!);
    expect(persistedCampaign1?.publicationPolicy).toBe("draft_only");
    expect(persistedCampaign1?.pageType).toBe("city_service");
    expect(persistedCampaign1?.stateCodes).toEqual(["TX"]);
    expect(persistedCampaign1?.cityTargets).toHaveLength(11);

    const persistedSelection1 = selectionsReload1.getGlwReferenceStateSelection(campaignId!);
    expect(persistedSelection1).toMatchObject({ stateCode: "TX", citySlug: "austin" });

    jest.resetModules();

    const sitesReload2 = await import("@/modules/foundation/site-repository");
    const campaignsReload2 = await import("@/modules/glw/campaign-repository");

    const persistedSite2 = sitesReload2.getSiteById(siteId!);
    expect(persistedSite2?.siteId).toBe(siteId!);

    const persistedCampaign2 = campaignsReload2.listGlwCampaigns().find((item) =>
      item.campaignId === campaignId,
    );
    expect(persistedCampaign2?.cityTargets).toHaveLength(11);
  });

  test("workspace resolution remains fail-closed for invalid cross-org site and preserves valid SSI site after cold reload", async () => {
    const sitesFirst = await import("@/modules/foundation/site-repository");
    const campaignsFirst = await import("@/modules/glw/campaign-repository");
    const context = await import("@/modules/glw/campaign-workspace-context");

    const ssiSite = sitesFirst.createSite({
      organizationId: "ssi",
      siteName: "ProjectorEnclosure Durable",
      displayName: "ProjectorEnclosure Durable",
      slug: "projectorenclosure-durable-workspace",
      domain: "projectorenclosure.com",
      primaryAddress: null,
      canonicalUrl: "https://projectorenclosure.com",
      environment: "production",
      enabled: true,
      publicationPolicy: "draft_only",
      defaultContentType: "article",
      defaultPublicationStatus: "draft",
      defaultAuthorReference: null,
      defaultCategoryReferences: [],
      integrations: { wordpressApiBaseUrl: null, wordpressCredentialReference: null, workflowReference: null },
      profiles: { promptProfileReference: null, imageProfileReference: null, seoProfileReference: null, brandProfileReference: null, analyticsProfileReference: null },
      notes: null,
    });
    expect(ssiSite.validation.valid).toBe(true);

    const ledSite = sitesFirst.createSite({
      organizationId: "led-display-warehouse",
      siteName: "LED Durable",
      displayName: "LED Durable",
      slug: "led-durable-workspace",
      domain: "leddisplaywarehouse.com",
      primaryAddress: null,
      canonicalUrl: "https://leddisplaywarehouse.com",
      environment: "production",
      enabled: true,
      publicationPolicy: "draft_only",
      defaultContentType: "article",
      defaultPublicationStatus: "draft",
      defaultAuthorReference: null,
      defaultCategoryReferences: [],
      integrations: { wordpressApiBaseUrl: null, wordpressCredentialReference: null, workflowReference: null },
      profiles: { promptProfileReference: null, imageProfileReference: null, seoProfileReference: null, brandProfileReference: null, analyticsProfileReference: null },
      notes: null,
    });
    expect(ledSite.validation.valid).toBe(true);

    const ssiSiteId = ssiSite.site?.siteId as string;
    const ledSiteId = ledSite.site?.siteId as string;

    campaignsFirst.createGlwCampaign({
      organizationId: "ssi",
      siteId: ssiSiteId,
      productId: "prod-ssi-fan-cooled-projector-enclosures",
      name: "Fan Cooled Projector Enclosures Texas Cities",
      pageType: "city_service",
      stateCodes: ["TX"],
      cityTargets: [{ stateCode: "TX", citySlug: "austin", cityName: "Austin" }],
      pagesPerDay: 5,
      publicationPolicy: "draft_only",
      imageRequired: true,
    });

    campaignsFirst.createGlwCampaign({
      organizationId: "led-display-warehouse",
      siteId: ledSiteId,
      productId: "prod-outdoor-digital-sphere",
      name: "Indoor LED Sphere - 50 State Overview",
      pageType: "state_service",
      stateCodes: ["TX"],
      pagesPerDay: 5,
      publicationPolicy: "draft_only",
      imageRequired: true,
    });

    jest.resetModules();

    const sitesReload = await import("@/modules/foundation/site-repository");
    const campaignsReload = await import("@/modules/glw/campaign-repository");
    const reloadedContext = await import("@/modules/glw/campaign-workspace-context");

    const allSites = sitesReload.listSites().map((site) => ({
      siteId: site.siteId,
      organizationId: site.organizationId,
      displayName: site.displayName,
    }));

    const invalid = reloadedContext.resolveCampaignWorkspace({
      sites: allSites,
      requestedOrganizationId: "ssi",
      requestedSiteId: ledSiteId,
    });

    const valid = reloadedContext.resolveCampaignWorkspace({
      sites: allSites,
      requestedOrganizationId: "ssi",
      requestedSiteId: ssiSiteId,
    });

    expect(invalid.requestedSiteValid).toBe(false);
    expect(valid.requestedSiteValid).toBe(true);
    expect(valid.resolvedSiteId).toBe(ssiSiteId);

    const visibleSsi = reloadedContext.filterCampaignsForWorkspace({
      campaigns: campaignsReload.listGlwCampaigns(),
      organizationId: "ssi",
      siteId: ssiSiteId,
      allSites: false,
    });

    expect(visibleSsi.every((campaign) => campaign.organizationId === "ssi")).toBe(true);
    expect(visibleSsi.every((campaign) => campaign.siteId === ssiSiteId)).toBe(true);
    expect(visibleSsi.some((campaign) => campaign.organizationId === "led-display-warehouse")).toBe(false);
  });
});
