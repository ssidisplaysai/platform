jest.mock("server-only", () => ({}));

import { auditCommercialStainlessWave1Diversity, COMMERCIAL_STAINLESS_APPROVED_DESIGN_REFERENCE_SHA, COMMERCIAL_STAINLESS_WAVE_1_PATHS, createCommercialStainlessRemainingPageProfileMap, stageCommercialStainlessWave1 } from "../commercial-stainless-wave1-rollout";
import { inventoryCommercialStainlessPages } from "../commercial-stainless-rich-composition";

const definitions = [
  [10, "Home", "/", "HOME"], [11, "Capabilities", "/capabilities/", "CAPABILITIES"], [12, "Commercial Stainless Counters", "/commercial-stainless-counters/", "CATEGORY"], [13, "Commercial Worktables & Prep Tables", "/commercial-worktables-and-prep-tables/", "OFFERING"], [14, "Design-Build Fabrication", "/design-build-fabrication/", "OFFERING"], [15, "Mobile & Modular Stainless Workstations", "/mobile-and-modular-stainless-workstations/", "OFFERING"], [16, "Stainless Countertops", "/stainless-countertop/", "OFFERING"], [17, "Education Solutions", "/markets/education/", "MARKET"], [18, "Foodservice Solutions", "/markets/foodservice/", "MARKET"], [19, "Healthcare Solutions", "/markets/healthcare/", "MARKET"], [20, "Hospitality Solutions", "/markets/hospitality/", "MARKET"], [21, "Industrial Solutions", "/markets/industrial/", "MARKET"], [22, "Labs Solutions", "/markets/labs/", "MARKET"], [23, "About", "/about/", "ABOUT"], [24, "Request a Quote", "/request-a-quote/", "CONTACT"],
] as const;

const paths = definitions.map(([, , path]) => path);
const pages = definitions.map(([id, name, canonicalPath, pageRole]) => ({
  pageId: `page-${id}`,
  pageRevisionId: `page-${id}-revision`,
  name,
  canonicalPath,
  pageRole,
  h1: `${name} approved H1`,
  seoTitle: `${name} | Commercial Stainless Counters`,
  metaDescription: `${name} approved meta description.`,
  sections: [
    { heading: "Hero", presentation: "HERO", body: ["Approved page-specific introduction."] },
    { heading: "Where this fits", presentation: "PROSE", body: ["Approved application and operating context."] },
    { heading: "Information to gather", presentation: "STEPS", body: ["Approved dimensions, drawings, photographs, interfaces, and schedule guidance."] },
    { heading: "Coordinate the requirement", presentation: "GRID", body: ["Approved equipment, utilities, access, traffic flow, and delivery context."] },
    { heading: "Planning guidance", presentation: "FAQ", body: ["Approved decision-support guidance."] },
    { heading: "Request a Quote", presentation: "CTA", body: ["Approved project conversation next step."] },
  ],
  internalLinks: paths.filter((path) => path !== canonicalPath).slice(0, 6).map((href) => ({ href, anchorText: href })),
})) as never[];
const visuals = definitions.map(([id]) => ({ pageId: `page-${id}`, wordpressObjectId: String(id), wordpressMediaId: String(21 + id * 2), wordpressMediaUrl: `https://commercialstainlesscounters.com/wp-content/uploads/2026/09/media-${id}.jpg`, imageProvenance: "GENERATED_VISUAL", referenceClassification: "OWNER_SUPPLIED_REFERENCE" })) as never[];
const inventory = inventoryCommercialStainlessPages({ pages, visuals });
const shell = (path: string) => `<!doctype html><html><head><title>Current</title><meta name="description" content="Current"><link rel="canonical" href="https://commercialstainlesscounters.com${path}"></head><body class="wp-site"><div class="wp-site-blocks"><header class="wp-block-template-part"><nav aria-label="Genesis CSC Approved Navigation V1">Approved global navigation</nav></header><main><div class="gvs-header"><nav class="gvs-nav">Legacy body navigation</nav></div><h1>Current H1</h1></main><footer class="wp-block-template-part">Approved global footer</footer></div></body></html>`;
const publicHtmlByPath = Object.fromEntries(COMMERCIAL_STAINLESS_WAVE_1_PATHS.map((path) => [path, shell(path)]));

describe("Commercial Stainless controlled Wave 1", () => {
  const profileMap = createCommercialStainlessRemainingPageProfileMap(inventory);
  const stages = stageCommercialStainlessWave1({ pages, inventory, publicHtmlByPath });

  test("locks the approved proof and maps all remaining 14 pages before staging", () => {
    expect(COMMERCIAL_STAINLESS_APPROVED_DESIGN_REFERENCE_SHA).toBe("d86c133510b7848865308dfc2b51e20b754192c9");
    expect(profileMap).toHaveLength(14);
    expect(Object.fromEntries(["LANDING_CONVERSION", "CAPABILITY", "PRODUCT_SERVICE", "INDUSTRY_APPLICATION", "RESOURCE"].map((profile) => [profile, profileMap.filter((item) => item.targetProfile === profile).length]))).toEqual({ LANDING_CONVERSION: 2, CAPABILITY: 1, PRODUCT_SERVICE: 4, INDUSTRY_APPLICATION: 6, RESOURCE: 1 });
    expect(profileMap.filter((item) => item.wave === "WAVE_1")).toHaveLength(5);
    expect(profileMap.filter((item) => item.wave === "WAVE_2").map((item) => item.wordpressObjectId)).toEqual(["12", "15", "16", "18", "19"]);
    expect(profileMap.filter((item) => item.wave === "WAVE_3").map((item) => item.wordpressObjectId)).toEqual(["20", "21", "22"]);
    expect(profileMap.find((item) => item.wave === "PRESERVE_HOME")?.wordpressObjectId).toBe("10");
  });

  test("stages exactly one representative for every profile without WordPress or publication mutation", () => {
    expect(stages).toHaveLength(5);
    expect(stages.map((stage) => new URL(stage.page.url).pathname)).toEqual([...COMMERCIAL_STAINLESS_WAVE_1_PATHS]);
    expect(new Set(stages.map((stage) => stage.targetProfile))).toEqual(new Set(["LANDING_CONVERSION", "CAPABILITY", "PRODUCT_SERVICE", "INDUSTRY_APPLICATION", "RESOURCE"]));
    for (const stage of stages) expect(stage).toMatchObject({ status: "READY_FOR_OWNER_REVIEW", stagingMode: "LOCAL_PREVIEW_EQUIVALENT", wordpressMutation: false, publicationMutation: false, canonicalPreserved: true, urlPreserved: true, indexabilityPreserved: true });
  });

  test("preserves exact SEO and shell authority while removing body navigation", () => {
    for (const stage of stages) {
      expect(stage.seoHashAfter).toBe(stage.seoHashBefore);
      expect(stage.proposedHtml.match(/<header\b/g)).toHaveLength(1);
      expect(stage.proposedHtml.match(/<footer\b/g)).toHaveLength(1);
      expect(stage.proposedHtml.match(/<h1\b/g)).toHaveLength(1);
      expect(stage.proposedHtml).toContain('class="wp-block-template-part"');
      expect(stage.proposedHtml).not.toMatch(/gvs-header|gvs-nav|Legacy body navigation/);
      expect(stage.proposedHtml).toContain(`<link rel="canonical" href="${stage.page.currentCanonical}">`);
      expect(stage.proposedHtml).toContain('<meta name="description" content="');
    }
  });

  test("uses only approved media authority with meaningful image metadata", () => {
    const approvedUrls = new Set(inventory.map((item) => item.currentMedia.url));
    for (const stage of stages) {
      expect(stage.media.length).toBeGreaterThan(0);
      expect(stage.media.every((item) => approvedUrls.has(item.url))).toBe(true);
      expect(stage.proposedHtml).toMatch(/<img[^>]+alt="[^"]+"[^>]+title="[^"]+"/);
      expect(stage.proposedHtml).toContain('data-media-role="PRIMARY_HERO"');
      expect(stage.proposedHtml).not.toMatch(/actual (?:customer|Rocklin Metal) (?:project|installation)/i);
    }
  });

  test("keeps all contextual links canonical, reachable in the approved graph, and free of dev URLs", () => {
    const validPaths = new Set(paths);
    for (const stage of stages) {
      expect(stage.links.length).toBeGreaterThan(2);
      expect(stage.links.every((link) => validPaths.has(link))).toBe(true);
      expect(stage.page.currentInternalLinks.every((link) => stage.links.includes(link.href))).toBe(true);
      expect(stage.proposedHtml).not.toMatch(/localhost|127\.0\.0\.1|\.test\//i);
    }
  });

  test("demonstrates composition rather than five cloned templates", () => {
    expect(auditCommercialStainlessWave1Diversity(stages)).toEqual({ heroVariantCount: 5, sectionSequenceVariantCount: 5, mediaLayoutVariantCount: 5, ctaPlacementVariantCount: 5 });
  });
});