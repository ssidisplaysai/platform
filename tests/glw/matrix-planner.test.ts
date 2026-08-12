import { describe, expect, it } from "@jest/globals";

import { GLW_STATE_REGISTRY } from "@/lib/glw/geo-registry";
import { planGlwPageMatrix } from "@/lib/glw/matrix-planner";

describe("GLW matrix planner", () => {
  it("classifies missing parents, existing pages, and duplicates deterministically", () => {
    const plans = planGlwPageMatrix({
      siteId: "led-display-warehouse",
      productIds: ["direct_view_led_video_walls"],
      stateCodes: ["TX", "CA"],
      cityByState: {
        TX: [{ citySlug: "houston" }],
        CA: [{ citySlug: "los-angeles" }],
      },
      existingPages: [
        {
          siteId: "led-display-warehouse",
          productId: "direct_view_led_video_walls",
          stateCode: "TX",
          pageType: "state_service",
          canonicalPath: "led-display-warehouse/direct_view_led_video_walls/tx",
        },
        {
          siteId: "led-display-warehouse",
          productId: "direct_view_led_video_walls",
          stateCode: "TX",
          citySlug: "houston",
          pageType: "city_service",
          canonicalPath: "led-display-warehouse/direct_view_led_video_walls/tx/houston",
        },
        {
          siteId: "led-display-warehouse",
          productId: "direct_view_led_video_walls",
          stateCode: "TX",
          citySlug: "houston",
          pageType: "city_service",
          canonicalPath: "led-display-warehouse/direct_view_led_video_walls/tx/houston",
        },
      ],
    });

    expect(GLW_STATE_REGISTRY).toHaveLength(50);
    expect(plans.find((plan) => plan.action === "SKIP_EXISTING" && plan.stateCode === "TX")).toBeTruthy();
    expect(plans.find((plan) => plan.action === "BLOCKED_DUPLICATE" && plan.citySlug === "houston")).toBeTruthy();
    expect(plans.find((plan) => plan.action === "CREATE_STATE" && plan.stateCode === "CA")).toBeTruthy();
    expect(plans.find((plan) => plan.action === "BLOCKED_PARENT" && plan.citySlug === "los-angeles")).toBeTruthy();
  });
});