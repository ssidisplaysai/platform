import { applyProjectorEnclosurePresentationAuthority, evaluateProjectorEnclosurePresentation, PROJECTOR_ENCLOSURE_PRESENTATION_CONTRACT } from "../projector-enclosure-presentation-authority";

const industrial = `<style>.saw{--saw-accent:#d8402f;--saw-paper:#e4e0d6}.saw h1{font-family:Impact,'Arial Narrow',sans-serif;font-size:clamp(52px,7vw,84px)}.saw-cta{background:#b3261e}</style><main class="saw"><section class="saw-hero"><h1>Fan Cooled Projector Enclosures in San Antonio</h1><p class="saw-copy">Intro</p></section><section class="saw-product" id="product-authority"><h2>Product</h2></section><section class="saw-section"><div class="saw-guide"><h2>Guide</h2><p>Body</p></div></section><section class="saw-cta"><h2>CTA</h2></section></main>`;

describe("projector enclosure presentation authority", () => {
  test("fails closed on industrial palette and oversized editorial styling", () => {
    const result = evaluateProjectorEnclosurePresentation(industrial);
    expect(result.ok).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      "PROJECTOR_ENCLOSURE_PRESENTATION_CONTRACT_REQUIRED",
      "PROJECTOR_ENCLOSURE_INDUSTRIAL_PALETTE_FORBIDDEN",
    ]));
  });

  test("applies deterministic native projector enclosure presentation contract", () => {
    const applied = applyProjectorEnclosurePresentationAuthority(industrial);
    expect(applied.evaluation.ok).toBe(true);
    expect(applied.contentHtml).toContain(`data-site-presentation-authority="${PROJECTOR_ENCLOSURE_PRESENTATION_CONTRACT}"`);
    expect(applied.contentHtml).toContain("PROJECTOR_ENCLOSURE_COMMERCIAL_AV");
    expect(applied.contentHtml).toContain("--pe-navy:#10324a");
    expect(applied.contentHtml).not.toContain("--saw-accent:#d8402f");
    expect(applied.contentHtml).not.toContain("font-family:Impact");
  });
});
