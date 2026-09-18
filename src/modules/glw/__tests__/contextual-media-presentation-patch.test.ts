import { load } from "cheerio";
import { patchContextualPresentationMedia, resolveContextualPresentationSlots } from "../contextual-media-presentation-patch";

const html = `<main class="saw-page"><section data-reference-section="HERO"><img src="product"><h1>Product in State</h1></section><section data-reference-section="PRODUCT_IDENTITY"><img src="context"><p>Copy stays byte-identical.</p></section><section data-reference-section="APPLICATIONS"><div class="saw-application-stage"><img src="application"></div></section><section data-reference-section="CTA"><p>CTA copy stays.</p></section></main>`;
const articleHtml = `<h1>Outdoor Digital Sphere in Florida</h1><figure class="wp-block-image"><img src="legacy"></figure><p>Planning content.</p>`;
const replacement = (slot: "HERO_EXPERIENCE" | "POST_HERO_CONTEXTUAL" | "APPLICATION_STAGE" | "CTA_ATMOSPHERE", role: string, mediaRole: "CONTEXTUAL_IN_USE" | "APPLICATION_EXPERIENCE" | "LOCAL_CONTEXTUAL_ATMOSPHERE", id: number) => ({ slot, role, mediaRole, mediaId: id, url: `https://example.test/${id}.jpg`, assetSha256: String(id).repeat(64).slice(0, 64), altText: `${role} conceptual media` });

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

  test("discovers an exact requested slot and preserves hero isolation", () => {
    const resolved = resolveContextualPresentationSlots(html, [replacement("HERO_EXPERIENCE", "HERO", "CONTEXTUAL_IN_USE", 1), replacement("POST_HERO_CONTEXTUAL", "PUBLIC", "APPLICATION_EXPERIENCE", 2)]);
    expect(resolved.map((slot) => slot.actualSection)).toEqual(["HERO", "PRODUCT_IDENTITY"]);
    expect(resolved[0].selector).not.toBe(resolved[1].selector);
  });

  test("falls back to a compatible application section when the implementation-specific stage is absent", () => {
    const liveShape = html.replace('<div class="saw-application-stage"><img src="application"></div>', '<figure class="application-visual"><img src="application"></figure>');
    const resolved = resolveContextualPresentationSlots(liveShape, [replacement("APPLICATION_STAGE", "EVENT", "APPLICATION_EXPERIENCE", 3)]);
    expect(resolved).toEqual([{ role: "EVENT", requestedSlot: "APPLICATION_STAGE", actualSection: "APPLICATIONS", selector: "[data-reference-section=APPLICATIONS] img", placement: "IMAGE" }]);
    expect(load(patchContextualPresentationMedia(liveShape, [replacement("APPLICATION_STAGE", "EVENT", "APPLICATION_EXPERIENCE", 3)]), null, false)("[data-reference-section=APPLICATIONS] img").attr("src")).toBe("https://example.test/3.jpg");
  });

  test("fails deterministically when no compatible application media target exists", () => {
    const noApplicationSection = html.replace('<section data-reference-section="APPLICATIONS"><div class="saw-application-stage"><img src="application"></div></section>', "");
    expect(() => resolveContextualPresentationSlots(noApplicationSection, [replacement("APPLICATION_STAGE", "EVENT", "APPLICATION_EXPERIENCE", 3)])).toThrow("CONTEXTUAL_MEDIA_PRESENTATION_SLOT_MISSING:APPLICATION_STAGE");
  });

  test("mounts an accessible image without changing copy when a compatible application section has no image", () => {
    const liveShape = html.replace('<div class="saw-application-stage"><img src="application"></div>', "<div><p>Applications copy stays.</p></div>");
    const resolved = resolveContextualPresentationSlots(liveShape, [replacement("APPLICATION_STAGE", "EVENT", "APPLICATION_EXPERIENCE", 3)]);
    expect(resolved[0]).toMatchObject({ actualSection: "APPLICATIONS", placement: "MOUNT_IMAGE" });
    const $ = load(patchContextualPresentationMedia(liveShape, [replacement("APPLICATION_STAGE", "EVENT", "APPLICATION_EXPERIENCE", 3)]), null, false);
    expect($("[data-reference-section=APPLICATIONS] > .saw-generated-application-media img").attr("src")).toBe("https://example.test/3.jpg");
    expect($("[data-reference-section=APPLICATIONS] > .saw-generated-application-media img").attr("alt")).toBe("EVENT conceptual media");
    expect($("[data-reference-section=APPLICATIONS] p").text()).toBe("Applications copy stays.");
  });

  test("resolves and patches contextual media for valid long-form article markup", () => {
    const resolved = resolveContextualPresentationSlots(articleHtml, [replacement("POST_HERO_CONTEXTUAL", "CONTEXTUAL", "CONTEXTUAL_IN_USE", 9)]);
    expect(resolved).toEqual([{ role: "CONTEXTUAL", requestedSlot: "POST_HERO_CONTEXTUAL", actualSection: "ARTICLE_BODY", selector: "h1 + figure img:first-of-type", placement: "IMAGE" }]);

    const patched = load(patchContextualPresentationMedia(articleHtml, [replacement("POST_HERO_CONTEXTUAL", "CONTEXTUAL", "CONTEXTUAL_IN_USE", 9)]), null, false);
    expect(patched("figure img").first().attr("src")).toBe("https://example.test/9.jpg");
    expect(patched("figure img").first().attr("data-media-role")).toBe("CONTEXTUAL_IN_USE");
    expect(patched("figure img").first().attr("data-generated-asset-sha")).toBe("9999999999999999999999999999999999999999999999999999999999999999");
    expect(patched("h1").first().text()).toBe("Outdoor Digital Sphere in Florida");
  });

  test("fails closed when presentation root is missing", () => {
    expect(() => resolveContextualPresentationSlots("<div>No authoritative article presentation.</div>", [replacement("POST_HERO_CONTEXTUAL", "CONTEXTUAL", "CONTEXTUAL_IN_USE", 10)])).toThrow("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");
  });

  test("fails closed when SAW presentation root is malformed", () => {
    const malformed = `${html}${html}`;
    expect(() => resolveContextualPresentationSlots(malformed, [replacement("POST_HERO_CONTEXTUAL", "CONTEXTUAL", "CONTEXTUAL_IN_USE", 11)])).toThrow("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");
  });

  test("does not allow SAW-only slots on long-form article markup", () => {
    expect(() => resolveContextualPresentationSlots(articleHtml, [replacement("APPLICATION_STAGE", "EVENT", "APPLICATION_EXPERIENCE", 12)])).toThrow("CONTEXTUAL_MEDIA_PRESENTATION_SLOT_MISSING:APPLICATION_STAGE");
  });

  test("uses format semantics rather than FL-specific logic", () => {
    const nonFlArticle = articleHtml.replace("Florida", "Alabama");
    const resolved = resolveContextualPresentationSlots(nonFlArticle, [replacement("POST_HERO_CONTEXTUAL", "CONTEXTUAL", "CONTEXTUAL_IN_USE", 13)]);
    expect(resolved[0]).toMatchObject({ requestedSlot: "POST_HERO_CONTEXTUAL", actualSection: "ARTICLE_BODY" });
  });
});