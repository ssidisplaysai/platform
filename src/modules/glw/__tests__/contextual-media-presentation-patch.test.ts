import { load } from "cheerio";
import { patchContextualPresentationMedia } from "../contextual-media-presentation-patch";

const html = `<main class="saw-page"><section data-reference-section="HERO"><img src="product"><h1>Product in State</h1></section><section data-reference-section="PRODUCT_IDENTITY"><img src="context"><p>Copy stays byte-identical.</p></section><section data-reference-section="APPLICATIONS"><div class="saw-application-stage"><img src="application"></div></section><section data-reference-section="CTA"><p>CTA copy stays.</p></section></main>`;
const replacement = (slot: "HERO_EXPERIENCE" | "POST_HERO_CONTEXTUAL" | "APPLICATION_STAGE" | "CTA_ATMOSPHERE", role: string, mediaRole: "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE" | "LOCAL_CONTEXTUAL_ATMOSPHERE", id: number) => ({ slot, role, mediaRole, mediaId: id, url: `https://example.test/${id}.jpg`, assetSha256: String(id).repeat(64).slice(0, 64) });

describe("contextual presentation media patch", () => {
  test("patches only semantic media paths and keeps hero and secondary in distinct sections", () => {
    const result = patchContextualPresentationMedia(html, [replacement("HERO_EXPERIENCE", "HERO", "LOCAL_CONTEXTUAL_ATMOSPHERE", 1), replacement("POST_HERO_CONTEXTUAL", "PUBLIC", "CONTEXTUAL_IN_USE", 2), replacement("APPLICATION_STAGE", "EVENT", "APPLICATION_EXPERIENCE", 3), replacement("CTA_ATMOSPHERE", "CAMPUS", "LOCAL_CONTEXTUAL_ATMOSPHERE", 4)]);
    const $ = load(result, null, false);
    expect($("h1").text()).toBe("Product in State"); expect($("[data-reference-section=PRODUCT_IDENTITY] p").text()).toBe("Copy stays byte-identical."); expect($("[data-reference-section=CTA] p").text()).toBe("CTA copy stays.");
    expect($("[data-reference-section=HERO] > img").attr("src")).toBe("https://example.test/1.jpg");
    expect($("[data-reference-section=PRODUCT_IDENTITY] img").attr("src")).toBe("https://example.test/2.jpg");
    expect($("[data-reference-section=HERO] [data-contextual-role=PUBLIC]")).toHaveLength(0);
    expect($("[data-reference-section=CTA]").attr("data-generated-background-url")).toBe("https://example.test/4.jpg");
      expect($("[data-reference-section=CTA]").attr("style")).toContain("url('https://example.test/4.jpg')");
    expect($(".saw-page").attr("data-media-provenance")).toBe("GENESIS_GENERATED_CONTEXTUAL_MEDIA_V1");
  });
});