jest.mock("server-only", () => ({}));

import { filterCommercialStainlessFeaturedImageRender } from "../wordpress-post-launch-defect-repair";

const richContent = '<div class="wr-page"><section class="wr-hero"><img src="hero.jpg"><h1>Request a Quote</h1><a>Request a Quote</a></section><section>Body</section></div>';
const authority = { host: "commercialstainlesscounters.com", postType: "page", status: "publish", blocks: [{ blockName: "core/html", innerHtml: richContent }] };
const geometry = [
  { viewport: 1440, featuredStack: 570, heroTopBefore: 749.390625, heroTopAfter: 179.390625, h1TopAfter: 323.7890625, ctaBottomAfter: 696.6875 },
  { viewport: 1024, featuredStack: 570, heroTopBefore: 729, heroTopAfter: 159, h1TopAfter: 349.953125, ctaBottomAfter: 629.734375 },
  { viewport: 768, featuredStack: 537.515625, heroTopBefore: 680.2734375, heroTopAfter: 142.7578125, h1TopAfter: 318.40625, ctaBottomAfter: 578.796875 },
  { viewport: 375, featuredStack: 260, heroTopBefore: 379, heroTopAfter: 119, h1TopAfter: 273.6015625, ctaBottomAfter: 573.1875 },
];

describe("Commercial Stainless rich-composition featured-image render repair", () => {
  test("removes only the theme featured block from the native template stack", () => {
    const blocks = [
      { name: "core/template-part", html: "<header>Global header</header>" },
      { name: "core/post-featured-image", html: '<figure><img src="hero.jpg"></figure>' },
      { name: "core/post-content", html: richContent },
      { name: "core/template-part", html: "<footer>Global footer</footer>" },
    ];
    const rendered = blocks.map((block) => filterCommercialStainlessFeaturedImageRender({ ...authority, blockName: block.name, renderedHtml: block.html })).join("");
    expect(rendered).toContain("Global header");
    expect(rendered).toContain("Global footer");
    expect(rendered).toContain(richContent);
    expect(rendered.match(/hero\.jpg/g)).toHaveLength(1);
    expect(rendered).not.toContain("<figure>");
  });

  test.each(geometry)("restores the approved geometry envelope at $viewport", (evidence) => {
    expect(evidence.heroTopBefore - evidence.featuredStack).toBeCloseTo(evidence.heroTopAfter, 5);
    expect(evidence.h1TopAfter).toBeGreaterThan(evidence.heroTopAfter);
    expect(evidence.ctaBottomAfter).toBeLessThan(900);
  });
});