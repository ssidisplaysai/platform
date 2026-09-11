import { HOME_HERO_MEDIA_TOKEN, renderCommercialStainlessHome } from "../site-home-visual-assembly";

describe("commercial stainless Home visual assembly", () => {
  test("preserves approved copy while applying reusable reference-inspired components", () => {
    const page = { pageId: "home", h1: "Commercial Stainless Counters and custom stainless fabrication", sections: Array.from({ length: 8 }, (_, index) => ({ heading: `Approved heading ${index + 1}`, body: [`Approved paragraph ${index + 1}`] })), internalLinks: [{ href: "/commercial-worktables/", anchorText: "Commercial Worktables" }, { href: "/stainless-countertops/", anchorText: "Stainless Countertops" }, { href: "/design-build/", anchorText: "Design-Build Fabrication" }, { href: "/mobile-workstations/", anchorText: "Mobile Workstations" }, { href: "/education/", anchorText: "Education" }, { href: "/foodservice/", anchorText: "Foodservice" }, { href: "/healthcare/", anchorText: "Healthcare" }, { href: "/hospitality/", anchorText: "Hospitality" }] } as never;
    const html = renderCommercialStainlessHome({ page, navigation: [{ label: "Products & Solutions", href: "/commercial-stainless-counters/", children: [] }] as never, wordpressObjectId: "10" });
    expect(html).toContain(page.h1); for (const section of page.sections) for (const paragraph of section.body) expect(html).toContain(paragraph);
    for (const className of ["gva-header", "gva-hero", "gva-strip", "gva-grid", "gva-split", "gva-cta", "gva-footer"]) expect(html).toContain(className);
    expect(html).toContain(HOME_HERO_MEDIA_TOKEN); expect(html).toContain(".page-id-10 .entry-title"); expect(html).toContain("Powered by Rocklin Metal");
    for (const prohibited of ["Walmart", "Safeway", "Whole Foods", "Costco", "Target", "Albertsons", "Sprouts", "50 states", "nationwide", "partner network", "1,000 locations"]) expect(html).not.toContain(prohibited);
  });
});