import { load } from "cheerio";
import { applyLedDisplayWarehousePresentationAuthority, evaluateLedDisplayWarehousePresentation } from "../led-display-warehouse-presentation-authority";

const rejected = `<style>:root{color-scheme:light;--saw-paper:#f7f8f5;--saw-accent:#d8402f}.saw-product{padding:88px 0;background:#fff}.saw-applications{padding:88px 0;background:var(--saw-paper)}.saw-grid article{border:1px solid #ddd;background:#fff}.saw-plan-grid>div{border-top:3px solid var(--saw-ink)}.saw-cta{padding:82px 0;background:var(--saw-accent)}</style><main class="saw-page"><section class="saw-hero" data-reference-section="HERO"><img src="hero" data-media-role="PRODUCT_AUTHORITY"><h1>Outdoor Digital Sphere in Example</h1></section><section class="saw-product" data-reference-section="PRODUCT_IDENTITY"><div class="saw-media-frame"><img src="support" data-media-role="CONTEXTUAL_IN_USE"></div><p>Product identity copy.</p></section><section class="saw-applications" data-reference-section="APPLICATIONS"><div class="saw-wrap"><h2>Application ideas</h2><div class="saw-grid"><article><span>01</span><h3>Events</h3><p>Application copy.</p></article></div></div></section><section class="saw-planning" data-reference-section="PLANNING_GUIDANCE"><div class="saw-plan-grid"><div><strong>Location</strong><p>Planning copy.</p></div></div></section><section class="saw-cta" data-reference-section="CTA"><h2>Discuss a project</h2><a href="/contact-us/">Request Project Information</a></section></main>`;

describe("LED Display Warehouse presentation authority", () => {
  test("blocks the structural grammar missed by the previous visual certification", () => {
    const result = evaluateLedDisplayWarehousePresentation(rejected);
    expect(result).toMatchObject({ ok: false, checks: { excessiveEditorialWhitespace: true, thinBorderEditorialGridDominant: true, worksheetRuleGrammar: true, flatRedEditorialCtaDominant: true, commercialStainlessPresentationLeakage: true } });
    expect(result.blockers).toEqual(expect.arrayContaining(["LEDW_EXCESSIVE_EDITORIAL_WHITESPACE", "LEDW_THIN_BORDER_EDITORIAL_GRID", "LEDW_WORKSHEET_RULE_GRAMMAR", "LEDW_FLAT_RED_EDITORIAL_CTA", "LEDW_COMMERCIAL_STAINLESS_PRESENTATION_LEAKAGE"]));
  });

  test("applies the LEDW contract without changing customer copy or governed media URLs", () => {
    const before = load(rejected, null, false);
    before(".saw-grid article>span").remove();
    const beforeText = before(".saw-page").text().replace(/\s+/g, " ").trim();
    const result = applyLedDisplayWarehousePresentationAuthority({ contentHtml: rejected, applicationMedia: { url: "application", mediaId: "approved-application" } });
    const after = load(result.contentHtml, null, false);
    const afterText = after(".saw-page").text().replace(/\s+/g, " ").trim();
    expect(afterText).toBe(beforeText);
    expect(after('img[data-media-role="PRODUCT_AUTHORITY"]').attr("src")).toBe("hero");
    expect(after('img[data-media-role="CONTEXTUAL_IN_USE"]').attr("src")).toBe("support");
    expect(after('img[data-media-role="APPLICATION_EXPERIENCE"]').attr("src")).toBe("application");
    expect(result.evaluation).toMatchObject({ ok: true, checks: { darkHighContrastFoundation: true, blueElectricAccent: true, imageLedComposition: true, commercialDensity: true, excessiveEditorialWhitespace: false, thinBorderEditorialGridDominant: false, worksheetRuleGrammar: false, flatRedEditorialCtaDominant: false, commercialStainlessPresentationLeakage: false } });
  });
});