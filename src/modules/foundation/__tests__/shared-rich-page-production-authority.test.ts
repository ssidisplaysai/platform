import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evaluateSharedRichPageInheritance,
  resolveSharedRichPageProductionProfile,
  richPageHostIntegrationCss,
  SHARED_RICH_PAGE_AUTHORITY_MANIFEST,
  SHARED_RICH_PAGE_PRODUCTION_AUTHORITY_VERSION,
} from "../shared-rich-page-production-authority";

describe("shared rich-page production authority", () => {
  test("binds Commercial Stainless and Indiana to one validated authority registry", () => {
    const stainless = resolveSharedRichPageProductionProfile({ organizationId: "rj-metal", siteId: "site-rj-metal-commercial-stainless-counters", productId: null, pageType: "HOME" });
    const indiana = resolveSharedRichPageProductionProfile({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", productId: "prod-outdoor-digital-sphere", pageType: "LOCATION_SERVICE" });

    expect(stainless).toMatchObject({ authorityVersion: SHARED_RICH_PAGE_PRODUCTION_AUTHORITY_VERSION, layout: { primaryWidth: 1240 }, media: { approvalImpliesHero: false, provenanceImpliesLocalContext: false } });
    expect(indiana).toMatchObject({ authorityVersion: SHARED_RICH_PAGE_PRODUCTION_AUTHORITY_VERSION, layout: { primaryWidth: 1280, mobileBreakpoint: 782 }, media: { explicitHeroRequired: true, approvalImpliesHero: false, provenanceImpliesLocalContext: false, localAtmosphereRequired: false } });
    expect(richPageHostIntegrationCss(indiana!)).toContain("GENESIS_RICH_PAGE_HOST_CONTAINMENT_V1".replace("GENESIS_RICH_PAGE_HOST_CONTAINMENT_V1", "genesis-rich-page-host"));
  });

  test("proves next-state profile reuse while failing closed on remaining shared-authority gaps", () => {
    const nextStateProfile = resolveSharedRichPageProductionProfile({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", productId: "prod-outdoor-digital-sphere", pageType: "LOCATION_SERVICE" });
    const inheritance = evaluateSharedRichPageInheritance(nextStateProfile);

    expect(inheritance.profileResolved).toBe(true);
    expect(inheritance.nextTargetRequiresNewArchitecture).toBe(false);
    expect(inheritance.nextTargetRequiresNewCode).toBe(true);
    expect(inheritance.sharedProductionPipelineComplete).toBe(false);
    expect(inheritance.missingSharedCapabilities).toEqual(expect.arrayContaining(["HERO_AUTHORITY", "NATIVE_TITLE_SUPPRESSION", "EXACT_PUBLICATION", "ROLLBACK"]));
  });

  test("does not claim unregistered future sites inherit a complete production pipeline", () => {
    for (const selector of [
      { organizationId: "screen-solutions-international", siteId: "site-ssi-production", productId: null, pageType: "LOCATION_SERVICE" },
      { organizationId: "projector-enclosure", siteId: "site-projector-enclosure-production", productId: null, pageType: "LOCATION_SERVICE" },
      { organizationId: "projection-mapping-supply", siteId: "site-projection-mapping-supply-production", productId: null, pageType: "LOCATION_SERVICE" },
    ]) {
      const inheritance = evaluateSharedRichPageInheritance(resolveSharedRichPageProductionProfile(selector));
      expect(inheritance).toMatchObject({ profileResolved: false, sharedProductionPipelineComplete: false, nextTargetRequiresNewArchitecture: true, nextTargetRequiresNewCode: true });
    }
  });

  test("prevents the proven consumers from silently replacing shared profile authority with local constants", () => {
    const stainless = readFileSync(join(process.cwd(), "src/modules/foundation/commercial-stainless-visual-composition.ts"), "utf8");
    const indiana = readFileSync(join(process.cwd(), "src/modules/glw/indiana-rich-reference-candidate.ts"), "utf8");
    const snapshot = readFileSync(join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/rich-reference-persistence/snapshot/route.ts"), "utf8");

    expect(stainless).toContain("resolveSharedRichPageProductionProfile");
    expect(indiana).toContain("INDIANA_RICH_PAGE_PROFILE");
    expect(snapshot).toContain("richPageHostIntegrationCss(PROFILE)");
    expect(Object.values(SHARED_RICH_PAGE_AUTHORITY_MANIFEST).filter((binding) => binding.state === "SHARED").length).toBeGreaterThanOrEqual(20);
  });
});
