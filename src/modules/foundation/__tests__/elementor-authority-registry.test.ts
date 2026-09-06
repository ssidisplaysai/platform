import { createHash } from "node:crypto";
import {
  authorizeElementorLeaf,
  applyRegisteredMediaReplacements,
  ELEMENTOR_AUTHORITY_REGISTRY,
  ELEMENTOR_AUTHORITY_REGISTRY_VERSION,
  permitsSemanticHtmlReplacement,
  preservesProtectedElementorRegions,
} from "../elementor-authority-registry";

const request = {
  siteId: "site-ssi-projectorenclosure",
  hostname: "projectorenclosure.com",
  wordpressObjectId: 3810,
  elementId: "98e1f56",
  widgetType: "html",
  leafPath: "settings.html",
  mutationClass: "INERT_CERTIFICATION" as const,
  replacement: "<!-- genesis inert certification -->",
};

describe("Elementor authority registry", () => {
  test("authorizes only an exact registered tuple", () => {
    expect(authorizeElementorLeaf(request)).toMatchObject({ elementId: "98e1f56", allowScripts: false, allowStyles: false, allowMediaMutation: false });
    for (const patch of [
      { wordpressObjectId: 12596 },
      { elementId: "request-granted-id" },
      { leafPath: "settings.css" },
      { widgetType: "text-editor" },
      { hostname: "example.com" },
    ]) expect(authorizeElementorLeaf({ ...request, ...patch } as typeof request)).toBeNull();
  });

  test("prohibits oversized replacements and mutations to protected regions", () => {
    expect(authorizeElementorLeaf({ ...request, replacement: "x".repeat(100_001) })).toBeNull();
    const authority = authorizeElementorLeaf(request)!;
    expect(preservesProtectedElementorRegions({ authority, before: '<style>.a{color:red}</style><img src="a.jpg">', replacement: '<style>.a{color:red}</style><img src="a.jpg"><!-- inert -->' })).toBe(true);
    expect(preservesProtectedElementorRegions({ authority, before: "", replacement: "<script>alert(1)</script>" })).toBe(false);
    expect(preservesProtectedElementorRegions({ authority, before: "<style>.a{}</style>", replacement: "<style>.b{}</style>" })).toBe(false);
    expect(preservesProtectedElementorRegions({ authority, before: '<img src="a.jpg">', replacement: '<img src="b.jpg">' })).toBe(false);
  });

  test("keeps page 3810 compatibility without wildcard authority", () => {
    expect(ELEMENTOR_AUTHORITY_REGISTRY_VERSION).toBe("genesis-elementor-authority-v1");
    expect(ELEMENTOR_AUTHORITY_REGISTRY).toHaveLength(4);
    expect(ELEMENTOR_AUTHORITY_REGISTRY[0].leaves.map((leaf) => leaf.elementId)).toEqual(["98e1f56", "0ce76cb", "e87d71c", "94e8256"]);
    expect(JSON.stringify(ELEMENTOR_AUTHORITY_REGISTRY)).not.toMatch(/\*|ALL_ELEMENTOR_PAGES/);
    expect(ELEMENTOR_AUTHORITY_REGISTRY.find((entry) => entry.wordpressObjectId === 12596)?.leaves).toEqual([
      expect.objectContaining({ elementId: "bc00420", mutationClasses: ["INERT_CERTIFICATION"] }),
      expect.objectContaining({ elementId: "f3694b0", mutationClasses: ["REGISTERED_MEDIA_REFERENCE_REPLACEMENT"], registeredMediaReplacements: expect.any(Array) }),
    ]);
    expect(ELEMENTOR_AUTHORITY_REGISTRY.find((entry) => entry.wordpressObjectId === 12608)?.leaves).toEqual([expect.objectContaining({ elementId: "be422a0", mutationClasses: ["INERT_CERTIFICATION"] })]);
    expect(ELEMENTOR_AUTHORITY_REGISTRY.find((entry) => entry.wordpressObjectId === 12575)?.leaves).toEqual([
      expect.objectContaining({ elementId: "2d677b8", mutationClasses: ["SEMANTIC_HTML", "INERT_CERTIFICATION"], semanticPolicy: expect.objectContaining({ certificationMarker: "<!-- GENESIS-SEMANTIC-HTML-CERT-12575 -->" }) }),
    ]);
  });

  test("permits bounded semantic text, certification, and registered anchor unwraps", () => {
    const authority = ELEMENTOR_AUTHORITY_REGISTRY.find((entry) => entry.wordpressObjectId === 12575)!.leaves[0];
    const before = '<section class="hero"><h2>Old heading</h2><p>Old copy <a class="link" href="/applications/">Applications</a></p><img src="hero.jpg" alt="Defender"></section>';
    const changed = '<section class="hero"><h2>New heading</h2><p>New copy Applications</p><img src="hero.jpg" alt="Defender"></section>';
    expect(permitsSemanticHtmlReplacement({ authority, before, replacement: changed, reason: "remediation" })).toBe(true);
    expect(permitsSemanticHtmlReplacement({ authority, before, replacement: `${before}${authority.semanticPolicy!.certificationMarker}`, reason: "certification" })).toBe(true);
    const rollbackAuthority = { ...authority, semanticPolicy: { ...authority.semanticPolicy!, rollbackLeafSha256: createHash("sha256").update(before).digest("hex") } };
    expect(permitsSemanticHtmlReplacement({ authority: rollbackAuthority, before: `${before}${authority.semanticPolicy!.certificationMarker}`, replacement: before, reason: "rollback" })).toBe(true);
  });

  test("rejects unregistered structural, attribute, code, media, and link changes", () => {
    const authority = ELEMENTOR_AUTHORITY_REGISTRY.find((entry) => entry.wordpressObjectId === 12575)!.leaves[0];
    const before = '<section class="hero"><p>Copy <a href="/applications/">Applications</a></p><img src="hero.jpg" alt="Defender"><style>.a{color:red}</style><script>ok()</script></section>';
    for (const replacement of [
      before.replace('src="hero.jpg"', 'src="other.jpg"'),
      before.replace('alt="Defender"', 'alt="Changed"'),
      before.replace("color:red", "color:blue"),
      before.replace("ok()", "bad()"),
      before.replace("<p>", "<div>"),
      before.replace('href="/applications/"', 'href="https://example.com/"'),
      before.replace("</p>", '<a href="/applications/">New</a></p>'),
      before.replace('<a href="/applications/">Applications</a>', "Changed application text"),
      before.replace("<section", '<section onclick="bad()"'),
      before.replace("</section>", "<form></form></section>"),
    ]) expect(permitsSemanticHtmlReplacement({ authority, before, replacement, reason: "remediation" })).toBe(false);
  });

  test("applies and rolls back exactly five server-registered media regions", () => {
    const authority = ELEMENTOR_AUTHORITY_REGISTRY.find((entry) => entry.wordpressObjectId === 12596)!.leaves.find((leaf) => leaf.elementId === "f3694b0")!;
    const original = authority.registeredMediaReplacements!.map((replacement) => replacement.before).join("\n");
    const applied = applyRegisteredMediaReplacements(authority, original, "apply");
    expect(applied).not.toContain("IMG-HERE");
    expect(authority.registeredMediaReplacements!.every((replacement) => applied.includes(replacement.mediaUrl) && applied.includes(replacement.altText))).toBe(true);
    expect(applyRegisteredMediaReplacements(authority, applied, "rollback")).toBe(original);
    expect(() => applyRegisteredMediaReplacements(authority, `${original}\n${authority.registeredMediaReplacements![0].before}`, "apply")).toThrow("REGISTERED_MEDIA_REGION_MISMATCH");
  });

  test("matches the exact multiline legacy image markup on page 12596", () => {
    const authority = ELEMENTOR_AUTHORITY_REGISTRY.find((entry) => entry.wordpressObjectId === 12596)!.leaves.find((leaf) => leaf.elementId === "f3694b0")!;
    const liveMarkup = authority.registeredMediaReplacements!.map((replacement) => `            <img\n              ${replacement.before}\n            >`).join("\n");
    expect((liveMarkup.match(/IMG-HERE/g) ?? [])).toHaveLength(5);
    const applied = applyRegisteredMediaReplacements(authority, liveMarkup, "apply");
    expect(applied).not.toContain("IMG-HERE");
    expect(applyRegisteredMediaReplacements(authority, applied, "rollback")).toBe(liveMarkup);
  });
});