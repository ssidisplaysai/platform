import {
  buildProjectorEnclosureGeneratedContextualPlan,
  PROJECTOR_ENCLOSURE_CONTEXTUAL_MEDIA_POLICY_VERSION,
  requiresGeneratedContextualMediaForProjectorEnclosure,
} from "../projector-enclosure-contextual-media-policy";

describe("ProjectorEnclosure contextual media V2 policy", () => {
  test("binds only the SSI ProjectorEnclosure fan-cooled product scope", () => {
    expect(requiresGeneratedContextualMediaForProjectorEnclosure({
      organizationId: "ssi",
      siteId: "site-ssi-projectorenclosure",
      productId: "prod-ssi-fan-cooled-projector-enclosures",
    })).toBe(true);

    expect(requiresGeneratedContextualMediaForProjectorEnclosure({
      organizationId: "ssi",
      siteId: "site-ssi-projectorenclosure",
      productId: "prod-other",
    })).toBe(false);
  });

  test("builds four distinct experience-first generated visual roles", () => {
    const plan = buildProjectorEnclosureGeneratedContextualPlan({
      stateName: "Texas",
      cityName: "El Paso",
    });

    expect(PROJECTOR_ENCLOSURE_CONTEXTUAL_MEDIA_POLICY_VERSION).toBe("PROJECTOR_ENCLOSURE_CONTEXTUAL_MEDIA_V2");
    expect(plan).toHaveLength(4);
    expect(plan.map((item) => item.role)).toEqual([
      "CONTEXTUAL_IN_USE",
      "OUTDOOR_MAPPING_EXPERIENCE",
      "OUTDOOR_THEATER_HOSPITALITY",
      "OUTDOOR_COMMERCIAL_EVENT",
    ]);
    expect(new Set(plan.map((item) => item.slot)).size).toBe(4);
    expect(plan.every((item) => /not a real customer installation|generated planning visualization/i.test(`${item.prompt} ${item.altText}`))).toBe(true);
    expect(plan.every((item) => /(?:do not show|no) readable text/i.test(item.prompt))).toBe(true);
  });
});
