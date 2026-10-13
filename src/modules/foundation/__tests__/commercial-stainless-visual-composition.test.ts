import { buildCommercialStainlessCompositionRevision, COMMERCIAL_STAINLESS_COMPOSITION_VERSION, COMMERCIAL_STAINLESS_PRIMARY_WIDTH, renderCommercialStainlessComposition } from "../commercial-stainless-visual-composition";
import { assertCommercialStainlessPostWriteIdentity, isExactLegacyCommercialStainlessComposition } from "../commercial-stainless-composition-repair";
import type { SiteGeneratedPageRevision, SiteNavigationItem } from "../site-page-generation";

const navigation: SiteNavigationItem[] = [
  { label: "Commercial Stainless Counters", href: "/commercial-stainless-counters/", children: [] },
  { label: "Products & Solutions", href: "/commercial-stainless-counters/", children: [{ label: "Commercial Worktables & Prep Tables", href: "/commercial-worktables-and-prep-tables/" }, { label: "Design-Build Fabrication", href: "/design-build-fabrication/" }, { label: "Mobile & Modular Stainless Workstations", href: "/mobile-and-modular-stainless-workstations/" }, { label: "Stainless Countertops", href: "/stainless-countertop/" }] },
  { label: "Industries", href: "/markets/education/", children: ["Education", "Foodservice", "Healthcare", "Hospitality", "Industrial", "Labs"].map((label) => ({ label, href: `/markets/${label.toLowerCase()}/` })) },
  { label: "Capabilities", href: "/capabilities/", children: [] }, { label: "About", href: "/about/", children: [] }, { label: "Request a Quote", href: "/request-a-quote/", children: [] },
];
const page = { pageRevisionId: "home-generation-5", pageId: "home", revision: 5, status: "APPROVED", requestedChanges: null, name: "Home", slug: "home", canonicalPath: "/", pageRole: "HOME", seoTitle: "Commercial Stainless", metaDescription: "Commercial stainless", openGraphTitle: "Commercial Stainless", openGraphDescription: "Commercial stainless", h1: "Commercial Stainless Counters and custom stainless fabrication", sections: [
  { sectionId: "1", heading: "Commercial Stainless Counters and custom stainless fabrication", level: 2, presentation: "HERO", body: ["Commercial Stainless Counters connects businesses and organizations with commercial stainless solutions.", "Bring the application, dimensions, drawings, and project context."] },
  { sectionId: "2", heading: "Commercial stainless products and fabrication solutions", level: 2, presentation: "GRID", body: ["Evaluate approved product and service pathways."] },
  { sectionId: "3", heading: "Central pathway", level: 2, presentation: "PROSE", body: ["Define the application."] },
  { sectionId: "4", heading: "Solutions for commercial industries", level: 2, presentation: "GRID", body: ["Explore approved industry pathways."] },
  { sectionId: "5", heading: "A fabrication approach built around the requirement", level: 2, presentation: "STEPS", body: ["Start with the commercial need."] },
  { sectionId: "6", heading: "Fabrication proof and project detail", level: 2, presentation: "PROSE", body: ["Review fabrication options in project context."] },
  { sectionId: "7", heading: "Why commercial buyers use this resource", level: 2, presentation: "GRID", body: ["Evaluate multiple solutions through one architecture."] },
  { sectionId: "8", heading: "Request a Quote", level: 2, presentation: "CTA", body: ["Share the intended application and known constraints."] },
], contentHtml: "old", internalLinks: [], imageRequirements: [], authority: [], quality: { ready: true, blockers: [], warnings: [], checks: {} }, contentFingerprint: "a".repeat(64), createdAt: "2026-09-12T00:00:00.000Z", createdBy: "owner", decidedAt: "2026-09-12T00:00:00.000Z", decidedBy: "owner" } as SiteGeneratedPageRevision;

describe("Commercial Stainless visual composition", () => {
  it("builds an intentional wide composition from existing authority", () => {
    const html = renderCommercialStainlessComposition({ page, navigation, wordpressObjectId: "10", mediaUrl: "https://commercialstainlesscounters.com/media/home.jpg" });
    expect(COMMERCIAL_STAINLESS_COMPOSITION_VERSION).toBe("commercial-stainless-composition-v2");
    expect(COMMERCIAL_STAINLESS_PRIMARY_WIDTH).toBe(1240);
    expect((html.match(/<h1\b/g) ?? [])).toHaveLength(1);
    expect((html.match(/home\.jpg/g) ?? [])).toHaveLength(1);
    expect(html).toContain(".wp-block-post-featured-image{display:none!important}");
    expect(html).toContain("width:100%!important;max-width:100%!important;margin-left:0!important;margin-right:0!important;padding:0!important");
    expect(html).toContain("width:100%;max-width:none;margin:0;overflow:hidden");
    expect(html).toContain("grid-template-columns:55fr 45fr");
    expect(html).toContain("grid-template-columns:repeat(3,1fr)");
    expect(html).toContain("@media(max-width:1024px)");
    expect(html).toContain("@media(max-width:768px)");
    expect(html).toContain("@media(max-width:520px)");
    for (const path of navigation.flatMap((item) => [item.href, ...item.children.map((child) => child.href)])) expect(html).toContain(`href="${path}"`);
    expect(html).not.toMatch(/customer|certified|projects completed|nationwide service/i);
  });

  it("creates a distinct approved page revision without changing SEO or canonical identity", () => {
    const revised = buildCommercialStainlessCompositionRevision({ page, navigation, wordpressObjectId: "10", mediaUrl: "https://commercialstainlesscounters.com/media/home.jpg", actor: "platform_admin", now: "2026-09-13T00:00:00.000Z" });
    expect(revised).toMatchObject({ pageId: page.pageId, pageRevisionId: "home-composition-6", revision: 6, status: "APPROVED", canonicalPath: "/", seoTitle: page.seoTitle, metaDescription: page.metaDescription, h1: page.h1 });
    expect(revised.contentFingerprint).not.toBe(page.contentFingerprint);
  });

  it("fails closed when exact page or navigation authority is absent", () => {
    expect(() => renderCommercialStainlessComposition({ page, navigation, wordpressObjectId: "11", mediaUrl: "https://commercialstainlesscounters.com/media/home.jpg" })).toThrow("COMMERCIAL_STAINLESS_HOME_IDENTITY_MISMATCH");
    expect(() => renderCommercialStainlessComposition({ page, navigation: navigation.filter((item) => item.label !== "Industries"), wordpressObjectId: "10", mediaUrl: "https://commercialstainlesscounters.com/media/home.jpg" })).toThrow("COMMERCIAL_STAINLESS_NAVIGATION_AUTHORITY_MISSING");
  });

  it("requires published status and preserves object, slug, title, template, media, and SEO identity", () => {
    const before = { id: 10, slug: "home", status: "publish", title: "Commercial Stainless", featuredMediaId: "41", template: "", metaHash: "a".repeat(64), contentHash: "b".repeat(64) };
    const after = { ...before, contentHash: "c".repeat(64) };
    expect(() => assertCommercialStainlessPostWriteIdentity({ before, after, expectedContentHash: after.contentHash })).not.toThrow();
    for (const changed of [{ status: "draft" }, { id: 11 }, { slug: "other" }, { featuredMediaId: "42" }, { metaHash: "d".repeat(64) }]) expect(() => assertCommercialStainlessPostWriteIdentity({ before, after: { ...after, ...changed }, expectedContentHash: after.contentHash })).toThrow("COMPOSITION_REPAIR_POST_WRITE_IDENTITY_MISMATCH");
  });

  it("accepts only the exact known legacy composition during rollback recovery", () => {
    const input = { html: `<div class="gva-home"><h1>${page.h1}</h1><img src="https://commercialstainlesscounters.com/media/home.jpg"><a href="/about/">About</a></div>`, expectedH1: page.h1, mediaUrl: "https://commercialstainlesscounters.com/media/home.jpg", navigationPaths: ["/about/"] };
    expect(isExactLegacyCommercialStainlessComposition(input)).toBe(true);
    expect(isExactLegacyCommercialStainlessComposition({ ...input, html: input.html.replace("gva-home", "gvc-page") })).toBe(false);
    expect(isExactLegacyCommercialStainlessComposition({ ...input, html: input.html.replace("/about/", "/other/") })).toBe(false);
    expect(isExactLegacyCommercialStainlessComposition({ ...input, html: input.html.replace(page.h1, "Different") })).toBe(false);
  });
});