import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evaluateNextGlwStateProductionUnblock,
  evaluateSharedRichPageInheritance,
  NEXT_GLW_STATE_SITE_SPECIFIC_RECHECK,
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
    expect(inheritance.missingSharedCapabilities).toEqual(expect.arrayContaining(["HERO_AUTHORITY", "FEATURED_MEDIA_SUPPRESSION", "SEMANTIC_LINKS"]));
    expect(inheritance.missingSharedCapabilities).not.toEqual(expect.arrayContaining(["EXACT_PUBLICATION", "ROLLBACK"]));
    expect(inheritance.missingSharedCapabilities).not.toContain("NATIVE_TITLE_SUPPRESSION");
  });

  test("distinguishes reusable target inputs from missing next-state mechanisms", () => {
    const profile = resolveSharedRichPageProductionProfile({ organizationId: "led-display-warehouse", siteId: "site-led-display-warehouse-production", productId: "prod-outdoor-digital-sphere", pageType: "LOCATION_SERVICE" });
    const result = evaluateNextGlwStateProductionUnblock(profile);

    expect(NEXT_GLW_STATE_SITE_SPECIFIC_RECHECK).toEqual({
      HERO_AUTHORITY: "SHARED_MECHANISM_WITH_SITE_SPECIFIC_INPUT",
      FEATURED_MEDIA_SUPPRESSION: "SHARED_MECHANISM_WITH_SITE_SPECIFIC_INPUT",
      SEMANTIC_LINKS: "SHARED_MECHANISM_WITH_SITE_SPECIFIC_INPUT",
      EXACT_PUBLICATION: "SHARED_MECHANISM_WITH_SITE_SPECIFIC_INPUT",
      ROLLBACK: "SHARED_MECHANISM_WITH_SITE_SPECIFIC_INPUT",
    });
    expect(result).toMatchObject({
      profileResolved: true,
      nativeTitleSuppressionRequired: false,
      nativeTitleSuppressionSharedMechanismReady: true,
      targetParameterizedRichReferenceOrchestrationReady: true,
      nextTargetRequiresNewArchitecture: false,
      nextTargetRequiresNewCode: false,
      draftProductionReady: true,
      publicationProductionReady: true,
      productionReady: true,
    });
    expect(result.remainingNewCodeRequirements).toEqual([]);
    expect(result.publicationBoundaryRequirements).toEqual([]);
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
