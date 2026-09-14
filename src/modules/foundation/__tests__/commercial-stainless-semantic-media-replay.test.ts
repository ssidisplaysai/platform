import { commercialStainlessMediaReuseDeclarations, commercialStainlessSemanticReuseStatus } from "../commercial-stainless-semantic-media-authority";
import { evaluateSemanticMediaReuse, extractRenderedMediaInstances } from "../semantic-media-reuse-policy";

const origin = "https://commercialstainlesscounters.com";
const education = `${origin}/wp-content/uploads/2026/09/education.jpg`;
const capabilities = `${origin}/wp-content/uploads/2026/09/capabilities.jpg`;

describe("Commercial Stainless semantic media evidence replay", () => {
  test("Page 17 is governed, claim-safe, and visually justified intentional reuse", () => {
    const html = `<main><div class="wr-page"><section class="wr-hero wr-hero--industry" data-media-role="PRIMARY_HERO"><img src="${education}" alt="Conceptual visual for Education Solutions"></section><section class="wr-section"></section><section class="wr-section"></section><section class="wr-split"><figure class="wr-media" data-media-role="CONTEXTUAL_SUPPORT"><img src="${education}" alt="Conceptual education stainless application context"></figure></section></div></main>`;
    const instances = extractRenderedMediaInstances({ html, origin });
    instances[0].renderedGeometry = { top: 179.390625, bottom: 789.390625, left: 0, right: 1440, width: 1440, height: 610, objectFit: "cover", objectPosition: "50% 45%" };
    instances[1].renderedGeometry = { top: 2053.3046875, bottom: 2633.3046875, left: 0, right: 777.59375, width: 777.59375, height: 580, objectFit: "cover", objectPosition: "50% 50%" };
    const result = evaluateSemanticMediaReuse({ instances, declarations: commercialStainlessMediaReuseDeclarations(`${origin}/markets/education/`) });
    expect(result).toMatchObject({ pass: true, hostDuplicateMediaCount: 0, intentionalReuseCount: 1, accidentalDuplicationCount: 0, unresolvedDuplicationCount: 0 });
    expect(result.findings[0].classification).toBe("INTENTIONAL_SEMANTIC_REUSE");
    expect(result.instances.map((item) => item.claimClass)).toEqual(["CONCEPTUAL", "CONCEPTUAL"]);
    expect(commercialStainlessSemanticReuseStatus(result)).toBe("GOVERNED_INTENTIONAL_REUSE");
  });

  test("Page 23 remains owner-review-required without an explicit reuse declaration", () => {
    const html = `<main><div class="wr-page"><section class="wr-hero"><img src="${origin}/wp-content/uploads/about.jpg" alt="Conceptual visual for About"></section><section class="wr-split"><figure class="wr-media" data-media-role="CONTEXTUAL_SUPPORT"><img src="${capabilities}" alt="Conceptual commercial stainless capability context"></figure></section><section class="wr-section wr-section--steel"><a class="wr-card"><img src="${capabilities}" alt="Conceptual context for Capabilities"></a></section></div></main>`;
    const instances = extractRenderedMediaInstances({ html, origin });
    const result = evaluateSemanticMediaReuse({ instances, declarations: commercialStainlessMediaReuseDeclarations(`${origin}/about/`) });
    expect(result.pass).toBe(false);
    expect(result.findings[0].classification).toBe("UNRESOLVED_DUPLICATION");
    expect(commercialStainlessSemanticReuseStatus(result)).toBe("OWNER_REVIEW_REQUIRED");
  });
});