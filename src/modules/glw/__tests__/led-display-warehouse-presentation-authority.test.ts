import { load } from "cheerio";
import { applyLedDisplayWarehousePresentationAuthority, evaluateLedDisplayWarehousePresentation } from "../led-display-warehouse-presentation-authority";

const rejected = `<style>:root{color-scheme:light;--saw-paper:#f7f8f5;--saw-accent:#d8402f}.saw-product{padding:88px 0;background:#fff}.saw-applications{padding:88px 0;background:var(--saw-paper)}.saw-grid article{border:1px solid #ddd;background:#fff}.saw-plan-grid>div{border-top:3px solid var(--saw-ink)}.saw-cta{padding:82px 0;background:var(--saw-accent)}</style><main class="saw-page"><section class="saw-hero" data-reference-section="HERO"><img src="hero" data-media-role="PRODUCT_AUTHORITY"><h1>Outdoor Digital Sphere in Example</h1></section><section class="saw-product" data-reference-section="PRODUCT_IDENTITY"><div class="saw-media-frame"><img src="support" data-media-role="CONTEXTUAL_IN_USE"></div><p>Product identity copy.</p></section><section class="saw-applications" data-reference-section="APPLICATIONS"><div class="saw-wrap"><h2>Application ideas</h2><div class="saw-grid"><article><span>01</span><h3>Events</h3><p>Application copy.</p></article></div></div></section><section class="saw-planning" data-reference-section="PLANNING_GUIDANCE"><div class="saw-plan-grid"><div><strong>Location</strong><p>Planning copy.</p></div></div></section><section class="saw-cta" data-reference-section="CTA"><div class="saw-cta-inner"><p class="saw-kicker">Start</p><h2>Discuss a project</h2><p>Project copy.</p><a class="saw-button" href="/contact-us/">Request Project Information</a></div></section></main>`;

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
    const result = applyLedDisplayWarehousePresentationAuthority(rejected);
    const after = load(result.contentHtml, null, false);
    const afterText = after(".saw-page").text().replace(/\s+/g, " ").trim();
    expect(afterText).toBe(beforeText);
    expect(after('img[data-media-role="PRODUCT_AUTHORITY"]').attr("src")).toBe("hero");
    expect(after('img[data-media-role="CONTEXTUAL_IN_USE"]').attr("src")).toBe("support");
    expect(after("img")).toHaveLength(2);
    expect(after("style").text()).toContain("width:min(1360px,calc(100% - 32px))");
    expect(after("style").text()).toContain(".saw-applications h2,.saw-planning h2{color:var(--ledw-ink)!important}");
    expect(after("style").text()).toContain(".saw-applications .saw-intro,.saw-applications .saw-grid p,.saw-planning .saw-section-heading>p,.saw-planning .saw-plan-grid p{color:var(--ledw-muted)!important}");
    expect(after("style").text()).toContain(".saw-plan-grid>div:nth-child(5){grid-column:2/span 2}");
    expect(after(".saw-cta-support")).toHaveLength(1);
    expect(result.evaluation).toMatchObject({ ok: true, checks: { darkHighContrastFoundation: true, blueElectricAccent: true, imageLedComposition: true, commercialDensity: true, excessiveEditorialWhitespace: false, thinBorderEditorialGridDominant: false, worksheetRuleGrammar: false, flatRedEditorialCtaDominant: false, commercialStainlessPresentationLeakage: false } });
  });

  test("keeps all seven governed planning concepts while centering the final desktop row", () => {
    const labels = ["Location", "Audience", "Viewing experience", "Content goals", "Placement", "Infrastructure", "Project schedule"];
    const html = rejected.replace('<div class="saw-plan-grid"><div><strong>Location</strong><p>Planning copy.</p></div></div>', `<div class="saw-plan-grid">${labels.map((label) => `<div><strong>${label}</strong><p>Planning copy.</p></div>`).join("")}</div>`);
    const result = applyLedDisplayWarehousePresentationAuthority(html);
    const output = load(result.contentHtml, null, false);
    expect(output(".saw-plan-grid strong").map((_, element) => output(element).text()).get()).toEqual(labels);
    expect(output(".saw-plan-grid>div")).toHaveLength(7);
  });
});