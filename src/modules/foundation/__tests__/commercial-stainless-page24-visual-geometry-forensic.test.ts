describe("Commercial Stainless Page 24 public visual geometry forensic", () => {
  const viewports = [
    { width: 1440, height: 900, headerBottom: 109.390625, stagedHeroTop: 179.390625, publicHeroTop: 749.390625, stagedH1Top: 323.7890625, publicH1Top: 893.7890625, stagedCtaBottom: 696.6875, publicCtaBottom: 1266.6875, featuredHeight: 430, spacing: 70 },
    { width: 1024, height: 900, headerBottom: 89, stagedHeroTop: 159, publicHeroTop: 729, stagedH1Top: 349.953125, publicH1Top: 919.953125, stagedCtaBottom: 629.734375, publicCtaBottom: 1199.734375, featuredHeight: 430, spacing: 70 },
    { width: 768, height: 900, headerBottom: 89, stagedHeroTop: 142.7578125, publicHeroTop: 680.2734375, stagedH1Top: 318.40625, publicH1Top: 855.921875, stagedCtaBottom: 578.796875, publicCtaBottom: 1116.3125, featuredHeight: 430, spacing: 53.7578125 },
    { width: 375, height: 812, headerBottom: 89, stagedHeroTop: 119, publicHeroTop: 379, stagedH1Top: 273.6015625, publicH1Top: 533.6015625, stagedCtaBottom: 573.1875, publicCtaBottom: 833.1875, featuredHeight: 200, spacing: 30 },
  ];

  test.each(viewports)("attributes the first divergence at $width px to the theme featured-image stack", (viewport) => {
    const displacement = viewport.publicHeroTop - viewport.stagedHeroTop;
    expect(displacement).toBeCloseTo(viewport.spacing + viewport.featuredHeight + viewport.spacing, 5);
    expect(viewport.publicH1Top - viewport.stagedH1Top).toBeCloseTo(displacement, 5);
    expect(viewport.publicCtaBottom - viewport.stagedCtaBottom).toBeCloseTo(displacement, 5);
  });

  test.each(viewports)("proves the approved CTA fits while the public CTA fails at $width px", (viewport) => {
    expect(viewport.stagedCtaBottom).toBeLessThanOrEqual(viewport.height);
    expect(viewport.publicCtaBottom).toBeGreaterThan(viewport.height);
  });

  test("proves the ordinary theme offset is shared rather than divergent", () => {
    expect(viewports.map((viewport) => viewport.stagedHeroTop - viewport.headerBottom)).toEqual([70, 70, 53.7578125, 30]);
  });
});
