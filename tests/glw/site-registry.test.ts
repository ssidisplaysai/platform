import { describe, expect, it } from "@jest/globals";

import { GLW_SITE_REGISTRY, getGlwPublishingDefaults, getGlwSite, getGlwSites } from "../../src/lib/glw/site-registry";

describe("GLW site registry", () => {
  it("exposes a canonical multi-site registry with SSI onboarded by configuration", () => {
    expect(GLW_SITE_REGISTRY.map((site: { id: string }) => site.id)).toEqual([
      "led-display-warehouse",
      "screen-solutions-international",
      "california-outdoor-led",
      "sphere-rental-dallas",
      "projection-screen-chicago",
    ]);

    const ssi = getGlwSite("screen-solutions-international");

    expect(ssi?.domain).toBe("https://ssidisplays.com");
    expect(ssi?.wordpressBaseUrl).toBe("https://ssidisplays.com/wp-json");
    expect(ssi?.publishingEnabled).toBe(false);
    expect(ssi?.publishingDefaults.defaultStatus).toBe("draft");
  });

  it("returns defensive copies for downstream consumers", () => {
    const sites = getGlwSites();

    expect(sites).not.toBe(GLW_SITE_REGISTRY);
    expect(getGlwPublishingDefaults("led-display-warehouse")?.dailyPageLimit).toBe(25);
    expect(sites[0]?.publishingDefaults.productRotation).toContain("direct_view_led_video_walls");
  });
});