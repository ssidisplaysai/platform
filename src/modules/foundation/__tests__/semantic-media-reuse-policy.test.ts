import { evaluateSemanticMediaReuse, extractRenderedMediaInstances, type IntentionalMediaReuseDeclaration, type RenderedMediaInstance } from "../semantic-media-reuse-policy";

function instance(overrides: Partial<RenderedMediaInstance> = {}): RenderedMediaInstance {
  return { instanceId: "one", mediaSourceIdentity: "https://example.test/media.jpg", attachmentIdOrUrl: "https://example.test/media.jpg", semanticRole: "HERO_MEDIA", sectionIdentity: "hero:0", compositionRole: "PRIMARY_HERO", documentAuthority: "POST_CONTENT_BLOCK_HTML", hostOrCompositionAuthority: "GOVERNED_COMPOSITION", intentionalReuseDeclaration: null, renderedGeometry: { top: 0, bottom: 600, left: 0, right: 1200, width: 1200, height: 600, objectFit: "cover", objectPosition: "50% 45%" }, presentationIdentity: "PRIMARY_HERO|hero:0|full-bleed", claimClass: "CONCEPTUAL", ...overrides };
}

const declaration: IntentionalMediaReuseDeclaration = { declarationId: "approved-reuse-1", mediaSourceIdentity: "https://example.test/media.jpg", allowedInstances: [{ semanticRole: "HERO_MEDIA", sectionIdentity: "hero:0", compositionRole: "PRIMARY_HERO" }, { semanticRole: "APPLICATION_EXPERIENCE", sectionIdentity: "split:3", compositionRole: "CONTEXTUAL_SUPPORT" }], authorityReference: "owner-approved-composition-v1", ownerApproved: true, claimClass: "CONCEPTUAL", misleadingDocumentaryReuse: false };

describe("semantic media reuse policy", () => {
  test("fails theme featured image plus the same composition image", () => {
    const result = evaluateSemanticMediaReuse({ instances: [instance(), instance({ instanceId: "host", semanticRole: "THEME_FEATURED_MEDIA", sectionIdentity: "template-featured", compositionRole: "THEME_FEATURED", documentAuthority: "WORDPRESS_TEMPLATE", hostOrCompositionAuthority: "HOST_THEME", presentationIdentity: "theme-featured" })], declarations: [declaration] });
    expect(result.pass).toBe(false);
    expect(result.findings[0].classification).toBe("HOST_DUPLICATION");
  });

  test("fails the same source twice in one section or semantic role", () => {
    const result = evaluateSemanticMediaReuse({ instances: [instance(), instance({ instanceId: "two", presentationIdentity: "second" })], declarations: [declaration] });
    expect(result.findings[0].classification).toBe("COMPOSITION_ACCIDENTAL_DUPLICATION");
  });

  test("passes distinct governed hero and application roles", () => {
    const result = evaluateSemanticMediaReuse({ instances: [instance(), instance({ instanceId: "two", semanticRole: "APPLICATION_EXPERIENCE", sectionIdentity: "split:3", compositionRole: "CONTEXTUAL_SUPPORT", presentationIdentity: "CONTEXTUAL_SUPPORT|split:3|split-media", renderedGeometry: { top: 1800, bottom: 2380, left: 0, right: 780, width: 780, height: 580, objectFit: "cover", objectPosition: "50% 50%" } })], declarations: [declaration] });
    expect(result.pass).toBe(true);
    expect(result.findings[0].classification).toBe("INTENTIONAL_SEMANTIC_REUSE");
    expect(result.instances.every((item) => item.intentionalReuseDeclaration === "approved-reuse-1")).toBe(true);
  });

  test("fails closed when semantic metadata or declaration is missing", () => {
    const result = evaluateSemanticMediaReuse({ instances: [instance(), instance({ instanceId: "two", semanticRole: "UNRESOLVED", sectionIdentity: "split:3", compositionRole: "UNRESOLVED", presentationIdentity: "unknown" })], declarations: [] });
    expect(result.pass).toBe(false);
    expect(result.findings[0].classification).toBe("UNRESOLVED_DUPLICATION");
  });

  test("fails different sections with identical presentation and no governed intent", () => {
    const result = evaluateSemanticMediaReuse({ instances: [instance(), instance({ instanceId: "two", semanticRole: "APPLICATION_EXPERIENCE", sectionIdentity: "split:3", compositionRole: "CONTEXTUAL_SUPPORT" })], declarations: [] });
    expect(result.findings[0].classification).toBe("UNRESOLVED_DUPLICATION");
  });

  test("fails governed reuse when rendered presentation is identical", () => {
    const second = instance({ instanceId: "two", semanticRole: "APPLICATION_EXPERIENCE", sectionIdentity: "split:3", compositionRole: "CONTEXTUAL_SUPPORT" });
    const result = evaluateSemanticMediaReuse({ instances: [instance(), second], declarations: [declaration] });
    expect(result.findings[0].classification).toBe("COMPOSITION_ACCIDENTAL_DUPLICATION");
  });

  test("passes documents containing different source images", () => {
    const result = evaluateSemanticMediaReuse({ instances: [instance(), instance({ instanceId: "two", mediaSourceIdentity: "https://example.test/other.jpg", attachmentIdOrUrl: "https://example.test/other.jpg" })], declarations: [] });
    expect(result.pass).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  test("fails misleading documentary reuse even with distinct roles", () => {
    const instances = [instance({ claimClass: "DOCUMENTARY" }), instance({ instanceId: "two", semanticRole: "APPLICATION_EXPERIENCE", sectionIdentity: "split:3", compositionRole: "CONTEXTUAL_SUPPORT", presentationIdentity: "split", claimClass: "DOCUMENTARY" })];
    expect(evaluateSemanticMediaReuse({ instances, declarations: [{ ...declaration, claimClass: "DOCUMENTARY", misleadingDocumentaryReuse: true }] }).findings[0].classification).toBe("UNRESOLVED_DUPLICATION");
  });

  test("extracts site-neutral host and composition authorities from structural markup", () => {
    const html = '<main><figure class="wp-block-post-featured-image"><img src="/media.jpg" alt="Conceptual"></figure><div class="wr-page"><section class="wr-hero" data-media-role="PRIMARY_HERO"><img src="/media.jpg" alt="Conceptual hero"></section></div></main>';
    const instances = extractRenderedMediaInstances({ html, origin: "https://second-site.test" });
    expect(instances.map((item) => item.hostOrCompositionAuthority)).toEqual(["HOST_THEME", "GOVERNED_COMPOSITION"]);
    expect(evaluateSemanticMediaReuse({ instances, declarations: [] }).findings[0].classification).toBe("HOST_DUPLICATION");
  });
});
