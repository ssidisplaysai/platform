import { load } from "cheerio";
import { patchContextualPresentationMedia, resolveContextualPresentationSlots } from "../contextual-media-presentation-patch";

const html = `<main class="saw-page"><section data-reference-section="HERO"><img src="product"><h1>Product in State</h1></section><section data-reference-section="PRODUCT_IDENTITY"><img src="context"><p>Copy stays byte-identical.</p></section><section data-reference-section="APPLICATIONS"><div class="saw-application-stage"><img src="application"></div></section><section data-reference-section="CTA"><p>CTA copy stays.</p></section></main>`;
const articleHtml = `<h1>Outdoor Digital Sphere in Florida</h1><figure class="wp-block-image"><img src="legacy"></figure><p>Planning content.</p><h2>One</h2><p>A</p><h2>Two</h2><p>B</p><h2>Three</h2><p>C</p><h2>Four</h2><p>D</p><h2>Five</h2><p>E</p>`;
const richSphereHtml = `<article class="glw-sphere-page"><section class="glw-sphere-hero" data-genesis-hero="true" data-media-role="CONTEXTUAL_IN_USE" style="background-image:linear-gradient(90deg,rgba(7,17,25,.94),rgba(7,17,25,.66)),url('https://example.test/legacy.jpg');background-size:cover;background-position:center;"><h1>Outdoor Digital Sphere in Georgia</h1><a href="/contact">Request a Quote</a></section><section class="glw-product-authority"><h2>Product Authority</h2><p>Keep product authority unchanged.</p></section><section class="glw-guide"><h2>Guide</h2><p>Keep guide body unchanged.</p></section></article>`;
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

  test("does not mount a duplicate image when the generated URL is already present elsewhere in the page", () => {
    const generatedUrl = "https://example.test/3.jpg";
    const liveShape = `<main class="saw-page"><section data-reference-section="HERO"><img src="${generatedUrl}"><h1>Product in State</h1></section><section data-reference-section="APPLICATIONS"><div><p>Applications copy stays.</p></div></section></main>`;
    const patched = patchContextualPresentationMedia(liveShape, [replacement("APPLICATION_STAGE", "EVENT", "APPLICATION_EXPERIENCE", 3)]);
    const $ = load(patched, null, false);
    expect($("img").toArray().filter((node) => $(node).attr("src") === generatedUrl)).toHaveLength(1);
    expect($(".saw-generated-application-media")).toHaveLength(0);
    expect($("[data-reference-section=APPLICATIONS]").attr("data-generated-contextual-media")).toBe("true");
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

  test("supports bounded four-slot enrichment on long-form article markup", () => {
    const resolved = resolveContextualPresentationSlots(articleHtml, [
      replacement("HERO_EXPERIENCE", "HERO", "LOCAL_CONTEXTUAL_ATMOSPHERE", 31),
      replacement("POST_HERO_CONTEXTUAL", "POST", "CONTEXTUAL_IN_USE", 32),
      replacement("APPLICATION_STAGE", "APPLICATION", "APPLICATION_EXPERIENCE", 33),
      replacement("CTA_ATMOSPHERE", "CTA", "LOCAL_CONTEXTUAL_ATMOSPHERE", 34),
    ]);

    expect(resolved.map((slot) => slot.actualSection)).toEqual([
      "ARTICLE_HERO",
      "ARTICLE_BODY",
      "ARTICLE_APPLICATION_STAGE",
      "ARTICLE_CTA",
    ]);

    const $ = load(patchContextualPresentationMedia(articleHtml, [
      replacement("HERO_EXPERIENCE", "HERO", "LOCAL_CONTEXTUAL_ATMOSPHERE", 31),
      replacement("POST_HERO_CONTEXTUAL", "POST", "CONTEXTUAL_IN_USE", 32),
      replacement("APPLICATION_STAGE", "APPLICATION", "APPLICATION_EXPERIENCE", 33),
      replacement("CTA_ATMOSPHERE", "CTA", "LOCAL_CONTEXTUAL_ATMOSPHERE", 34),
    ]), null, false);

    expect($("h1 + figure.saw-generated-application-media img").attr("src")).toBe("https://example.test/31.jpg");
    expect($("figure.wp-block-image img").attr("src")).toBe("https://example.test/32.jpg");
    expect($("h2:nth-of-type(4) + figure.saw-generated-application-media img").attr("src")).toBe("https://example.test/33.jpg");
    expect($("h2:last-of-type + figure.saw-generated-application-media img").attr("src")).toBe("https://example.test/34.jpg");
  });

  test("supports multi-slot enrichment when long-form article starts with no images", () => {
    const noImageArticle = "<h1>Fan Cooled Projector Enclosures in Austin</h1><p>Intro.</p><h2>One</h2><p>A</p><h2>Two</h2><p>B</p><h2>Three</h2><p>C</p><h2>Four</h2><p>D</p><h2>Five</h2><p>E</p>";
    const resolved = resolveContextualPresentationSlots(noImageArticle, [
      replacement("HERO_EXPERIENCE", "HERO", "LOCAL_CONTEXTUAL_ATMOSPHERE", 41),
      replacement("POST_HERO_CONTEXTUAL", "POST", "CONTEXTUAL_IN_USE", 42),
      replacement("APPLICATION_STAGE", "APPLICATION", "APPLICATION_EXPERIENCE", 43),
      replacement("CTA_ATMOSPHERE", "CTA", "LOCAL_CONTEXTUAL_ATMOSPHERE", 44),
    ]);

    expect(resolved.map((slot) => slot.placement)).toEqual(["MOUNT_IMAGE", "MOUNT_IMAGE", "MOUNT_IMAGE", "MOUNT_IMAGE"]);

    const $ = load(patchContextualPresentationMedia(noImageArticle, [
      replacement("HERO_EXPERIENCE", "HERO", "LOCAL_CONTEXTUAL_ATMOSPHERE", 41),
      replacement("POST_HERO_CONTEXTUAL", "POST", "CONTEXTUAL_IN_USE", 42),
      replacement("APPLICATION_STAGE", "APPLICATION", "APPLICATION_EXPERIENCE", 43),
      replacement("CTA_ATMOSPHERE", "CTA", "LOCAL_CONTEXTUAL_ATMOSPHERE", 44),
    ]), null, false);

    expect($("h1 + figure.saw-generated-application-media img").attr("src")).toBe("https://example.test/41.jpg");
    expect($("h2:first-of-type + figure.saw-generated-application-media img").attr("src")).toBe("https://example.test/42.jpg");
    expect($("h2:nth-of-type(4) + figure.saw-generated-application-media img").attr("src")).toBe("https://example.test/43.jpg");
    expect($("h2:last-of-type + figure.saw-generated-application-media img").attr("src")).toBe("https://example.test/44.jpg");
  });

  test("accepts strict rich outdoor sphere presentation root with zero img", () => {
    expect(load(richSphereHtml, null, false)("article.glw-sphere-page img")).toHaveLength(0);
    const resolved = resolveContextualPresentationSlots(richSphereHtml, [replacement("HERO_EXPERIENCE", "CONTEXTUAL_IN_USE", "CONTEXTUAL_IN_USE", 19)]);
    expect(resolved).toEqual([{
      role: "CONTEXTUAL_IN_USE",
      requestedSlot: "HERO_EXPERIENCE",
      actualSection: "HERO_EXPERIENCE",
      selector: ".glw-sphere-hero[data-genesis-hero=\"true\"][data-media-role=\"CONTEXTUAL_IN_USE\"]",
      placement: "BACKGROUND",
    }]);
  });

  test("patches rich outdoor sphere hero background URL while preserving gradient and non-media content", () => {
    const patched = load(patchContextualPresentationMedia(richSphereHtml, [replacement("HERO_EXPERIENCE", "CONTEXTUAL_IN_USE", "CONTEXTUAL_IN_USE", 21)]), null, false);
    const hero = patched(".glw-sphere-hero[data-genesis-hero=\"true\"][data-media-role=\"CONTEXTUAL_IN_USE\"]");
    const style = hero.attr("style") ?? "";
    expect(style).toContain("linear-gradient(90deg,rgba(7,17,25,.94),rgba(7,17,25,.66))");
    expect(style).toContain("url('https://example.test/21.jpg')");
    expect(style).not.toContain("url('https://example.test/legacy.jpg')");
    expect(hero.attr("data-generated-background-url")).toBe("https://example.test/21.jpg");
    expect(hero.attr("data-media-id")).toBe("21");
    expect(hero.attr("data-media-role")).toBe("CONTEXTUAL_IN_USE");
    expect(hero.attr("data-contextual-role")).toBe("CONTEXTUAL_IN_USE");
    expect(hero.attr("data-generated-asset-sha")).toBe("2121212121212121212121212121212121212121212121212121212121212121");
    expect(hero.attr("data-generated-contextual-media")).toBe("true");
    expect(patched("article.glw-sphere-page h1").text()).toBe("Outdoor Digital Sphere in Georgia");
    expect(patched("article.glw-sphere-page .glw-product-authority p").text()).toBe("Keep product authority unchanged.");
    expect(patched("article.glw-sphere-page .glw-guide p").text()).toBe("Keep guide body unchanged.");
    expect(patched("article.glw-sphere-page").attr("data-media-provenance")).toBe("GENESIS_GENERATED_CONTEXTUAL_MEDIA_V1");
  });

  test("maps four ProjectorEnclosure contextual visuals to distinct experience sections without replacing product authority", () => {
    const projectorHtml = `<main class="saw-page">
      <section class="saw-hero" data-reference-section="HERO" data-visual-intent="HERO_PRODUCT" style="background-image:linear-gradient(100deg,rgba(14,39,60,.92),rgba(14,39,60,.72)),url('https://example.test/product.jpg');"><h1>Fan Cooled Projector Enclosures in El Paso</h1></section>
      <section class="saw-product" data-reference-section="PRODUCT_IDENTITY"><img src="https://example.test/product.jpg"><p>Product truth stays.</p></section>
      <section class="saw-split" data-reference-section="APPLICATIONS" data-visual-intent="OUTDOOR_MAPPING"><img src="https://example.test/product.jpg"><p>Mapping copy stays.</p></section>
      <section class="saw-application" data-reference-section="VISUAL_APPLICATION" data-visual-intent="OUTDOOR_THEATER_HOSPITALITY" style="background-image:url('https://example.test/product.jpg');"><p>Theater copy stays.</p></section>
      <section class="saw-split" data-reference-section="APPLICATIONS" data-visual-intent="OUTDOOR_COMMERCIAL_EVENT"><img src="https://example.test/product.jpg"><p>Event copy stays.</p></section>
      <section data-reference-section="CTA"><p>CTA copy stays.</p></section>
    </main>`;

    const replacements = [
      replacement("HERO_EXPERIENCE", "CONTEXTUAL_IN_USE", "CONTEXTUAL_IN_USE", 51),
      replacement("POST_HERO_CONTEXTUAL", "OUTDOOR_MAPPING_EXPERIENCE", "APPLICATION_EXPERIENCE", 52),
      replacement("APPLICATION_STAGE", "OUTDOOR_THEATER_HOSPITALITY", "APPLICATION_EXPERIENCE", 53),
      replacement("CTA_ATMOSPHERE", "OUTDOOR_COMMERCIAL_EVENT", "LOCAL_CONTEXTUAL_ATMOSPHERE", 54),
    ];

    const resolved = resolveContextualPresentationSlots(projectorHtml, replacements);
    expect(resolved.map((slot) => slot.actualSection)).toEqual([
      "HERO",
      "OUTDOOR_MAPPING",
      "OUTDOOR_THEATER_HOSPITALITY",
      "OUTDOOR_COMMERCIAL_EVENT",
    ]);

    const $ = load(patchContextualPresentationMedia(projectorHtml, replacements), null, false);
    expect($("[data-reference-section=HERO]").attr("style")).toContain("https://example.test/51.jpg");
    expect($("[data-visual-intent=OUTDOOR_MAPPING] img").attr("src")).toBe("https://example.test/52.jpg");
    expect($("[data-visual-intent=OUTDOOR_THEATER_HOSPITALITY]").attr("style")).toContain("https://example.test/53.jpg");
    expect($("[data-visual-intent=OUTDOOR_COMMERCIAL_EVENT] img").attr("src")).toBe("https://example.test/54.jpg");
    expect($("[data-reference-section=PRODUCT_IDENTITY] img").attr("src")).toBe("https://example.test/product.jpg");
    expect($("[data-reference-section=PRODUCT_IDENTITY] p").text()).toBe("Product truth stays.");
  });

  test("fails closed when presentation root is missing", () => {
    expect(() => resolveContextualPresentationSlots("<div>No authoritative article presentation.</div>", [replacement("POST_HERO_CONTEXTUAL", "CONTEXTUAL", "CONTEXTUAL_IN_USE", 10)])).toThrow("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");
  });

  test("fails closed when SAW presentation root is malformed", () => {
    const malformed = `${html}${html}`;
    expect(() => resolveContextualPresentationSlots(malformed, [replacement("POST_HERO_CONTEXTUAL", "CONTEXTUAL", "CONTEXTUAL_IN_USE", 11)])).toThrow("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");
  });

  test("fails closed when long-form article lacks enough heading structure for application-stage slot", () => {
    const minimalArticle = "<h1>Outdoor Digital Sphere in Florida</h1><figure><img src=\"legacy\"></figure><p>Planning content.</p>";
    expect(() => resolveContextualPresentationSlots(minimalArticle, [replacement("APPLICATION_STAGE", "EVENT", "APPLICATION_EXPERIENCE", 12)])).toThrow("CONTEXTUAL_MEDIA_PRESENTATION_SLOT_MISSING:APPLICATION_STAGE");
  });

  test("uses format semantics rather than FL-specific logic", () => {
    const nonFlArticle = articleHtml.replace("Florida", "Alabama");
    const resolved = resolveContextualPresentationSlots(nonFlArticle, [replacement("POST_HERO_CONTEXTUAL", "CONTEXTUAL", "CONTEXTUAL_IN_USE", 13)]);
    expect(resolved[0]).toMatchObject({ requestedSlot: "POST_HERO_CONTEXTUAL", actualSection: "ARTICLE_BODY" });
  });

  test("fails closed when rich outdoor sphere has duplicate roots", () => {
    const duplicated = `${richSphereHtml}${richSphereHtml}`;
    expect(() => resolveContextualPresentationSlots(duplicated, [replacement("HERO_EXPERIENCE", "CONTEXTUAL_IN_USE", "CONTEXTUAL_IN_USE", 22)])).toThrow("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");
  });

  test("fails closed when rich outdoor sphere hero is missing or duplicated", () => {
    const missingHero = richSphereHtml.replace("glw-sphere-hero", "glw-sphere-nohero");
    expect(() => resolveContextualPresentationSlots(missingHero, [replacement("HERO_EXPERIENCE", "CONTEXTUAL_IN_USE", "CONTEXTUAL_IN_USE", 23)])).toThrow("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");

    const duplicateHero = richSphereHtml.replace("</section><section class=\"glw-product-authority\">", "</section><section class=\"glw-sphere-hero\" data-genesis-hero=\"true\" data-media-role=\"CONTEXTUAL_IN_USE\"><h2>Duplicate hero</h2></section><section class=\"glw-product-authority\">");
    expect(() => resolveContextualPresentationSlots(duplicateHero, [replacement("HERO_EXPERIENCE", "CONTEXTUAL_IN_USE", "CONTEXTUAL_IN_USE", 24)])).toThrow("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");
  });

  test("fails closed when rich outdoor sphere h1 cardinality is invalid or hero role is wrong", () => {
    const missingH1 = richSphereHtml.replace("<h1>Outdoor Digital Sphere in Georgia</h1>", "");
    expect(() => resolveContextualPresentationSlots(missingH1, [replacement("HERO_EXPERIENCE", "CONTEXTUAL_IN_USE", "CONTEXTUAL_IN_USE", 25)])).toThrow("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");

    const duplicateH1 = richSphereHtml.replace("</h1>", "</h1><h1>Duplicate heading</h1>");
    expect(() => resolveContextualPresentationSlots(duplicateH1, [replacement("HERO_EXPERIENCE", "CONTEXTUAL_IN_USE", "CONTEXTUAL_IN_USE", 26)])).toThrow("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");

    const wrongRole = richSphereHtml.replace('data-media-role="CONTEXTUAL_IN_USE"', 'data-media-role="APPLICATION_EXPERIENCE"');
    expect(() => resolveContextualPresentationSlots(wrongRole, [replacement("HERO_EXPERIENCE", "CONTEXTUAL_IN_USE", "CONTEXTUAL_IN_USE", 27)])).toThrow("CONTEXTUAL_MEDIA_PRESENTATION_ROOT_INVALID");
  });
});