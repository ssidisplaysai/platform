jest.mock("server-only", () => ({}));

import { COMMERCIAL_STAINLESS_RICH_COMPOSITION_VERSION, classifyCommercialStainlessPage, createCommercialStainlessRolloutPlan, extractCommercialStainlessPublicShell, inventoryCommercialStainlessPages, renderDesignBuildRichComposition } from "../commercial-stainless-rich-composition";

const definitions = [
  [10, "Home", "/", "HOME"], [11, "Capabilities", "/capabilities/", "CAPABILITIES"], [12, "Commercial Stainless Counters", "/commercial-stainless-counters/", "CATEGORY"], [13, "Commercial Worktables & Prep Tables", "/commercial-worktables-and-prep-tables/", "OFFERING"], [14, "Design-Build Fabrication", "/design-build-fabrication/", "OFFERING"], [15, "Mobile & Modular Stainless Workstations", "/mobile-and-modular-stainless-workstations/", "OFFERING"], [16, "Stainless Countertops", "/stainless-countertop/", "OFFERING"], [17, "Education Solutions", "/markets/education/", "MARKET"], [18, "Foodservice Solutions", "/markets/foodservice/", "MARKET"], [19, "Healthcare Solutions", "/markets/healthcare/", "MARKET"], [20, "Hospitality Solutions", "/markets/hospitality/", "MARKET"], [21, "Industrial Solutions", "/markets/industrial/", "MARKET"], [22, "Labs Solutions", "/markets/labs/", "MARKET"], [23, "About", "/about/", "ABOUT"], [24, "Request a Quote", "/request-a-quote/", "CONTACT"],
] as const;
const pages = definitions.map(([id, name, canonicalPath, pageRole]) => ({ pageId: `page-${id}`, pageRevisionId: `page-${id}-revision`, name, canonicalPath, pageRole, h1: id === 14 ? "Design-Build Fabrication for demanding commercial workflows" : `${name} H1`, seoTitle: `${name} | Commercial Stainless Counters`, metaDescription: `${name} approved meta description.`, sections: [{ heading: "Hero", presentation: "HERO", body: ["Approved hero copy grounded in the current page."] }, { heading: "Where this solution fits", presentation: "PROSE", body: ["Approved solution-fit copy."] }, { heading: "Information to gather", presentation: "STEPS", body: ["Record dimensions, drawings, photographs, equipment interfaces, and schedule."] }, { heading: "Coordinate", presentation: "GRID", body: ["Coordinate utilities, equipment, access, traffic flow, and delivery path."] }, { heading: "FAQ", presentation: "FAQ", body: ["Approved FAQ copy."] }, { heading: "Request a Quote", presentation: "CTA", body: ["Share the project requirement for a useful quote conversation."] }], internalLinks: id === 14 ? ["/commercial-stainless-counters/", "/markets/education/", "/markets/foodservice/", "/markets/healthcare/", "/request-a-quote/"].map((href) => ({ href, anchorText: href })) : [{ href: "/request-a-quote/", anchorText: "Request a Quote" }] })) as never[];
const visuals = definitions.map(([id]) => ({ pageId: `page-${id}`, wordpressObjectId: String(id), wordpressMediaId: String(21 + id * 2), wordpressMediaUrl: `https://commercialstainlesscounters.com/wp-content/uploads/2026/09/media-${id}.jpg`, imageProvenance: "GENERATED_VISUAL", referenceClassification: "OWNER_SUPPLIED_REFERENCE" })) as never[];
const publicShellHtml = '<!doctype html><html><head><title>Current</title><meta name="description" content="Current meta"><link rel="canonical" href="https://commercialstainlesscounters.com/design-build-fabrication/"></head><body class="wp-site"><div class="wp-site-blocks"><header class="wp-block-template-part"><nav aria-label="Genesis CSC Approved Navigation V1">Approved global navigation</nav></header><main>Legacy body</main><footer class="wp-block-template-part"><nav aria-label="Approved footer navigation">Approved global footer</nav></footer></div></body></html>';
const publicShell = extractCommercialStainlessPublicShell(publicShellHtml);

describe("Commercial Stainless rich composition preview", () => {
  const inventory = inventoryCommercialStainlessPages({ pages, visuals });
  const preview = renderDesignBuildRichComposition({ page: pages.find((page: { canonicalPath: string }) => page.canonicalPath === "/design-build-fabrication/") as never, inventory, publicShell });

  test("inventories the exact 15 WordPress objects and classifies page-specific profiles", () => {
    expect(inventory).toHaveLength(15);
    expect(inventory.map((item) => item.wordpressObjectId)).toEqual(definitions.map(([id]) => String(id)));
    expect(classifyCommercialStainlessPage({ pageRole: "OFFERING", canonicalPath: "/design-build-fabrication/" } as never)).toBe("DESIGN_BUILD");
    expect(inventory.filter((item) => item.recommendedNewProfile === "INDUSTRY_APPLICATION")).toHaveLength(6);
  });

  test("renders only Design-Build as a wide reusable preview with one global shell", () => {
    expect(preview.version).toBe(COMMERCIAL_STAINLESS_RICH_COMPOSITION_VERSION);
    expect(preview.page.wordpressObjectId).toBe("14");
    expect(preview.geometry).toMatchObject({ currentCanvasWidth: 645, proposedCanvasWidth: 1240, currentHeaderToContentGap: 785.19, proposedHeaderToHeroGap: 0, breakpoints: [1440, 1024, 768, 375] });
    expect(preview.html.match(/<header\b/g)).toHaveLength(1);
    expect(preview.html.match(/<footer\b/g)).toHaveLength(1);
    expect(preview.html).toContain(publicShell.headerHtml);
    expect(preview.html).toContain(publicShell.footerHtml);
    expect(preview.html).not.toContain("<main>Legacy body</main>");
    expect(preview.html).not.toMatch(/gvs-header|gvs-footer|Draft visual navigation/);
    for (const marker of ["csc-hero", "csc-benefits", "csc-card-grid", "csc-process", "csc-split", "csc-industry-grid", "csc-inputs", "csc-final-cta", "Request a Quote", "Explore Capabilities"]) expect(preview.html).toContain(marker);
    for (const label of ["Commercial Grade", "Custom Fabrication", "Project-Focused", "Nationwide Service"]) expect(preview.html).toContain(label);
  });

  test("preserves SEO, canonical, links, and approved media without mutation surfaces", () => {
    expect(preview.seoHashAfter).toBe(preview.seoHashBefore);
    expect(preview.page.currentCanonical).toBe("https://commercialstainlesscounters.com/design-build-fabrication/");
    expect(preview.html).toContain('<link rel="canonical" href="https://commercialstainlesscounters.com/design-build-fabrication/">');
    expect(preview.html).toContain('<meta name="description" content="Design-Build Fabrication approved meta description.">');
    for (const href of ["/commercial-stainless-counters/", "/markets/education/", "/markets/foodservice/", "/markets/healthcare/", "/request-a-quote/"]) expect(preview.preservedLinks).toContain(href);
    expect(preview.media.length).toBeGreaterThan(8);
    expect(preview).toMatchObject({ previewOnly: true, wordpressMutation: false, publicationMutation: false, campaignMutation: false });
    expect(preview.html).not.toMatch(/localhost|127\.0\.0\.1|wp-json|fetch\(|XMLHttpRequest|Apply All/i);
  });

  test("creates a 14-page rollout plan without including the proof page", () => {
    const rollout = createCommercialStainlessRolloutPlan(inventory);
    expect(rollout).toHaveLength(14);
    expect(rollout.some((item) => item.canonicalPath === "/design-build-fabrication/")).toBe(false);
    expect(rollout.find((item) => item.canonicalPath === "/")?.specialConsiderations).toContain("Homepage must remain unchanged");
  });
});